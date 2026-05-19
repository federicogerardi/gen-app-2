import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AuthHandlers } from './auth-handlers';
import type { AdminHandlers } from './admin-handlers';
import type { ProjectsHandlers } from './projects-handlers';
import type { PublicHandlers } from './public-handlers';
import type { AuthHttpWriteErrorFn } from './support';
import type { ToolsHandlers } from './tools-handlers';
import { buildAuthRoutes } from './auth-http-auth-routes';
import { buildPublicRoutes } from './auth-http-public-routes';
import { buildAdminRoutes } from './auth-http-admin-routes';
import { buildProjectsRoutes } from './auth-http-projects-routes';
import { buildToolsRoutes } from './auth-http-tools-routes';
import { dispatchRequest } from './route-dispatch';

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
    ...buildAuthRoutes(authHandlers),
    ...buildAdminRoutes(adminHandlers, writeError),
    ...buildPublicRoutes(publicHandlers),
    ...buildProjectsRoutes(projectsHandlers, writeError),
    ...buildToolsRoutes(toolsHandlers),
  ];
};

export { dispatchRequest };