import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Pool } from 'pg';
import { z } from 'zod';

import {
  getApiServiceById,
  deleteApiServiceBinding,
  listApiServiceBindings,
  upsertApiServiceBinding,
} from '../../../adapters/api-service.adapter';
import type { AuthRepositoryBundle } from '../../../adapters';
import type { AuthSessionPrincipal } from '../../../types/auth';
import { validateToolStepBindingInput } from '../../integrations/api-service-validation';
import type {
  AuthHttpWriteErrorFn,
  AuthHttpWriteSuccessFn,
} from '../support';
import {
  enumValue,
  formatZodIssuesForBadRequest,
  nonEmptyTrimmedString,
} from '../zod-support';

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

  const readPgErrorCode = (error: unknown): string | null => {
    if (!error || typeof error !== 'object') {
      return null;
    }

    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  };

  const adminApiServiceBindingBaseSchema = z.object({
    toolKey: nonEmptyTrimmedString('toolKey'),
    stepKey: nonEmptyTrimmedString('stepKey'),
    workflowStepType: enumValue(['acquisition'], 'workflowStepType').optional(),
    bindingStatus: enumValue(['active', 'inactive'], 'bindingStatus').optional(),
    requiredness: enumValue(
      ['always-required', 'required-by-tool-setting', 'optional-by-tool-setting'],
      'requiredness',
    ).optional(),
  });

  const adminApiServiceBindingUpsertSchema = adminApiServiceBindingBaseSchema.extend({
    id: z.string().trim().optional(),
  });

  type AdminApiServiceBindingUpsertBody = z.infer<typeof adminApiServiceBindingUpsertSchema>;

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

    let rawBody: unknown;
    try {
      rawBody = await parseJsonBody<unknown>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const parsedBody = adminApiServiceBindingUpsertSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      writeError(response, 400, 'bad_request', formatZodIssuesForBadRequest(parsedBody.error.issues));
      return;
    }

    const body: AdminApiServiceBindingUpsertBody = parsedBody.data;
    const toolKey = body.toolKey;
    const stepKey = body.stepKey;
    const workflowStepType = body.workflowStepType;
    const bindingStatus = body.bindingStatus;
    const requiredness = body.requiredness;
    const id = body.id;

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

    const service = await getApiServiceById(db, serviceId);
    if (!service) {
      writeError(response, 404, 'not_found', 'ApiService not found');
      return;
    }

    let binding;
    try {
      binding = await upsertApiServiceBinding(db, {
        ...(id ? { id } : {}),
        apiServiceId: serviceId,
        toolKey,
        stepKey,
        ...(workflowStepType ? { workflowStepType } : {}),
        ...(bindingStatus ? { bindingStatus } : {}),
        ...(requiredness
          ? {
            requiredness,
          }
          : {}),
      });
    } catch (error) {
      const code = readPgErrorCode(error);
      if (code === '23503') {
        writeError(response, 404, 'not_found', 'ApiService not found');
        return;
      }

      if (code === '23505') {
        writeError(response, 409, 'conflict', 'ApiService binding conflict');
        return;
      }

      throw error;
    }

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
