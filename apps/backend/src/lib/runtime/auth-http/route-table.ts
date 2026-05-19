import type { IncomingMessage, ServerResponse } from 'node:http';

import { normalizePath } from '../http-utils';
import type { AuthHandlers } from './auth-handlers';
import type { AdminHandlers } from './admin-handlers';
import type { ProjectsHandlers } from './projects-handlers';
import type { PublicHandlers } from './public-handlers';
import type { AuthHttpWriteErrorFn } from './support';
import type { ToolsHandlers } from './tools-handlers';

export type HandleAuthHttpRequestResult = {
  handled: boolean;
};

export type RouteEntry = {
  method: string | null;
  pattern: string | RegExp;
  handler: (request: IncomingMessage, response: ServerResponse, ...matches: string[]) => Promise<void>;
};

export type AllHandlerGroups = {
  authHandlers: AuthHandlers;
  adminHandlers: AdminHandlers;
  projectsHandlers: ProjectsHandlers;
  publicHandlers: PublicHandlers;
  toolsHandlers: ToolsHandlers;
  writeError: AuthHttpWriteErrorFn;
};

export const buildRouteTable = ({
  authHandlers,
  adminHandlers,
  projectsHandlers,
  publicHandlers,
  toolsHandlers,
  writeError,
}: AllHandlerGroups): RouteEntry[] => {
  return [
    {
      method: null,
      pattern: '/auth/login',
      handler: authHandlers.handleLogin,
    },
    {
      method: null,
      pattern: '/auth/logout',
      handler: authHandlers.handleLogout,
    },
    {
      method: null,
      pattern: '/auth/session',
      handler: authHandlers.handleSession,
    },
    {
      method: null,
      pattern: '/auth/google/start',
      handler: authHandlers.handleGoogleOAuthStart,
    },
    {
      method: null,
      pattern: '/auth/google/callback',
      handler: authHandlers.handleGoogleOAuthCallback,
    },
    {
      method: null,
      pattern: '/admin/users',
      handler: async (request, response) => {
        if (request.method === 'GET') {
          await adminHandlers.handleAdminListUsers(request, response);
          return;
        }

        if (request.method === 'POST') {
          await adminHandlers.handleAdminCreateUser(request, response);
          return;
        }

        writeError(response, 405, 'method_not_allowed', 'Method not allowed for /admin/users');
      },
    },
    {
      method: null,
      pattern: /^\/admin\/users\/([^/]+)$/,
      handler: async (request, response, userId) => {
        const decodedUserId = decodeURIComponent(userId ?? '');

        if (request.method === 'GET') {
          await adminHandlers.handleAdminGetUser(request, response, decodedUserId);
          return;
        }

        if (request.method === 'PATCH') {
          await adminHandlers.handleAdminUpdateUser(request, response, decodedUserId);
          return;
        }

        if (request.method === 'DELETE') {
          await adminHandlers.handleAdminDeleteUser(request, response, decodedUserId);
          return;
        }

        writeError(response, 405, 'method_not_allowed', 'Method not allowed for /admin/users/:id');
      },
    },
    {
      method: null,
      pattern: '/api/admin/models',
      handler: async (request, response) => {
        if (request.method === 'GET') {
          await adminHandlers.handleAdminModelsList(request, response);
          return;
        }

        if (request.method === 'POST') {
          await adminHandlers.handleAdminModelsCreate(request, response);
          return;
        }

        writeError(response, 405, 'method_not_allowed', 'Method not allowed for /api/admin/models');
      },
    },
    {
      method: null,
      pattern: /^\/api\/admin\/models\/([^/]+)$/,
      handler: async (request, response, modelId) => {
        const decodedModelId = decodeURIComponent(modelId ?? '');

        if (request.method === 'PUT') {
          await adminHandlers.handleAdminModelsUpdate(request, response, decodedModelId);
          return;
        }

        if (request.method === 'DELETE') {
          await adminHandlers.handleAdminModelsDelete(request, response, decodedModelId);
          return;
        }

        writeError(response, 405, 'method_not_allowed', 'Method not allowed for /api/admin/models/:id');
      },
    },
    {
      method: null,
      pattern: '/api/models',
      handler: publicHandlers.handleModelsList,
    },
    {
      method: null,
      pattern: '/api/changelog',
      handler: publicHandlers.handleListPublishedChangelog,
    },
    {
      method: null,
      pattern: '/api/user-reports',
      handler: publicHandlers.handleCreateUserReport,
    },
    {
      method: null,
      pattern: '/api/admin/changelog',
      handler: async (request, response) => {
        if (request.method === 'GET') {
          await adminHandlers.handleAdminListChangelog(request, response);
          return;
        }

        if (request.method === 'POST') {
          await adminHandlers.handleAdminCreateChangelog(request, response);
          return;
        }

        writeError(response, 405, 'method_not_allowed', 'Use GET or POST for changelog');
      },
    },
    {
      method: null,
      pattern: '/api/admin/user-reports',
      handler: adminHandlers.handleAdminListUserReports,
    },
    {
      method: null,
      pattern: /^\/api\/admin\/user-reports\/([^/]+)\/publish-issue$/,
      handler: async (request, response, reportId) => {
        await adminHandlers.handleAdminPublishUserReportIssue(
          request,
          response,
          decodeURIComponent(reportId ?? ''),
        );
      },
    },
    {
      method: null,
      pattern: /^\/api\/admin\/user-reports\/([^/]+)$/,
      handler: async (request, response, reportId) => {
        await adminHandlers.handleAdminUpdateUserReport(
          request,
          response,
          decodeURIComponent(reportId ?? ''),
        );
      },
    },
    {
      method: null,
      pattern: /^\/api\/admin\/product-changelogs\/([^/]+)\/archive$/,
      handler: async (request, response, changelogId) => {
        await adminHandlers.handleAdminArchiveChangelog(
          request,
          response,
          decodeURIComponent(changelogId ?? ''),
        );
      },
    },
    {
      method: null,
      pattern: '/api/projects',
      handler: async (request, response) => {
        if (request.method === 'GET') {
          await projectsHandlers.handleProjectsList(request, response);
          return;
        }

        if (request.method === 'POST') {
          await projectsHandlers.handleProjectsCreate(request, response);
          return;
        }

        writeError(response, 405, 'method_not_allowed', 'Method not allowed for /api/projects');
      },
    },
    {
      method: null,
      pattern: /^\/api\/projects\/([^/]+)$/,
      handler: async (request, response, projectId) => {
        await projectsHandlers.handleProjectById(request, response, decodeURIComponent(projectId ?? ''));
      },
    },
    {
      method: null,
      pattern: '/api/artifacts',
      handler: projectsHandlers.handleArtifactsList,
    },
    {
      method: null,
      pattern: '/api/tools/briefs',
      handler: toolsHandlers.handleToolsBriefUpload,
    },
    {
      method: null,
      pattern: '/api/tools/hydrate',
      handler: toolsHandlers.handleToolsHydrate,
    },
    {
      method: null,
      pattern: '/api/tools/orchestrate',
      handler: toolsHandlers.handleToolsOrchestrate,
    },
    {
      method: null,
      pattern: '/api/tools/sessions',
      handler: toolsHandlers.handleToolsSessionsList,
    },
    {
      method: null,
      pattern: /^\/api\/tools\/sessions\/([^/]+)\/step\/([^/]+)$/,
      handler: async (request, response, sessionId, stepKey) => {
        await toolsHandlers.handleToolsSessionStepArtifact(
          request,
          response,
          decodeURIComponent(sessionId ?? ''),
          decodeURIComponent(stepKey ?? ''),
        );
      },
    },
    {
      method: null,
      pattern: /^\/api\/tools\/sessions\/([^/]+)\/download$/,
      handler: async (request, response, sessionId) => {
        await toolsHandlers.handleToolsSessionDownload(
          request,
          response,
          decodeURIComponent(sessionId ?? ''),
        );
      },
    },
    {
      method: null,
      pattern: /^\/api\/tools\/sessions\/([^/]+)$/,
      handler: async (request, response, sessionId) => {
        await toolsHandlers.handleToolsSessionArtifacts(
          request,
          response,
          decodeURIComponent(sessionId ?? ''),
        );
      },
    },
    {
      method: null,
      pattern: /^\/api\/artifacts\/([^/]+)\/download$/,
      handler: async (request, response, artifactId) => {
        await projectsHandlers.handleArtifactDownload(
          request,
          response,
          decodeURIComponent(artifactId ?? ''),
        );
      },
    },
    {
      method: null,
      pattern: /^\/api\/artifacts\/([^/]+)$/,
      handler: async (request, response, artifactId) => {
        await projectsHandlers.handleArtifactById(request, response, decodeURIComponent(artifactId ?? ''));
      },
    },
  ];
};

export const dispatchRequest = async (
  routeTable: RouteEntry[],
  request: IncomingMessage,
  response: ServerResponse,
): Promise<HandleAuthHttpRequestResult> => {
  const path = normalizePath(request.url);

  for (const entry of routeTable) {
    if (typeof entry.pattern === 'string') {
      if (entry.pattern !== path) {
        continue;
      }

      if (entry.method !== null && entry.method !== request.method) {
        continue;
      }

      await entry.handler(request, response);
      return { handled: true };
    }

    const match = path.match(entry.pattern);
    if (!match) {
      continue;
    }

    if (entry.method !== null && entry.method !== request.method) {
      continue;
    }

    await entry.handler(request, response, ...match.slice(1));
    return { handled: true };
  }

  return { handled: false };
};