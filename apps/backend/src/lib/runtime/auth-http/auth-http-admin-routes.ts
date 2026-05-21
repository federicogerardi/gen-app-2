import type { AdminHandlers } from './admin-handlers';
import type { RouteEntry } from './route-table';

export const buildAdminRoutes = (
  adminHandlers: AdminHandlers,
): RouteEntry[] => {
  return [
    {
      method: 'GET',
      pattern: '/admin/users',
      handler: adminHandlers.handleAdminListUsers,
    },
    {
      method: 'POST',
      pattern: '/admin/users',
      handler: adminHandlers.handleAdminCreateUser,
    },
    {
      method: 'GET',
      pattern: /^\/admin\/users\/([^/]+)$/,
      handler: async (request, response, userId) => {
        await adminHandlers.handleAdminGetUser(request, response, decodeURIComponent(userId ?? ''));
      },
    },
    {
      method: 'PATCH',
      pattern: /^\/admin\/users\/([^/]+)$/,
      handler: async (request, response, userId) => {
        await adminHandlers.handleAdminUpdateUser(request, response, decodeURIComponent(userId ?? ''));
      },
    },
    {
      method: 'DELETE',
      pattern: /^\/admin\/users\/([^/]+)$/,
      handler: async (request, response, userId) => {
        await adminHandlers.handleAdminDeleteUser(request, response, decodeURIComponent(userId ?? ''));
      },
    },
    {
      method: 'GET',
      pattern: '/api/admin/models',
      handler: adminHandlers.handleAdminModelsList,
    },
    {
      method: 'POST',
      pattern: '/api/admin/models',
      handler: adminHandlers.handleAdminModelsCreate,
    },
    {
      method: 'PUT',
      pattern: /^\/api\/admin\/models\/([^/]+)$/,
      handler: async (request, response, modelId) => {
        await adminHandlers.handleAdminModelsUpdate(request, response, decodeURIComponent(modelId ?? ''));
      },
    },
    {
      method: 'DELETE',
      pattern: /^\/api\/admin\/models\/([^/]+)$/,
      handler: async (request, response, modelId) => {
        await adminHandlers.handleAdminModelsDelete(request, response, decodeURIComponent(modelId ?? ''));
      },
    },
    {
      method: 'GET',
      pattern: '/api/admin/changelog',
      handler: adminHandlers.handleAdminListChangelog,
    },
    {
      method: 'POST',
      pattern: '/api/admin/changelog',
      handler: adminHandlers.handleAdminCreateChangelog,
    },
    {
      method: 'GET',
      pattern: '/api/admin/user-reports',
      handler: adminHandlers.handleAdminListUserReports,
    },
    {
      method: 'POST',
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
      method: 'PATCH',
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
      method: 'PATCH',
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
