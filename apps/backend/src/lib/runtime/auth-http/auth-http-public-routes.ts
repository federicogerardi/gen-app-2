import type { PublicHandlers } from './public-handlers';
import type { RouteEntry } from './route-table';

export const buildPublicRoutes = (publicHandlers: PublicHandlers): RouteEntry[] => {
  return [
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
  ];
};
