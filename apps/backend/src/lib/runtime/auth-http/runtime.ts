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
import { normalizeToolWorkflowKey } from '../workflow-normalizers';
import { createAuthHandlers } from './auth-handlers';
import {
  createProjectsHandlers,
  parseArtifactReadProjection,
} from './projects-handlers';
import { createPublicHandlers } from './public-handlers';
import { createToolsHandlers } from './tools-handlers';
import { createAdminHandlers } from './admin-handlers';
import {
  canPublishUserReportIssue,
  normalizeProductChangelogStatus,
  normalizeUserReportCategory,
  normalizeUserReportStatus,
} from '../feedback-center-policy';
import { assertGitHubApiConfig, readGitHubApiConfigFromEnv } from '../integrations/github-config';
import { publishGitHubIssue, PublishGitHubIssueError } from '../integrations/github-issues';

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

export type HandleAuthHttpRequestResult = {
  handled: boolean;
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

  return {
    async handleRequest(
      request: IncomingMessage,
      response: ServerResponse,
    ): Promise<HandleAuthHttpRequestResult> {
      const path = normalizePath(request.url);
      try {

      if (path === '/auth/login') {
        await authHandlers.handleLogin(request, response);
        return { handled: true };
      }

      if (path === '/auth/logout') {
        await authHandlers.handleLogout(request, response);
        return { handled: true };
      }

      if (path === '/auth/session') {
        await authHandlers.handleSession(request, response);
        return { handled: true };
      }

      if (path === '/auth/google/start') {
        await authHandlers.handleGoogleOAuthStart(request, response);
        return { handled: true };
      }

      if (path === '/auth/google/callback') {
        await authHandlers.handleGoogleOAuthCallback(request, response);
        return { handled: true };
      }

      if (path === '/admin/users') {
        if (request.method === 'GET') {
          await adminHandlers.handleAdminListUsers(request, response);
          return { handled: true };
        }

        if (request.method === 'POST') {
          await adminHandlers.handleAdminCreateUser(request, response);
          return { handled: true };
        }

        writeError(response, 405, 'method_not_allowed', 'Method not allowed for /admin/users');
        return { handled: true };
      }

      const adminUserMatch = path.match(/^\/admin\/users\/([^/]+)$/);
      if (adminUserMatch) {
        const userId = decodeURIComponent(adminUserMatch[1] ?? '');

        if (request.method === 'GET') {
          await adminHandlers.handleAdminGetUser(request, response, userId);
          return { handled: true };
        }

        if (request.method === 'PATCH') {
          await adminHandlers.handleAdminUpdateUser(request, response, userId);
          return { handled: true };
        }

        if (request.method === 'DELETE') {
          await adminHandlers.handleAdminDeleteUser(request, response, userId);
          return { handled: true };
        }

        writeError(response, 405, 'method_not_allowed', 'Method not allowed for /admin/users/:id');
        return { handled: true };
      }

      if (path === '/api/admin/models') {
        if (request.method === 'GET') {
          await adminHandlers.handleAdminModelsList(request, response);
          return { handled: true };
        }

        if (request.method === 'POST') {
          await adminHandlers.handleAdminModelsCreate(request, response);
          return { handled: true };
        }

        writeError(response, 405, 'method_not_allowed', 'Method not allowed for /api/admin/models');
        return { handled: true };
      }

      const adminModelMatch = path.match(/^\/api\/admin\/models\/([^/]+)$/);
      if (adminModelMatch) {
        const modelId = decodeURIComponent(adminModelMatch[1] ?? '');

        if (request.method === 'PUT') {
          await adminHandlers.handleAdminModelsUpdate(request, response, modelId);
          return { handled: true };
        }

        if (request.method === 'DELETE') {
          await adminHandlers.handleAdminModelsDelete(request, response, modelId);
          return { handled: true };
        }

        writeError(response, 405, 'method_not_allowed', 'Method not allowed for /api/admin/models/:id');
        return { handled: true };
      }

      if (path === '/api/models') {
        await publicHandlers.handleModelsList(request, response);
        return { handled: true };
      }

      if (path === '/api/changelog') {
        await publicHandlers.handleListPublishedChangelog(request, response);
        return { handled: true };
      }

      if (path === '/api/user-reports') {
        await publicHandlers.handleCreateUserReport(request, response);
        return { handled: true };
      }

      if (path === '/api/admin/changelog') {
        if (request.method === 'GET') {
          await adminHandlers.handleAdminListChangelog(request, response);
        } else if (request.method === 'POST') {
          await adminHandlers.handleAdminCreateChangelog(request, response);
        } else {
          writeError(response, 405, 'method_not_allowed', 'Use GET or POST for changelog');
        }
        return { handled: true };
      }

      if (path === '/api/admin/user-reports') {
        await adminHandlers.handleAdminListUserReports(request, response);
        return { handled: true };
      }

      const adminUserReportIssueMatch = path.match(/^\/api\/admin\/user-reports\/([^/]+)\/publish-issue$/);
      if (adminUserReportIssueMatch) {
        await adminHandlers.handleAdminPublishUserReportIssue(
          request,
          response,
          decodeURIComponent(adminUserReportIssueMatch[1] ?? ''),
        );
        return { handled: true };
      }

      const adminUserReportMatch = path.match(/^\/api\/admin\/user-reports\/([^/]+)$/);
      if (adminUserReportMatch) {
        await adminHandlers.handleAdminUpdateUserReport(
          request,
          response,
          decodeURIComponent(adminUserReportMatch[1] ?? ''),
        );
        return { handled: true };
      }

      const adminArchiveChangelogMatch = path.match(/^\/api\/admin\/product-changelogs\/([^/]+)\/archive$/);
      if (adminArchiveChangelogMatch) {
        await adminHandlers.handleAdminArchiveChangelog(
          request,
          response,
          decodeURIComponent(adminArchiveChangelogMatch[1] ?? ''),
        );
        return { handled: true };
      }

      if (path === '/api/projects') {
        if (request.method === 'GET') {
          await projectsHandlers.handleProjectsList(request, response);
          return { handled: true };
        }

        if (request.method === 'POST') {
          await projectsHandlers.handleProjectsCreate(request, response);
          return { handled: true };
        }

        writeError(response, 405, 'method_not_allowed', 'Method not allowed for /api/projects');
        return { handled: true };
      }

      const projectMatch = path.match(/^\/api\/projects\/([^/]+)$/);
      if (projectMatch) {
        await projectsHandlers.handleProjectById(request, response, decodeURIComponent(projectMatch[1] ?? ''));
        return { handled: true };
      }

      if (path === '/api/artifacts') {
        await projectsHandlers.handleArtifactsList(request, response);
        return { handled: true };
      }

      if (path === '/api/tools/briefs') {
        await toolsHandlers.handleToolsBriefUpload(request, response);
        return { handled: true };
      }

      if (path === '/api/tools/hydrate') {
        await toolsHandlers.handleToolsHydrate(request, response);
        return { handled: true };
      }

      if (path === '/api/tools/orchestrate') {
        await toolsHandlers.handleToolsOrchestrate(request, response);
        return { handled: true };
      }

      if (path === '/api/tools/sessions') {
        await toolsHandlers.handleToolsSessionsList(request, response);
        return { handled: true };
      }

      const toolSessionStepMatch = path.match(/^\/api\/tools\/sessions\/([^/]+)\/step\/([^/]+)$/);
      if (toolSessionStepMatch) {
        await toolsHandlers.handleToolsSessionStepArtifact(
          request,
          response,
          decodeURIComponent(toolSessionStepMatch[1] ?? ''),
          decodeURIComponent(toolSessionStepMatch[2] ?? ''),
        );
        return { handled: true };
      }

      // Download route must be before the /:sessionId catch-all
      const toolSessionDownloadMatch = path.match(/^\/api\/tools\/sessions\/([^/]+)\/download$/);
      if (toolSessionDownloadMatch) {
        await toolsHandlers.handleToolsSessionDownload(
          request,
          response,
          decodeURIComponent(toolSessionDownloadMatch[1] ?? ''),
        );
        return { handled: true };
      }

      const toolSessionMatch = path.match(/^\/api\/tools\/sessions\/([^/]+)$/);
      if (toolSessionMatch) {
        await toolsHandlers.handleToolsSessionArtifacts(
          request,
          response,
          decodeURIComponent(toolSessionMatch[1] ?? ''),
        );
        return { handled: true };
      }

      // Download route must be before the /:artifactId catch-all
      const artifactDownloadMatch = path.match(/^\/api\/artifacts\/([^/]+)\/download$/);
      if (artifactDownloadMatch) {
        await projectsHandlers.handleArtifactDownload(
          request,
          response,
          decodeURIComponent(artifactDownloadMatch[1] ?? ''),
        );
        return { handled: true };
      }

      const artifactMatch = path.match(/^\/api\/artifacts\/([^/]+)$/);
      if (artifactMatch) {
        await projectsHandlers.handleArtifactById(request, response, decodeURIComponent(artifactMatch[1] ?? ''));
        return { handled: true };
      }

      return { handled: false };
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
