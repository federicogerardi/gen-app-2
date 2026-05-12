import type { IncomingMessage, ServerResponse } from 'node:http';

export type AuthHandlers = {
  handleLogin(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleLogout(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleSession(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleGoogleOAuthStart(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleGoogleOAuthCallback(request: IncomingMessage, response: ServerResponse): Promise<void>;
};

export const createAuthHandlers = (handlers: AuthHandlers): AuthHandlers => handlers;
