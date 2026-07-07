import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import type { GenerationAdapters } from '../adapters';
import {
  handleGenerationRequestAsNodeSse,
  handleGenerationRequestAsJson,
} from './generation-handler';
import type { BackendGenerationRequest } from './request-contract';
import {
  getHeaderValue,
  normalizePath,
  writeJson,
} from './http-utils';
import {
  parseGenerationRequest,
} from './generation-request-node';
import {
  applyModelAvailabilityGuard,
  applyOwnershipGuard,
  applyRequestContractGuard,
} from './generation-entry-guards';
import {
  buildGenerationDebugInfo,
  createCorrelationId,
  logGenerationRequestDebug,
  logGenerationStreamError,
  logModelCheckDebug,
} from './generation-stream-observability';
import type { StepLlmModelResolver } from './step-llm-model-resolver';
import type {
  HandleAuthHttpRequestResult,
} from './auth-http';

const DEFAULT_CORS_METHODS = ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'];
const DEFAULT_CORS_HEADERS = ['Content-Type', 'Authorization', 'X-Requested-With'];

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
  generationRunRoutePath?: string;
  debugGenerationLogs?: boolean;
  checkProjectOwnership?: (
    userId: string,
    projectId: string,
    correlationId?: string,
  ) => Promise<{ owned: boolean; reason?: 'ownership_forbidden' | 'project_not_found' | string }>;
  /**
    * Async function that checks whether a given LlmModelId is available.
   * Returns true if the model key exists in the enabled LlmModelCatalog, false otherwise.
   * DDD-055: LlmModelCatalog validation gate; DDD-056: LlmModelId.
   */
    checkModelAvailability: (modelKey: string, correlationId?: string) => Promise<boolean>;
  /**
   * StepLlmModelResolver for per-step model override resolution.
   * DDD-151: StepLlmModelResolver (Domain Service, Generation context).
   */
  modelResolver?: StepLlmModelResolver;
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

const normalizeOrigin = (origin: string): string => {
  return origin.trim().replace(/\/$/, '');
};

const hasWildcardOrigin = (allowedOrigins: string[]): boolean => {
  return allowedOrigins.includes('*');
};

const isOriginAllowed = (origin: string | null, allowedOrigins: string[]): boolean => {
  if (!origin) {
    return false;
  }

  if (hasWildcardOrigin(allowedOrigins)) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  return allowedOrigins.some((candidate) => {
    return normalizeOrigin(candidate) === normalizedOrigin;
  });
};

const applyCorsHeaders = (
  request: IncomingMessage,
  response: ServerResponse,
  cors: NonNullable<NodeRuntimeServerOptions['cors']>,
): void => {
  const allowCredentials = cors.allowCredentials ?? true;
  if (!allowCredentials && hasWildcardOrigin(cors.allowedOrigins)) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', (cors.allowMethods ?? DEFAULT_CORS_METHODS).join(', '));
    response.setHeader('Access-Control-Allow-Headers', (cors.allowHeaders ?? DEFAULT_CORS_HEADERS).join(', '));
    response.setHeader('Access-Control-Max-Age', String(cors.maxAgeSeconds ?? 600));
    return;
  }

  const requestOrigin = getHeaderValue(request.headers.origin as string | string[] | undefined);
  if (!isOriginAllowed(requestOrigin, cors.allowedOrigins)) {
    return;
  }

  response.setHeader('Access-Control-Allow-Origin', requestOrigin as string);
  response.setHeader('Vary', 'Origin');

  if (allowCredentials) {
    response.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  response.setHeader('Access-Control-Allow-Methods', (cors.allowMethods ?? DEFAULT_CORS_METHODS).join(', '));
  response.setHeader('Access-Control-Allow-Headers', (cors.allowHeaders ?? DEFAULT_CORS_HEADERS).join(', '));
  response.setHeader('Access-Control-Max-Age', String(cors.maxAgeSeconds ?? 600));
};

const isCsrfProtectedMethod = (
  method: string,
  protectedMethods: string[],
): boolean => {
  return protectedMethods.includes(method.toUpperCase());
};

/**
 * Resolves and normalizes the CSRF trusted origins from the provided options.
 * Resolution priority: csrf.trustedOrigins → cors.allowedOrigins → [] (empty).
 * Values are trimmed and de-duplicated; trailing slashes are removed via normalizeOrigin.
 */
const resolveCsrfTrustedOrigins = (options: NodeRuntimeServerOptions): string[] => {
  const raw = options.csrf?.trustedOrigins ?? options.cors?.allowedOrigins ?? [];
  const normalized = raw.map(normalizeOrigin);
  return [...new Set(normalized)];
};

export const createNodeRuntimeRequestHandler = (
  options: NodeRuntimeServerOptions,
): ((request: IncomingMessage, response: ServerResponse) => Promise<void>) => {
  if (
    (options.cors?.allowCredentials ?? true)
    && (options.cors?.allowedOrigins ? hasWildcardOrigin(options.cors.allowedOrigins) : false)
  ) {
    throw new Error('Invalid CORS configuration: allowedOrigins cannot include "*" when credentials are enabled');
  }

  const generationRoutePath = options.generationRoutePath ?? '/generation/stream';
  const generationRunRoutePath = options.generationRunRoutePath ?? '/generation/run';
  const csrfEnabled = options.csrf?.enabled ?? true;
  const csrfProtectedMethods = options.csrf?.protectedMethods ?? ['POST', 'PATCH', 'PUT', 'DELETE'];
  const csrfExcludePaths = options.csrf?.excludePaths ?? ['/auth/login', '/auth/google/start', '/auth/google/callback'];
  // Canonical resolution of CSRF trusted origins — single path used at both startup and request time.
  const csrfTrustedOrigins = resolveCsrfTrustedOrigins(options);
  const debugGenerationLogs = options.debugGenerationLogs ?? false;
  const shouldLogRequestLifecycle = debugGenerationLogs || process.env.NODE_ENV !== 'production';

  // Startup invariants: fail fast rather than silently disabling CSRF at request time (fail-closed policy).
  // Deferring these checks to per-request execution would allow a misconfigured server to silently
  // bypass CSRF protection for every request when origins are empty or a wildcard is present.
  if (csrfEnabled && csrfTrustedOrigins.length === 0) {
    throw new Error('Invalid CSRF configuration: trustedOrigins must be non-empty when CSRF is enabled');
  }

  if (csrfEnabled && csrfTrustedOrigins.includes('*')) {
    throw new Error('Invalid CSRF configuration: trustedOrigins cannot include "*" when CSRF is enabled');
  }

  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const path = normalizePath(request.url);
    const method = request.method ?? 'UNKNOWN';
    const origin = getHeaderValue(request.headers.origin as string | string[] | undefined) ?? '(no origin)';
    if (shouldLogRequestLifecycle) {
      console.log(`[req] ${method} ${path} origin=${origin}`);
    }

    if (shouldLogRequestLifecycle) {
      response.on('finish', () => {
        console.log(`[res] ${method} ${path} → ${response.statusCode}`);
      });
    }

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

    if (path !== generationRoutePath && path !== generationRunRoutePath) {
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
          message: 'Use POST for generation',
        },
      });
      return;
    }

    let generationRequest: BackendGenerationRequest;
    try {
      generationRequest = await parseGenerationRequest(request, options.mapGenerationRequest);
    } catch (error) {
      console.warn('[gen][bad_request] unable to parse generation request', {
        path,
        method,
        reason: error instanceof Error ? error.message : 'invalid_generation_request',
      });
      writeJson(response, 400, {
        ok: false,
        error: {
          code: 'bad_request',
          message: error instanceof Error ? error.message : 'invalid_generation_request',
        },
      });
      return;
    }

    const correlationId = createCorrelationId(generationRequest.requestId);
    const debugInfo = buildGenerationDebugInfo(generationRequest);

    if (debugGenerationLogs) {
      logGenerationRequestDebug(correlationId, generationRequest, debugInfo);
    }

    // TASK-001: Ownership guard at generation entrypoint.
    const ownershipAllowed = await applyOwnershipGuard(
      response,
      generationRequest,
      correlationId,
      options.checkProjectOwnership,
    );
    if (!ownershipAllowed) {
      return;
    }

    // TASK-010: LlmModelCatalog model availability check (DDD-055, DDD-056).
    // Dispatches MODEL_AVAILABLE / MODEL_UNAVAILABLE logic from requestGatewayMachine.
    const modelGuard = await applyModelAvailabilityGuard(
      response,
      generationRequest,
      correlationId,
      options.checkModelAvailability,
    );
    if (debugGenerationLogs && modelGuard.isAvailable !== null) {
      logModelCheckDebug(correlationId, generationRequest, debugInfo.normalizedModel, modelGuard.isAvailable);
    }
    if (!modelGuard.allowed) {
      return;
    }

    if (!applyRequestContractGuard(response, generationRequest)) {
      return;
    }

    try {
      if (path === generationRunRoutePath) {
        const result = await handleGenerationRequestAsJson(generationRequest, options.generationAdapters, {
          modelResolver: options.modelResolver,
        });
        if (result.ok) {
          writeJson(response, 200, result);
        } else {
          writeJson(response, 500, result);
        }
      } else {
        await handleGenerationRequestAsNodeSse(response, generationRequest, options.generationAdapters, {
          modelResolver: options.modelResolver,
        });
      }
    } catch (error) {
      logGenerationStreamError(correlationId, generationRequest, debugInfo, error);
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
