import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Pool } from 'pg';
import { z } from 'zod';

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
import { formatZodIssuesForBadRequest } from './zod-support';

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

const llmModelKeySchema = z.string()
  .transform((value) => value.trim())
  .refine((value) => value.length > 0 && value.length <= 128 && LLM_MODEL_KEY_REGEX.test(value), {
    message: 'key must be 1-128 chars matching [a-zA-Z0-9/_-.]',
  });

const llmModelLabelSchema = z.string()
  .transform((value) => value.trim())
  .refine((value) => value.length > 0 && value.length <= 256, {
    message: 'label must be 1-256 chars',
  });

const llmModelStatusSchema = z.string()
  .transform((value) => value.trim())
  .refine((value) => value === 'enabled' || value === 'disabled', {
    message: 'status must be enabled or disabled',
  })
  .transform((value) => value as LlmModelStatus);

const sortOrderSchema = z.custom<number>((value) => typeof value === 'number', {
  message: 'sortOrder must be a number',
});

const isDefaultSchema = z.custom<boolean>((value) => typeof value === 'boolean', {
  message: 'isDefault must be a boolean',
});

const createAdminModelRequestSchema = z.object({
  key: z.preprocess(
    (value) => typeof value === 'string' ? value : '',
    llmModelKeySchema,
  ),
  label: z.preprocess(
    (value) => typeof value === 'string' ? value : '',
    llmModelLabelSchema,
  ),
  status: z.preprocess(
    (value) => typeof value === 'string' ? value : undefined,
    llmModelStatusSchema.optional(),
  ),
  sortOrder: z.preprocess(
    (value) => typeof value === 'number' ? value : undefined,
    sortOrderSchema.optional(),
  ),
  isDefault: z.preprocess(
    (value) => typeof value === 'boolean' ? value : undefined,
    isDefaultSchema.optional(),
  ),
});

const updateAdminModelRequestSchema = z.object({
  key: llmModelKeySchema.optional(),
  label: llmModelLabelSchema.optional(),
  status: llmModelStatusSchema.optional(),
  sortOrder: sortOrderSchema.optional(),
  isDefault: isDefaultSchema.optional(),
});

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

    let rawBody: unknown;
    try {
      rawBody = await parseJsonBody<unknown>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const parsedBody = createAdminModelRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      writeError(response, 400, 'bad_request', formatZodIssuesForBadRequest(parsedBody.error.issues));
      return;
    }

    const {
      key,
      label,
      status,
      sortOrder,
      isDefault,
    } = parsedBody.data;

    const model = await createModel(pool, {
      key,
      label,
      status: status ?? 'enabled',
      isDefault: isDefault ?? false,
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

    let rawBody: unknown;
    try {
      rawBody = await parseJsonBody<unknown>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const parsedBody = updateAdminModelRequestSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      writeError(response, 400, 'bad_request', formatZodIssuesForBadRequest(parsedBody.error.issues));
      return;
    }

    const payload: Partial<{
      key: string;
      label: string;
      status: LlmModelStatus;
      isDefault: boolean;
      sortOrder: number;
    }> = {};

    const body = parsedBody.data;

    if (body.key !== undefined) {
      payload.key = body.key;
    }

    if (body.label !== undefined) {
      payload.label = body.label;
    }

    if (body.status !== undefined) {
      payload.status = body.status;
    }

    if (body.sortOrder !== undefined) {
      payload.sortOrder = body.sortOrder;
    }

    if (body.isDefault !== undefined) {
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