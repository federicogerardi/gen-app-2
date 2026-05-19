import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Pool } from 'pg';

import { type AuthRepositoryBundle } from '../../adapters';
import {
  createModel,
  deleteModel,
  listAllModels,
  updateModel,
} from '../../adapters/llm-model.adapter';
import type { AuthSessionPrincipal } from '../../types/auth';
import type { LlmModelStatus } from '../../types/llm-model';
import type {
  AuthHttpWriteErrorFn,
  AuthHttpWriteSuccessFn,
} from './support';

export type CreateAdminLlmModelHandlersDependencies = {
  repositories: Pick<AuthRepositoryBundle, 'sessions'>;
  now: () => Date;
  requireAdminPrincipal: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<AuthSessionPrincipal | null>;
  requireDb: (response: ServerResponse) => Pool | null;
  parseJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  writeError: AuthHttpWriteErrorFn;
  writeSuccess: AuthHttpWriteSuccessFn;
};

export type AdminLlmModelHandlers = {
  handleAdminModelsList(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminModelsCreate(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminModelsUpdate(request: IncomingMessage, response: ServerResponse, modelId: string): Promise<void>;
  handleAdminModelsDelete(request: IncomingMessage, response: ServerResponse, modelId: string): Promise<void>;
};

const LLM_MODEL_KEY_REGEX = /^[a-zA-Z0-9/_\-.]+$/;

export const createAdminLlmModelHandlers = (
  deps: CreateAdminLlmModelHandlersDependencies,
): AdminLlmModelHandlers => {
  const {
    repositories,
    now,
    requireAdminPrincipal,
    requireDb,
    parseJsonBody,
    writeError,
    writeSuccess,
  } = deps;

  const handleAdminModelsList = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for admin models list');
      return;
    }

    const principal = await requireAdminPrincipal(request, response);
    if (!principal) {
      return;
    }

    const pool = requireDb(response);
    if (!pool) {
      return;
    }

    const models = await listAllModels(pool);
    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, { models });
  };

  const handleAdminModelsCreate = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for admin model create');
      return;
    }

    const principal = await requireAdminPrincipal(request, response);
    if (!principal) {
      return;
    }

    const pool = requireDb(response);
    if (!pool) {
      return;
    }

    let body: Record<string, unknown>;
    try {
      body = await parseJsonBody<Record<string, unknown>>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const key = typeof body.key === 'string' ? body.key.trim() : '';
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    const status = typeof body.status === 'string' ? body.status.trim() : 'enabled';
    const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : undefined;
    const isDefault = typeof body.isDefault === 'boolean' ? body.isDefault : false;

    if (!key || key.length > 128 || !LLM_MODEL_KEY_REGEX.test(key)) {
      writeError(response, 400, 'bad_request', 'key must be 1-128 chars matching [a-zA-Z0-9/_-.]');
      return;
    }

    if (!label || label.length > 256) {
      writeError(response, 400, 'bad_request', 'label must be 1-256 chars');
      return;
    }

    if (status !== 'enabled' && status !== 'disabled') {
      writeError(response, 400, 'bad_request', 'status must be enabled or disabled');
      return;
    }

    const model = await createModel(pool, {
      key,
      label,
      status: status as LlmModelStatus,
      isDefault,
      ...(sortOrder !== undefined ? { sortOrder } : {}),
    });
    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 201, { model });
  };

  const handleAdminModelsUpdate = async (
    request: IncomingMessage,
    response: ServerResponse,
    modelId: string,
  ): Promise<void> => {
    if (request.method !== 'PUT') {
      writeError(response, 405, 'method_not_allowed', 'Use PUT for admin model update');
      return;
    }

    const principal = await requireAdminPrincipal(request, response);
    if (!principal) {
      return;
    }

    const pool = requireDb(response);
    if (!pool) {
      return;
    }

    let body: Record<string, unknown>;
    try {
      body = await parseJsonBody<Record<string, unknown>>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const payload: Partial<{
      key: string;
      label: string;
      status: LlmModelStatus;
      isDefault: boolean;
      sortOrder: number;
    }> = {};

    if (body.key !== undefined) {
      const key = typeof body.key === 'string' ? body.key.trim() : '';
      if (!key || key.length > 128 || !LLM_MODEL_KEY_REGEX.test(key)) {
        writeError(response, 400, 'bad_request', 'key must be 1-128 chars matching [a-zA-Z0-9/_-.]');
        return;
      }
      payload.key = key;
    }

    if (body.label !== undefined) {
      const label = typeof body.label === 'string' ? body.label.trim() : '';
      if (!label || label.length > 256) {
        writeError(response, 400, 'bad_request', 'label must be 1-256 chars');
        return;
      }
      payload.label = label;
    }

    if (body.status !== undefined) {
      const status = typeof body.status === 'string' ? body.status.trim() : '';
      if (status !== 'enabled' && status !== 'disabled') {
        writeError(response, 400, 'bad_request', 'status must be enabled or disabled');
        return;
      }
      payload.status = status as LlmModelStatus;
    }

    if (body.sortOrder !== undefined) {
      if (typeof body.sortOrder !== 'number') {
        writeError(response, 400, 'bad_request', 'sortOrder must be a number');
        return;
      }
      payload.sortOrder = body.sortOrder;
    }

    if (body.isDefault !== undefined) {
      if (typeof body.isDefault !== 'boolean') {
        writeError(response, 400, 'bad_request', 'isDefault must be a boolean');
        return;
      }
      payload.isDefault = body.isDefault;
    }

    const model = await updateModel(pool, modelId, payload);
    if (!model) {
      writeError(response, 404, 'not_found', 'Model not found');
      return;
    }

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, { model });
  };

  const handleAdminModelsDelete = async (
    request: IncomingMessage,
    response: ServerResponse,
    modelId: string,
  ): Promise<void> => {
    if (request.method !== 'DELETE') {
      writeError(response, 405, 'method_not_allowed', 'Use DELETE for admin model delete');
      return;
    }

    const principal = await requireAdminPrincipal(request, response);
    if (!principal) {
      return;
    }

    const pool = requireDb(response);
    if (!pool) {
      return;
    }

    const deleted = await deleteModel(pool, modelId);
    if (!deleted) {
      writeError(response, 404, 'not_found', 'Model not found');
      return;
    }

    await repositories.sessions.touchSession(principal.session.id, now());
    response.statusCode = 204;
    response.end('');
  };

  return {
    handleAdminModelsList,
    handleAdminModelsCreate,
    handleAdminModelsUpdate,
    handleAdminModelsDelete,
  };
};