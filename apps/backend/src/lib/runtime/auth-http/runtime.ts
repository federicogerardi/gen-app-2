import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Pool } from 'pg';
import type {
  AuthRepositoryBundle,
  UserQueryRepositoryBundle,
} from '../../adapters/auth';
import type {
  IdempotencyAdapter,
  OrchestrateArtifactCache,
} from '../../adapters/generation';
import type {
  AuthSessionPrincipal,
} from '../../types/auth';
import { createComponentLogger, LogComponent } from '../log-components';
import {
  DEFAULT_SESSION_TTL_MS,
  getClientIp,
  isSessionPrincipalActive,
  parseAuthUserRole,
  parseAuthUserStatus,
  parseJsonBody,
  parseLoginBody,
  parseOptionalNonEmptyString,
  parseRequestUrl,
  sessionToResponseData,
  userToResponseData,
  writeError,
  writeSuccess,
} from './support';
import {
  createDefaultAuthIdGenerator,
  createGoogleOAuthRuntimeFromEnv,
  createDefaultPasswordHashRuntime,
  createDefaultSessionCookieRuntime,
  type AuthIdGenerator,
  type GoogleOAuthRuntime,
  type PasswordHashRuntime,
  type SessionCookieRuntime,
} from '../auth-contract';
import { createAuthHandlers } from './auth/auth-handlers';
import { createProjectsHandlers } from './projects/projects-handlers';
import { createPublicHandlers } from './auth/public-handlers';
import {
  buildRouteTable,
  dispatchRequest,
  type HandleAuthHttpRequestResult,
} from './route-table';
import { createToolsHandlers } from './tools/tools-handlers';
import {
  resolveToolsHydrateArtifactScanLimit,
  resolveToolsOrchestrateArtifactScanLimit,
  resolveToolsOrchestrateTimeoutMs,
} from './tools/tools-orchestrate-config';
import { createAdminHandlers } from './admin/admin-handlers';
import { assertGitHubApiConfig, readGitHubApiConfigFromEnv } from '../integrations/github-config';

export type { HandleAuthHttpRequestResult } from './route-table';

export type AuthHttpRuntimeOptions = {
  repositories: AuthRepositoryBundle;
  queryRepositories?: UserQueryRepositoryBundle;
  idempotency?: IdempotencyAdapter;
  orchestrateCache?: OrchestrateArtifactCache | null;
  db?: Pool;
  sessionCookies?: SessionCookieRuntime;
  passwordHashing?: PasswordHashRuntime;
  googleOAuth?: GoogleOAuthRuntime | null;
  googleOAuthStateTtlMs?: number;
  googleOAuthSuccessRedirectPath?: string;
  toolsOrchestrateTimeoutMs?: number;
  toolsOrchestrateArtifactScanLimit?: number;
  toolsHydrateArtifactScanLimit?: number;
  idGenerator?: AuthIdGenerator;
  now?: () => Date;
  sessionTtlMs?: number;
};

export const createAuthHttpRuntime = (
  options: AuthHttpRuntimeOptions,
): {
  handleRequest(request: IncomingMessage, response: ServerResponse): Promise<HandleAuthHttpRequestResult>;
} => {
  const repositories = options.repositories;
  const queryRepositories = options.queryRepositories;
  const db = options.db ?? null;
  const now = options.now ?? (() => new Date());
  const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const googleOAuthStateTtlMs = options.googleOAuthStateTtlMs ?? 10 * 60 * 1000;
  const googleOAuthSuccessRedirectPath = options.googleOAuthSuccessRedirectPath ?? '/';
  const toolsOrchestrateTimeoutMs = resolveToolsOrchestrateTimeoutMs(options.toolsOrchestrateTimeoutMs);
  const toolsOrchestrateArtifactScanLimit = resolveToolsOrchestrateArtifactScanLimit(
    options.toolsOrchestrateArtifactScanLimit,
  );
  const toolsHydrateArtifactScanLimit = resolveToolsHydrateArtifactScanLimit(
    options.toolsHydrateArtifactScanLimit,
  );
  const sessionCookies = options.sessionCookies ?? createDefaultSessionCookieRuntime();
  const passwordHashing = options.passwordHashing ?? createDefaultPasswordHashRuntime();
  const googleOAuth = options.googleOAuth ?? createGoogleOAuthRuntimeFromEnv();
  const idempotency = options.idempotency ?? null;
  const orchestrateCache = options.orchestrateCache ?? null;
  const githubApiConfig = readGitHubApiConfigFromEnv();
  assertGitHubApiConfig(githubApiConfig);
  const idGenerator = options.idGenerator ?? createDefaultAuthIdGenerator();

  const readPrincipalFromCookie = async (
    request: IncomingMessage,
  ): Promise<AuthSessionPrincipal | null> => {
    const sessionToken = sessionCookies.readSessionToken(request);
    if (!sessionToken) {
      return null;
    }

    const sessionTokenHash = passwordHashing.hashSessionToken(sessionToken);
    const principal = await repositories.sessions.getSessionByTokenHash(sessionTokenHash);
    if (!principal) {
      return null;
    }

    if (!isSessionPrincipalActive(principal, now())) {
      return null;
    }

    return principal;
  };

  const requireAdminPrincipal = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<AuthSessionPrincipal | null> => {
    const principal = await readPrincipalFromCookie(request);
    if (!principal) {
      sessionCookies.clearSessionCookie(response);
      writeError(response, 401, 'unauthorized', 'No active session');
      return null;
    }

    if (principal.user.role !== 'admin') {
      writeError(response, 403, 'forbidden', 'Admin scope required');
      return null;
    }

    return principal;
  };

  const requireSessionPrincipal = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<AuthSessionPrincipal | null> => {
    const principal = await readPrincipalFromCookie(request);
    if (!principal) {
      sessionCookies.clearSessionCookie(response);
      writeError(response, 401, 'unauthorized', 'No active session');
      return null;
    }

    return principal;
  };

  const requireQueryRepositories = (response: ServerResponse): UserQueryRepositoryBundle | null => {
    if (!queryRepositories) {
      writeError(response, 503, 'service_unavailable', 'Query repositories are not configured');
      return null;
    }

    return queryRepositories;
  };

  // ── LlmModelCatalog handlers ─────────────────────────────────────────────

  const requireDb = (response: ServerResponse): Pool | null => {
    if (!db) {
      writeError(response, 503, 'service_unavailable', 'Model catalog is not configured');
      return null;
    }
    return db;
  };

  const authHandlers = createAuthHandlers({
    repositories,
    now,
    sessionTtlMs,
    googleOAuthStateTtlMs,
    googleOAuthSuccessRedirectPath,
    sessionCookies,
    passwordHashing,
    googleOAuth,
    idGenerator,
    parseLoginBody,
    readPrincipalFromCookie,
    getClientIp,
    parseRequestUrl,
    sessionToResponseData,
    writeError,
    writeSuccess,
  });

  const projectsHandlers = createProjectsHandlers({
    repositories,
    now,
    parseRequestUrl,
    parseJsonBody,
    requireSessionPrincipal,
    requireQueryRepositories,
    writeError,
    writeSuccess,
  });

  const publicHandlers = createPublicHandlers({
    repositories,
    now,
    requireSessionPrincipal,
    requireDb,
  });

  const toolsHandlers = createToolsHandlers({
    repositories,
    idempotency,
    orchestrateCache,
    now,
    toolsOrchestrateTimeoutMs,
    toolsOrchestrateArtifactScanLimit,
    toolsHydrateArtifactScanLimit,
    requireDb,
    parseRequestUrl,
    parseJsonBody,
    requireSessionPrincipal,
    requireQueryRepositories,
    writeError,
    writeSuccess,
  });

  const adminHandlers = createAdminHandlers({
    repositories,
    passwordHashing,
    now,
    githubApiConfig,
    requireAdminPrincipal,
    requireDb,
    requireQueryRepositories,
    parseJsonBody,
    parseOptionalNonEmptyString,
    parseRequestUrl,
    parseAuthUserRole,
    parseAuthUserStatus,
    userToResponseData,
    writeError,
    writeSuccess,
  });

  const routeTable = buildRouteTable({
    authHandlers,
    adminHandlers,
    projectsHandlers,
    publicHandlers,
    toolsHandlers,
  });

  return {
    async handleRequest(
      request: IncomingMessage,
      response: ServerResponse,
    ): Promise<HandleAuthHttpRequestResult> {
      try {
        return await dispatchRequest(routeTable, request, response, writeError);
      } catch (err) {
        const log = createComponentLogger(LogComponent.NODE_SERVER);
        log.error({ err, method: request.method, url: request.url }, 'auth-http unhandled error');
        if (!response.writableEnded && !response.destroyed) {
          writeError(response, 500, 'internal', 'Internal server error');
        }

        return { handled: true };
      }
    },
  };
};
