import type { AuthHandlers } from './auth-handlers';
import type { RouteEntry } from '../route-table';

export const buildAuthRoutes = (authHandlers: AuthHandlers): RouteEntry[] => {
  return [
    {
      method: 'POST',
      pattern: '/auth/login',
      handler: authHandlers.handleLogin,
    },
    {
      method: 'POST',
      pattern: '/auth/logout',
      handler: authHandlers.handleLogout,
    },
    {
      method: 'GET',
      pattern: '/auth/session',
      handler: authHandlers.handleSession,
    },
    {
      method: 'GET',
      pattern: '/auth/google/start',
      handler: authHandlers.handleGoogleOAuthStart,
    },
    {
      method: 'GET',
      pattern: '/auth/google/callback',
      handler: authHandlers.handleGoogleOAuthCallback,
    },
  ];
};
