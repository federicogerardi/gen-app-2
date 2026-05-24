import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Pool } from 'pg';

import {
  deleteApiServiceBinding,
  listApiServiceBindings,
  upsertApiServiceBinding,
} from '../../adapters/api-service.adapter';
import type { AuthRepositoryBundle } from '../../adapters';
import type { AuthSessionPrincipal } from '../../types/auth';
import { validateToolStepBindingInput } from '../integrations/api-service-validation';
import type {
  AuthHttpWriteErrorFn,
  AuthHttpWriteSuccessFn,
} from './support';

export type CreateAdminApiServiceBindingHandlersDependencies = {
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

export type AdminApiServiceBindingHandlers = {
  handleAdminApiServiceBindingsList(
    request: IncomingMessage,
    response: ServerResponse,
    serviceId: string,
  ): Promise<void>;
  handleAdminApiServiceBindingsUpsert(
    request: IncomingMessage,
    response: ServerResponse,
    serviceId: string,
  ): Promise<void>;
  handleAdminApiServiceBindingsDelete(
    request: IncomingMessage,
    response: ServerResponse,
    serviceId: string,
    bindingId: string,
  ): Promise<void>;
};

export const createAdminApiServiceBindingHandlers = (
  deps: CreateAdminApiServiceBindingHandlersDependencies,
): AdminApiServiceBindingHandlers => {
  const {
    repositories,
    now,
    requireAdminPrincipal,
    requireDb,
    parseJsonBody,
    writeError,
    writeSuccess,
  } = deps;

  const handleAdminApiServiceBindingsList = async (
    request: IncomingMessage,
    response: ServerResponse,
    serviceId: string,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for api-service bindings list');
      return;
    }

    const principal = await requireAdminPrincipal(request, response);
    if (!principal) {
      return;
    }

    const db = requireDb(response);
    if (!db) {
      return;
    }

    const bindings = await listApiServiceBindings(db, serviceId);

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, {
      bindings: bindings.map((binding) => ({
        id: binding.id,
        apiServiceId: binding.apiServiceId,
        toolKey: binding.toolKey,
        stepKey: binding.stepKey,
        workflowStepType: binding.workflowStepType,
        bindingStatus: binding.bindingStatus,
        requiredness: binding.requiredness,
        createdAt: binding.createdAt.toISOString(),
        updatedAt: binding.updatedAt.toISOString(),
      })),
    });
  };

  const handleAdminApiServiceBindingsUpsert = async (
    request: IncomingMessage,
    response: ServerResponse,
    serviceId: string,
  ): Promise<void> => {
    if (request.method !== 'PUT') {
      writeError(response, 405, 'method_not_allowed', 'Use PUT for api-service bindings upsert');
      return;
    }

    const principal = await requireAdminPrincipal(request, response);
    if (!principal) {
      return;
    }

    const db = requireDb(response);
    if (!db) {
      return;
    }

    let body: Record<string, unknown>;
    try {
      body = await parseJsonBody<Record<string, unknown>>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const toolKey = typeof body.toolKey === 'string' ? body.toolKey.trim() : '';
    const stepKey = typeof body.stepKey === 'string' ? body.stepKey.trim() : '';
    const workflowStepType = typeof body.workflowStepType === 'string'
      ? body.workflowStepType
      : undefined;
    const bindingStatus = typeof body.bindingStatus === 'string'
      ? body.bindingStatus
      : undefined;
    const requiredness = typeof body.requiredness === 'string'
      ? body.requiredness
      : undefined;
    const id = typeof body.id === 'string' ? body.id : undefined;

    const validationErrors = validateToolStepBindingInput({
      toolKey,
      stepKey,
      ...(workflowStepType !== undefined ? { workflowStepType } : {}),
      ...(bindingStatus !== undefined ? { bindingStatus } : {}),
      ...(requiredness !== undefined ? { requiredness } : {}),
    });

    if (validationErrors.length > 0) {
      writeError(response, 400, 'bad_request', validationErrors.join('; '));
      return;
    }

    const binding = await upsertApiServiceBinding(db, {
      ...(id ? { id } : {}),
      apiServiceId: serviceId,
      toolKey,
      stepKey,
      ...(workflowStepType ? { workflowStepType: 'acquisition' as const } : {}),
      ...(bindingStatus ? { bindingStatus: bindingStatus as 'active' | 'inactive' } : {}),
      ...(requiredness
        ? {
          requiredness: requiredness as
            | 'always-required'
            | 'required-by-tool-setting'
            | 'optional-by-tool-setting',
        }
        : {}),
    });

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, {
      binding: {
        id: binding.id,
        apiServiceId: binding.apiServiceId,
        toolKey: binding.toolKey,
        stepKey: binding.stepKey,
        workflowStepType: binding.workflowStepType,
        bindingStatus: binding.bindingStatus,
        requiredness: binding.requiredness,
        createdAt: binding.createdAt.toISOString(),
        updatedAt: binding.updatedAt.toISOString(),
      },
    });
  };

  const handleAdminApiServiceBindingsDelete = async (
    request: IncomingMessage,
    response: ServerResponse,
    serviceId: string,
    bindingId: string,
  ): Promise<void> => {
    if (request.method !== 'DELETE') {
      writeError(response, 405, 'method_not_allowed', 'Use DELETE for api-service bindings delete');
      return;
    }

    const principal = await requireAdminPrincipal(request, response);
    if (!principal) {
      return;
    }

    const db = requireDb(response);
    if (!db) {
      return;
    }

    const deleted = await deleteApiServiceBinding(db, serviceId, bindingId);
    if (!deleted) {
      writeError(response, 404, 'not_found', 'ApiService binding not found');
      return;
    }

    await repositories.sessions.touchSession(principal.session.id, now());
    response.statusCode = 204;
    response.end('');
  };

  return {
    handleAdminApiServiceBindingsList,
    handleAdminApiServiceBindingsUpsert,
    handleAdminApiServiceBindingsDelete,
  };
};
