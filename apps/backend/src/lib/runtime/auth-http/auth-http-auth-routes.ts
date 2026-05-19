import type { AuthHandlers } from './auth-handlers';
import type { RouteEntry } from './route-table';

export const buildAuthRoutes = (authHandlers: AuthHandlers): RouteEntry[] => {
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
  ];
};
