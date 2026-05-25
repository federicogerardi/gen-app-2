import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Pool } from 'pg';

import {
  createApiService,
  deleteApiService,
  getApiServiceById,
  listApiServices,
  updateApiService,
} from '../../adapters/api-service.adapter';
import type { AuthRepositoryBundle } from '../../adapters';
import type { AuthSessionPrincipal } from '../../types/auth';
import type { ApiServiceAccessMode, ApiServiceStatus } from '../../types/api-service';
import {
  normalizeTokenHeaderName,
  toApiServiceRedactedDto,
  validateApiServiceInput,
} from '../integrations/api-service-validation';
import type {
  AuthHttpWriteErrorFn,
  AuthHttpWriteSuccessFn,
} from './support';

export type CreateAdminApiServiceHandlersDependencies = {
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

export type AdminApiServiceHandlers = {
  handleAdminApiServicesList(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminApiServicesCreate(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleAdminApiServicesUpdate(request: IncomingMessage, response: ServerResponse, serviceId: string): Promise<void>;
  handleAdminApiServicesDelete(request: IncomingMessage, response: ServerResponse, serviceId: string): Promise<void>;
};

const parseAccessMode = (value: unknown): ApiServiceAccessMode | null => {
  if (value === 'public' || value === 'token') {
    return value;
  }
  return null;
};

const parseStatus = (value: unknown): ApiServiceStatus | null => {
  if (value === 'active' || value === 'inactive') {
    return value;
  }
  return null;
};

const parseRequestMethod = (value: unknown): 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | null => {
  if (
    value === 'GET'
    || value === 'POST'
    || value === 'PUT'
    || value === 'PATCH'
    || value === 'DELETE'
  ) {
    return value;
  }
  return null;
};

const asRecordOrDefault = (value: unknown, fallback: Record<string, unknown>): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return fallback;
};

const asArrayOrDefault = (value: unknown, fallback: Array<Record<string, unknown>>): Array<Record<string, unknown>> => {
  if (Array.isArray(value)) {
    return value as Array<Record<string, unknown>>;
  }
  return fallback;
};

export const createAdminApiServiceHandlers = (
  deps: CreateAdminApiServiceHandlersDependencies,
): AdminApiServiceHandlers => {
  const {
    repositories,
    now,
    requireAdminPrincipal,
    requireDb,
    parseJsonBody,
    writeError,
    writeSuccess,
  } = deps;

  const handleAdminApiServicesList = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for admin api-services list');
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

    const services = await listApiServices(db);
    const data = services.map((service) => toApiServiceRedactedDto(service, service.accessMode === 'token'));
    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, { apiServices: data });
  };

  const handleAdminApiServicesCreate = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for admin api-services create');
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

    const key = typeof body.key === 'string' ? body.key.trim() : '';
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '';
    const resourcePath = typeof body.resourcePath === 'string' ? body.resourcePath.trim() : '';
    const accessMode = parseAccessMode(body.accessMode);
    const timeoutMs = typeof body.timeoutMs === 'number' ? body.timeoutMs : undefined;
    const retryCount = typeof body.retryCount === 'number' ? body.retryCount : undefined;
    const requestMethod = body.requestMethod === undefined ? 'GET' : parseRequestMethod(body.requestMethod);
    const requestTemplateJson = asRecordOrDefault(body.requestTemplateJson, {});
    const requestMappingRulesJson = asArrayOrDefault(body.requestMappingRulesJson, []);
    const requestHeadersTemplateJson = asRecordOrDefault(body.requestHeadersTemplateJson, {});
    const responseMappingRulesJson = asArrayOrDefault(body.responseMappingRulesJson, []);
    const errorMappingRulesJson = asArrayOrDefault(body.errorMappingRulesJson, []);
    const contractProfileVersion = typeof body.contractProfileVersion === 'number'
      ? body.contractProfileVersion
      : 1;
    const tokenRef = typeof body.tokenRef === 'string' ? body.tokenRef.trim() : null;
    const tokenHeaderName = normalizeTokenHeaderName(
      typeof body.tokenHeaderName === 'string' ? body.tokenHeaderName : null,
    );

    if (!accessMode) {
      writeError(response, 400, 'bad_request', 'accessMode must be public or token');
      return;
    }

    if (!requestMethod) {
      writeError(response, 400, 'bad_request', 'requestMethod must be GET, POST, PUT, PATCH, or DELETE');
      return;
    }

    const validationErrors = validateApiServiceInput({
      key,
      label,
      baseUrl,
      resourcePath,
      accessMode,
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      ...(retryCount !== undefined ? { retryCount } : {}),
      ...(tokenRef !== null ? { tokenRef } : {}),
      ...(tokenHeaderName !== null ? { tokenHeaderName } : {}),
    });

    if (validationErrors.length > 0) {
      writeError(response, 400, 'bad_request', validationErrors.join('; '));
      return;
    }

    const service = await createApiService(db, {
      key,
      label,
      baseUrl,
      resourcePath,
      accessMode,
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      ...(retryCount !== undefined ? { retryCount } : {}),
      requestMethod,
      requestTemplateJson,
      requestMappingRulesJson,
      requestHeadersTemplateJson,
      responseMappingRulesJson,
      errorMappingRulesJson,
      contractProfileVersion,
      tokenRef,
      tokenHeaderName,
      status: 'active',
    });

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 201, {
      apiService: toApiServiceRedactedDto(service, service.accessMode === 'token'),
    });
  };

  const handleAdminApiServicesUpdate = async (
    request: IncomingMessage,
    response: ServerResponse,
    serviceId: string,
  ): Promise<void> => {
    if (request.method !== 'PUT') {
      writeError(response, 405, 'method_not_allowed', 'Use PUT for admin api-services update');
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

    const payload: {
      key?: string;
      label?: string;
      baseUrl?: string;
      resourcePath?: string;
      accessMode?: ApiServiceAccessMode;
      timeoutMs?: number;
      retryCount?: number;
      tokenRef?: string | null;
      tokenHeaderName?: string | null;
      status?: ApiServiceStatus;
      requestMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      requestTemplateJson?: Record<string, unknown>;
      requestMappingRulesJson?: Array<Record<string, unknown>>;
      requestHeadersTemplateJson?: Record<string, unknown>;
      responseMappingRulesJson?: Array<Record<string, unknown>>;
      errorMappingRulesJson?: Array<Record<string, unknown>>;
      contractProfileVersion?: number;
    } = {};

    if (body.key !== undefined) {
      if (typeof body.key !== 'string') {
        writeError(response, 400, 'bad_request', 'key must be a string');
        return;
      }
      payload.key = body.key.trim();
    }

    if (body.label !== undefined) {
      if (typeof body.label !== 'string') {
        writeError(response, 400, 'bad_request', 'label must be a string');
        return;
      }
      payload.label = body.label.trim();
    }

    if (body.baseUrl !== undefined) {
      if (typeof body.baseUrl !== 'string') {
        writeError(response, 400, 'bad_request', 'baseUrl must be a string');
        return;
      }
      payload.baseUrl = body.baseUrl.trim();
    }

    if (body.resourcePath !== undefined) {
      if (typeof body.resourcePath !== 'string') {
        writeError(response, 400, 'bad_request', 'resourcePath must be a string');
        return;
      }
      payload.resourcePath = body.resourcePath.trim();
    }

    if (body.accessMode !== undefined) {
      const accessMode = parseAccessMode(body.accessMode);
      if (!accessMode) {
        writeError(response, 400, 'bad_request', 'accessMode must be public or token');
        return;
      }
      payload.accessMode = accessMode;
    }

    if (body.timeoutMs !== undefined) {
      if (typeof body.timeoutMs !== 'number') {
        writeError(response, 400, 'bad_request', 'timeoutMs must be a number');
        return;
      }
      payload.timeoutMs = body.timeoutMs;
    }

    if (body.retryCount !== undefined) {
      if (typeof body.retryCount !== 'number') {
        writeError(response, 400, 'bad_request', 'retryCount must be a number');
        return;
      }
      payload.retryCount = body.retryCount;
    }

    if (body.tokenRef !== undefined) {
      if (body.tokenRef !== null && typeof body.tokenRef !== 'string') {
        writeError(response, 400, 'bad_request', 'tokenRef must be a string or null');
        return;
      }
      payload.tokenRef = body.tokenRef === null ? null : body.tokenRef.trim();
    }

    if (body.tokenHeaderName !== undefined) {
      if (body.tokenHeaderName !== null && typeof body.tokenHeaderName !== 'string') {
        writeError(response, 400, 'bad_request', 'tokenHeaderName must be a string or null');
        return;
      }
      payload.tokenHeaderName = normalizeTokenHeaderName(
        body.tokenHeaderName === null ? null : body.tokenHeaderName,
      );
    }

    if (body.status !== undefined) {
      const status = parseStatus(body.status);
      if (!status) {
        writeError(response, 400, 'bad_request', 'status must be active or inactive');
        return;
      }
      payload.status = status;
    }

    if (body.requestMethod !== undefined) {
      const requestMethod = parseRequestMethod(body.requestMethod);
      if (!requestMethod) {
        writeError(response, 400, 'bad_request', 'requestMethod must be GET, POST, PUT, PATCH, or DELETE');
        return;
      }
      payload.requestMethod = requestMethod;
    }

    if (body.requestTemplateJson !== undefined) {
      if (!body.requestTemplateJson || typeof body.requestTemplateJson !== 'object' || Array.isArray(body.requestTemplateJson)) {
        writeError(response, 400, 'bad_request', 'requestTemplateJson must be an object');
        return;
      }
      payload.requestTemplateJson = body.requestTemplateJson as Record<string, unknown>;
    }

    if (body.requestMappingRulesJson !== undefined) {
      if (!Array.isArray(body.requestMappingRulesJson)) {
        writeError(response, 400, 'bad_request', 'requestMappingRulesJson must be an array');
        return;
      }
      payload.requestMappingRulesJson = body.requestMappingRulesJson as Array<Record<string, unknown>>;
    }

    if (body.requestHeadersTemplateJson !== undefined) {
      if (
        !body.requestHeadersTemplateJson
        || typeof body.requestHeadersTemplateJson !== 'object'
        || Array.isArray(body.requestHeadersTemplateJson)
      ) {
        writeError(response, 400, 'bad_request', 'requestHeadersTemplateJson must be an object');
        return;
      }
      payload.requestHeadersTemplateJson = body.requestHeadersTemplateJson as Record<string, unknown>;
    }

    if (body.responseMappingRulesJson !== undefined) {
      if (!Array.isArray(body.responseMappingRulesJson)) {
        writeError(response, 400, 'bad_request', 'responseMappingRulesJson must be an array');
        return;
      }
      payload.responseMappingRulesJson = body.responseMappingRulesJson as Array<Record<string, unknown>>;
    }

    if (body.errorMappingRulesJson !== undefined) {
      if (!Array.isArray(body.errorMappingRulesJson)) {
        writeError(response, 400, 'bad_request', 'errorMappingRulesJson must be an array');
        return;
      }
      payload.errorMappingRulesJson = body.errorMappingRulesJson as Array<Record<string, unknown>>;
    }

    if (body.contractProfileVersion !== undefined) {
      if (typeof body.contractProfileVersion !== 'number') {
        writeError(response, 400, 'bad_request', 'contractProfileVersion must be a number');
        return;
      }
      payload.contractProfileVersion = body.contractProfileVersion;
    }

    const current = await getApiServiceById(db, serviceId);
    if (!current) {
      writeError(response, 404, 'not_found', 'ApiService not found');
      return;
    }

    const candidate = {
      key: payload.key ?? current.key,
      label: payload.label ?? current.label,
      baseUrl: payload.baseUrl ?? current.baseUrl,
      resourcePath: payload.resourcePath ?? current.resourcePath,
      accessMode: payload.accessMode ?? current.accessMode,
      timeoutMs: payload.timeoutMs ?? current.timeoutMs,
      retryCount: payload.retryCount ?? current.retryCount,
      tokenRef: payload.tokenRef ?? current.tokenRef,
      tokenHeaderName: payload.tokenHeaderName ?? current.tokenHeaderName,
    };

    const validationErrors = validateApiServiceInput(candidate);
    if (validationErrors.length > 0) {
      writeError(response, 400, 'bad_request', validationErrors.join('; '));
      return;
    }

    const updated = await updateApiService(db, serviceId, payload);
    if (!updated) {
      writeError(response, 404, 'not_found', 'ApiService not found');
      return;
    }

    await repositories.sessions.touchSession(principal.session.id, now());
    writeSuccess(response, 200, {
      apiService: toApiServiceRedactedDto(updated, updated.accessMode === 'token'),
    });
  };

  const handleAdminApiServicesDelete = async (
    request: IncomingMessage,
    response: ServerResponse,
    serviceId: string,
  ): Promise<void> => {
    if (request.method !== 'DELETE') {
      writeError(response, 405, 'method_not_allowed', 'Use DELETE for admin api-services delete');
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

    const deleted = await deleteApiService(db, serviceId);
    if (!deleted) {
      writeError(response, 404, 'not_found', 'ApiService not found');
      return;
    }

    await repositories.sessions.touchSession(principal.session.id, now());
    response.statusCode = 204;
    response.end('');
  };

  return {
    handleAdminApiServicesList,
    handleAdminApiServicesCreate,
    handleAdminApiServicesUpdate,
    handleAdminApiServicesDelete,
  };
};
