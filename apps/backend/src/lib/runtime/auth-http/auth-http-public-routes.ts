import type { PublicHandlers } from './public-handlers';
import type { RouteEntry } from './route-table';

export const buildPublicRoutes = (publicHandlers: PublicHandlers): RouteEntry[] => {
  return [
    {
      method: 'GET',
      pattern: '/api/models',
      handler: publicHandlers.handleModelsList,
    },
    {
      method: 'GET',
      pattern: '/api/changelog',
      handler: publicHandlers.handleListPublishedChangelog,
    },
    {
      method: 'POST',
      pattern: '/api/user-reports',
      handler: publicHandlers.handleCreateUserReport,
    },
  ];
};
