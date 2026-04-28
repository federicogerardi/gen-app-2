import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { GenerationAdapters } from '../adapters';
import {
  handleGenerationRequestAsNodeSse,
  type BackendGenerationRequest,
} from './index';
import type {
  HandleAuthHttpRequestResult,
} from './auth-http';

const MAX_BODY_SIZE_BYTES = 256 * 1024;

export type AuthHttpRequestHandler = {
  handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<HandleAuthHttpRequestResult>;
};

export type NodeRuntimeServerOptions = {
  generationAdapters: GenerationAdapters;
  authRuntime: AuthHttpRequestHandler;
  generationRoutePath?: string;
  cors?: {
    allowedOrigins: string[];
    allowCredentials?: boolean;
    allowMethods?: string[];
    allowHeaders?: string[];
    maxAgeSeconds?: number;
  };
  csrf?: {
    enabled?: boolean;
    trustedOrigins?: string[];
    protectedMethods?: string[];
    excludePaths?: string[];
  };
  mapGenerationRequest?: (
    payload: Record<string, unknown>,
    request: IncomingMessage,
  ) => BackendGenerationRequest;
};

const normalizePath = (url: string | undefined): string => {
  if (!url) {
    return '/';
  }

  return url.split('?')[0] || '/';
};

const writeJson = (
  response: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
): void => {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
};

const getHeaderValue = (value: string | string[] | undefined): string | null => {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && value[0]) {
    return value[0];
  }

  return null;
};

const normalizeOrigin = (origin: string): string => {
  return origin.trim().replace(/\/$/, '');
};

const isOriginAllowed = (origin: string | null, allowedOrigins: string[]): boolean => {
  if (!origin) {
    return false;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  return allowedOrigins.some((candidate) => {
    if (candidate === '*') {
      return true;
    }

    return normalizeOrigin(candidate) === normalizedOrigin;
  });
};

const applyCorsHeaders = (
  request: IncomingMessage,
  response: ServerResponse,
  cors: NonNullable<NodeRuntimeServerOptions['cors']>,
): void => {
  const requestOrigin = getHeaderValue(request.headers.origin as string | string[] | undefined);
  if (!isOriginAllowed(requestOrigin, cors.allowedOrigins)) {
    return;
  }

  response.setHeader('Access-Control-Allow-Origin', requestOrigin as string);
  response.setHeader('Vary', 'Origin');

  if (cors.allowCredentials ?? true) {
    response.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  response.setHeader('Access-Control-Allow-Methods', (cors.allowMethods ?? ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']).join(', '));
  response.setHeader('Access-Control-Allow-Headers', (cors.allowHeaders ?? ['Content-Type', 'Authorization', 'X-Requested-With']).join(', '));
  response.setHeader('Access-Control-Max-Age', String(cors.maxAgeSeconds ?? 600));
};

const isCsrfProtectedMethod = (
  method: string,
  protectedMethods: string[],
): boolean => {
  return protectedMethods.includes(method.toUpperCase());
};

const readRequestBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  let totalSize = 0;

  await new Promise<void>((resolve, reject) => {
    request.on('data', (chunk: Buffer | string) => {
      const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalSize += chunkBuffer.length;
      if (totalSize > MAX_BODY_SIZE_BYTES) {
        reject(new Error('request_body_too_large'));
        return;
      }

      chunks.push(chunkBuffer);
    });

    request.on('end', () => resolve());
    request.on('error', reject);
  });

  return Buffer.concat(chunks).toString('utf8');
};

const requireStringField = (payload: Record<string, unknown>, field: string): string => {
  const value = payload[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`invalid_field:${field}`);
  }

  return value;
};

const requireObjectField = (payload: Record<string, unknown>, field: string): Record<string, unknown> => {
  const value = payload[field];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`invalid_field:${field}`);
  }

  return value as Record<string, unknown>;
};

const defaultMapGenerationRequest = (
  payload: Record<string, unknown>,
): BackendGenerationRequest => {
  const request: BackendGenerationRequest = {
    requestId: requireStringField(payload, 'requestId'),
    userId: requireStringField(payload, 'userId'),
    projectId: requireStringField(payload, 'projectId'),
    artifactType: requireStringField(payload, 'artifactType') as BackendGenerationRequest['artifactType'],
    model: requireStringField(payload, 'model'),
    input: requireObjectField(payload, 'input'),
    toolKey: typeof payload.toolKey === 'string' ? payload.toolKey : null,
    workflowType: typeof payload.workflowType === 'string' ? payload.workflowType : null,
  };

  if (typeof payload.idempotencyKey === 'string') {
    request.idempotencyKey = payload.idempotencyKey;
  }

  if (
    payload.outputFormat === 'json'
    || payload.outputFormat === 'markdown'
    || payload.outputFormat === 'plain'
  ) {
    request.outputFormat = payload.outputFormat;
  }

  if (typeof payload.registryVersion === 'string') {
    request.registryVersion = payload.registryVersion;
  }

  if (typeof payload.registrySnapshotRef === 'string') {
    request.registrySnapshotRef = payload.registrySnapshotRef;
  }

  return request;
};

const parseGenerationRequest = async (
  request: IncomingMessage,
  mapGenerationRequest: NodeRuntimeServerOptions['mapGenerationRequest'],
): Promise<BackendGenerationRequest> => {
  const rawBody = await readRequestBody(request);
  if (!rawBody || rawBody.trim().length === 0) {
    throw new Error('missing_body');
  }

  const parsed = JSON.parse(rawBody) as Record<string, unknown>;
  const mapper = mapGenerationRequest ?? defaultMapGenerationRequest;
  return mapper(parsed, request);
};

export const createNodeRuntimeRequestHandler = (
  options: NodeRuntimeServerOptions,
): ((request: IncomingMessage, response: ServerResponse) => Promise<void>) => {
  const generationRoutePath = options.generationRoutePath ?? '/generation/stream';
  const csrfEnabled = options.csrf?.enabled ?? true;
  const csrfProtectedMethods = options.csrf?.protectedMethods ?? ['POST', 'PATCH', 'PUT', 'DELETE'];
  const csrfExcludePaths = options.csrf?.excludePaths ?? ['/auth/login', '/auth/google/start', '/auth/google/callback'];
  const csrfTrustedOrigins = options.csrf?.trustedOrigins ?? options.cors?.allowedOrigins ?? [];

  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const path = normalizePath(request.url);
    const method = request.method ?? 'UNKNOWN';
    const origin = getHeaderValue(request.headers.origin as string | string[] | undefined) ?? '(no origin)';
    console.log(`[req] ${method} ${path} origin=${origin}`);

    response.on('finish', () => {
      console.log(`[res] ${method} ${path} → ${response.statusCode}`);
    });

    try {
    if (options.cors) {
      applyCorsHeaders(request, response, options.cors);
    }

    if (request.method === 'OPTIONS') {
      response.statusCode = 204;
      response.end('');
      return;
    }

    if (path === '/health' && (request.method === 'GET' || request.method === 'HEAD')) {
      if (request.method === 'HEAD') {
        response.statusCode = 200;
        response.end();
        return;
      }

      writeJson(response, 200, {
        ok: true,
        status: 'healthy',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (
      csrfEnabled
      && csrfTrustedOrigins.length > 0
      && isCsrfProtectedMethod(request.method ?? 'GET', csrfProtectedMethods)
      && !csrfExcludePaths.includes(path)
    ) {
      const origin = getHeaderValue(request.headers.origin as string | string[] | undefined);
      if (!isOriginAllowed(origin, csrfTrustedOrigins)) {
        writeJson(response, 403, {
          ok: false,
          error: {
            code: 'forbidden',
            message: 'CSRF origin check failed',
          },
        });
        return;
      }
    }

    const authResult = await options.authRuntime.handleRequest(request, response);
    if (authResult.handled) {
      return;
    }

    if (path !== generationRoutePath) {
      writeJson(response, 404, {
        ok: false,
        error: {
          code: 'not_found',
          message: 'Route not found',
        },
      });
      return;
    }

    if (request.method !== 'POST') {
      writeJson(response, 405, {
        ok: false,
        error: {
          code: 'method_not_allowed',
          message: 'Use POST for generation stream',
        },
      });
      return;
    }

    let generationRequest: BackendGenerationRequest;
    try {
      generationRequest = await parseGenerationRequest(request, options.mapGenerationRequest);
    } catch (error) {
      writeJson(response, 400, {
        ok: false,
        error: {
          code: 'bad_request',
          message: error instanceof Error ? error.message : 'invalid_generation_request',
        },
      });
      return;
    }

    try {
      await handleGenerationRequestAsNodeSse(response, generationRequest, options.generationAdapters);
    } catch {
      if (!response.writableEnded && !response.destroyed) {
        response.statusCode = 500;
        response.end();
      }
    }
    } catch (unhandled) {
      console.error(`[err] ${method} ${path}`, unhandled);
      if (!response.writableEnded && !response.destroyed) {
        writeJson(response, 500, { ok: false, error: { code: 'internal_error', message: 'Unexpected server error' } });
      }
    }
  };
};

export const createNodeRuntimeServer = (
  options: NodeRuntimeServerOptions,
): Server => {
  const requestHandler = createNodeRuntimeRequestHandler(options);
  return createServer((request, response) => {
    void requestHandler(request, response);
  });
};
