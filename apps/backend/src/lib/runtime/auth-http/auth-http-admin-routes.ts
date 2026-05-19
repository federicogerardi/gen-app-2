import type { AdminHandlers } from './admin-handlers';
import type { AuthHttpWriteErrorFn } from './support';
import type { RouteEntry } from './route-table';

export const buildAdminRoutes = (
  adminHandlers: AdminHandlers,
  writeError: AuthHttpWriteErrorFn,
): RouteEntry[] => {
  return [
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
  ];
};
