import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Pool } from 'pg';
import { z } from 'zod';

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
import {
  arrayPayload,
  boundedInteger,
  enumValue,
  formatZodIssuesForBadRequest,
  nonEmptyTrimmedString,
  objectPayload,
} from './zod-support';

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

const TOKEN_HEADER_NAME_REGEX = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,128}$/;

const apiServiceAccessModeSchema = enumValue(['public', 'token'], 'accessMode');
const apiServiceStatusSchema = enumValue(['active', 'inactive'], 'status');
const apiServiceRequestMethodSchema = enumValue(
  ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  'requestMethod',
);
const tokenHeaderNameSchema = nonEmptyTrimmedString('tokenHeaderName').refine(
  (value) => TOKEN_HEADER_NAME_REGEX.test(value),
  'tokenHeaderName must be a valid HTTP header name',
);

const adminApiServiceCreateSchema = z.object({
  key: nonEmptyTrimmedString('key'),
  label: nonEmptyTrimmedString('label'),
  baseUrl: nonEmptyTrimmedString('baseUrl'),
  resourcePath: nonEmptyTrimmedString('resourcePath'),
  accessMode: apiServiceAccessModeSchema,
  timeoutMs: boundedInteger('timeoutMs', 100, 120000).optional(),
  retryCount: boundedInteger('retryCount', 0, 5).optional(),
  requestMethod: apiServiceRequestMethodSchema.optional().default('GET'),
  requestTemplateJson: objectPayload('requestTemplateJson').default({}),
  requestMappingRulesJson: arrayPayload('requestMappingRulesJson').default([]),
  requestHeadersTemplateJson: objectPayload('requestHeadersTemplateJson').default({}),
  responseMappingRulesJson: arrayPayload('responseMappingRulesJson').default([]),
  errorMappingRulesJson: arrayPayload('errorMappingRulesJson').default([]),
  contractProfileVersion: boundedInteger('contractProfileVersion', 1, Number.MAX_SAFE_INTEGER)
    .optional()
    .default(1),
  tokenRef: z.union([nonEmptyTrimmedString('tokenRef'), z.null()]).optional().transform((value) => value ?? null),
  tokenHeaderName: z.union([tokenHeaderNameSchema, z.null()]).optional().transform((value) => {
    if (value === undefined) {
      return null;
    }

    return normalizeTokenHeaderName(value);
  }),
  status: apiServiceStatusSchema.optional().default('active'),
});

const adminApiServiceUpdateSchema = z.object({
  key: nonEmptyTrimmedString('key').optional(),
  label: nonEmptyTrimmedString('label').optional(),
  baseUrl: nonEmptyTrimmedString('baseUrl').optional(),
  resourcePath: nonEmptyTrimmedString('resourcePath').optional(),
  accessMode: apiServiceAccessModeSchema.optional(),
  timeoutMs: boundedInteger('timeoutMs', 100, 120000).optional(),
  retryCount: boundedInteger('retryCount', 0, 5).optional(),
  tokenRef: z.union([nonEmptyTrimmedString('tokenRef'), z.null()]).optional(),
  tokenHeaderName: z.union([tokenHeaderNameSchema, z.null()]).optional().transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    return normalizeTokenHeaderName(value);
  }),
  status: apiServiceStatusSchema.optional(),
  requestMethod: apiServiceRequestMethodSchema.optional(),
  requestTemplateJson: objectPayload('requestTemplateJson').optional(),
  requestMappingRulesJson: arrayPayload('requestMappingRulesJson').optional(),
  requestHeadersTemplateJson: objectPayload('requestHeadersTemplateJson').optional(),
  responseMappingRulesJson: arrayPayload('responseMappingRulesJson').optional(),
  errorMappingRulesJson: arrayPayload('errorMappingRulesJson').optional(),
  contractProfileVersion: boundedInteger('contractProfileVersion', 1, Number.MAX_SAFE_INTEGER).optional(),
});

type AdminApiServiceCreateBody = z.infer<typeof adminApiServiceCreateSchema>;
type AdminApiServiceUpdateBody = z.infer<typeof adminApiServiceUpdateSchema>;


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

    let rawBody: unknown;
    try {
      rawBody = await parseJsonBody<unknown>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const parsedBody = adminApiServiceCreateSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      writeError(response, 400, 'bad_request', formatZodIssuesForBadRequest(parsedBody.error.issues));
      return;
    }

    const body: AdminApiServiceCreateBody = parsedBody.data;

    const validationErrors = validateApiServiceInput({
      key: body.key,
      label: body.label,
      baseUrl: body.baseUrl,
      resourcePath: body.resourcePath,
      accessMode: body.accessMode,
      ...(body.timeoutMs !== undefined ? { timeoutMs: body.timeoutMs } : {}),
      ...(body.retryCount !== undefined ? { retryCount: body.retryCount } : {}),
      ...(body.tokenRef !== null ? { tokenRef: body.tokenRef } : {}),
      ...(body.tokenHeaderName !== null ? { tokenHeaderName: body.tokenHeaderName } : {}),
    });

    if (validationErrors.length > 0) {
      writeError(response, 400, 'bad_request', validationErrors.join('; '));
      return;
    }

    const service = await createApiService(db, {
      key: body.key,
      label: body.label,
      baseUrl: body.baseUrl,
      resourcePath: body.resourcePath,
      accessMode: body.accessMode,
      ...(body.timeoutMs !== undefined ? { timeoutMs: body.timeoutMs } : {}),
      ...(body.retryCount !== undefined ? { retryCount: body.retryCount } : {}),
      requestMethod: body.requestMethod,
      requestTemplateJson: body.requestTemplateJson,
      requestMappingRulesJson: body.requestMappingRulesJson as Array<Record<string, unknown>>,
      requestHeadersTemplateJson: body.requestHeadersTemplateJson,
      responseMappingRulesJson: body.responseMappingRulesJson as Array<Record<string, unknown>>,
      errorMappingRulesJson: body.errorMappingRulesJson as Array<Record<string, unknown>>,
      contractProfileVersion: body.contractProfileVersion,
      tokenRef: body.tokenRef,
      tokenHeaderName: body.tokenHeaderName,
      status: body.status,
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

    let rawBody: unknown;
    try {
      rawBody = await parseJsonBody<unknown>(request);
    } catch {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const parsedBody = adminApiServiceUpdateSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      writeError(response, 400, 'bad_request', formatZodIssuesForBadRequest(parsedBody.error.issues));
      return;
    }

    const body: AdminApiServiceUpdateBody = parsedBody.data;
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
      payload.key = body.key;
    }

    if (body.label !== undefined) {
      payload.label = body.label;
    }

    if (body.baseUrl !== undefined) {
      payload.baseUrl = body.baseUrl;
    }

    if (body.resourcePath !== undefined) {
      payload.resourcePath = body.resourcePath;
    }

    if (body.accessMode !== undefined) {
      payload.accessMode = body.accessMode;
    }

    if (body.timeoutMs !== undefined) {
      payload.timeoutMs = body.timeoutMs;
    }

    if (body.retryCount !== undefined) {
      payload.retryCount = body.retryCount;
    }

    if (body.tokenRef !== undefined) {
      payload.tokenRef = body.tokenRef;
    }

    if (body.tokenHeaderName !== undefined) {
      payload.tokenHeaderName = body.tokenHeaderName;
    }

    if (body.status !== undefined) {
      payload.status = body.status;
    }

    if (body.requestMethod !== undefined) {
      payload.requestMethod = body.requestMethod;
    }

    if (body.requestTemplateJson !== undefined) {
      payload.requestTemplateJson = body.requestTemplateJson;
    }

    if (body.requestMappingRulesJson !== undefined) {
      payload.requestMappingRulesJson = body.requestMappingRulesJson as Array<Record<string, unknown>>;
    }

    if (body.requestHeadersTemplateJson !== undefined) {
      payload.requestHeadersTemplateJson = body.requestHeadersTemplateJson;
    }

    if (body.responseMappingRulesJson !== undefined) {
      payload.responseMappingRulesJson = body.responseMappingRulesJson as Array<Record<string, unknown>>;
    }

    if (body.errorMappingRulesJson !== undefined) {
      payload.errorMappingRulesJson = body.errorMappingRulesJson as Array<Record<string, unknown>>;
    }

    if (body.contractProfileVersion !== undefined) {
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
