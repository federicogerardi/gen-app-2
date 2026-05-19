import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';
import type {
  AuthRepositoryBundle,
  IdempotencyAdapter,
  UserQueryRepositoryBundle,
} from '../../adapters';
import type {
  AuthSessionPrincipal,
  AuthUserRole,
  AuthUserStatus,
  UpdateAuthUserInput,
} from '../../types/auth';
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
  isSupportedToolWorkflow,
  extractStepFromArtifactInput,
} from '../tool-workflow-registry';
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
import { normalizePath } from '../http-utils';
import { createAuthHandlers } from './auth-handlers';
import {
  createProjectsHandlers,
  parseArtifactReadProjection,
} from './projects-handlers';
import { createPublicHandlers } from './public-handlers';
import {
  buildRouteTable,
  dispatchRequest,
  type HandleAuthHttpRequestResult,
} from './route-table';
import { createToolsHandlers } from './tools-handlers';
import { createAdminHandlers } from './admin-handlers';
import { assertGitHubApiConfig, readGitHubApiConfigFromEnv } from '../integrations/github-config';

export type { HandleAuthHttpRequestResult } from './route-table';

export type AuthHttpRuntimeOptions = {
  repositories: AuthRepositoryBundle;
  queryRepositories?: UserQueryRepositoryBundle;
  idempotency?: IdempotencyAdapter;
  db?: Pool;
  sessionCookies?: SessionCookieRuntime;
  passwordHashing?: PasswordHashRuntime;
  googleOAuth?: GoogleOAuthRuntime | null;
  googleOAuthStateTtlMs?: number;
  googleOAuthSuccessRedirectPath?: string;
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
  const sessionCookies = options.sessionCookies ?? createDefaultSessionCookieRuntime();
  const passwordHashing = options.passwordHashing ?? createDefaultPasswordHashRuntime();
  const googleOAuth = options.googleOAuth ?? createGoogleOAuthRuntimeFromEnv();
  const idempotency = options.idempotency ?? null;
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

  const LLM_MODEL_KEY_REGEX = /^[a-zA-Z0-9/_\-.]+$/;

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
    now,
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
    writeError,
  });

  return {
    async handleRequest(
      request: IncomingMessage,
      response: ServerResponse,
    ): Promise<HandleAuthHttpRequestResult> {
      try {
        return await dispatchRequest(routeTable, request, response);
      } catch (err) {
        console.error(`[auth-http] unhandled error for ${request.method} ${request.url}:`, err);
        if (!response.writableEnded && !response.destroyed) {
          writeError(response, 500, 'internal', 'Internal server error');
        }

        return { handled: true };
      }
    },
  };
};
