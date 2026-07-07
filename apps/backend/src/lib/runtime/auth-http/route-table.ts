import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AuthHandlers } from './auth/auth-handlers';
import type { AdminHandlers } from './admin/admin-handlers';
import type { ProjectsHandlers } from './projects/projects-handlers';
import type { PublicHandlers } from './auth/public-handlers';
import type { ToolsHandlers } from './tools/tools-handlers';
import { buildAuthRoutes } from './auth/auth-routes';
import { buildPublicRoutes } from './auth/public-routes';
import { buildAdminRoutes } from './admin/admin-routes';
import { buildProjectsRoutes } from './projects/projects-routes';
import { buildToolsRoutes } from './tools/tools-routes';
import { dispatchRequest } from './route-dispatch';

export type HandleAuthHttpRequestResult = {
  handled: boolean;
};

export type RouteEntry = {
  method: string | string[];
  pattern: string | RegExp;
  handler: (request: IncomingMessage, response: ServerResponse, ...matches: string[]) => Promise<void>;
};

export type AuthHttpRouteCapability =
  | 'auth.login'
  | 'auth.logout'
  | 'auth.session'
  | 'auth.google.start'
  | 'admin.users'
  | 'admin.models'
  | 'admin.api-services'
  | 'admin.api-service-bindings'
  | 'projects'
  | 'artifacts'
  | 'tools.briefs'
  | 'tools.hydrate'
  | 'tools.orchestrate'
  | 'tools.api-services'
  | 'tools.sessions'
  | 'feedback.public'
  | 'feedback.admin';

export const AUTH_HTTP_ROUTE_CAPABILITIES: Readonly<Record<AuthHttpRouteCapability, true>> = {
  'auth.login': true,
  'auth.logout': true,
  'auth.session': true,
  'auth.google.start': true,
  'admin.users': true,
  'admin.models': true,
  'admin.api-services': true,
  'admin.api-service-bindings': true,
  projects: true,
  artifacts: true,
  'tools.briefs': true,
  'tools.hydrate': true,
  'tools.orchestrate': true,
  'tools.api-services': true,
  'tools.sessions': true,
  'feedback.public': true,
  'feedback.admin': true,
} as const;

export type AllHandlerGroups = {
  authHandlers: AuthHandlers;
  adminHandlers: AdminHandlers;
  projectsHandlers: ProjectsHandlers;
  publicHandlers: PublicHandlers;
  toolsHandlers: ToolsHandlers;
};

export const buildRouteTable = ({
  authHandlers,
  adminHandlers,
  projectsHandlers,
  publicHandlers,
  toolsHandlers,
}: AllHandlerGroups): RouteEntry[] => {
  return [
    ...buildAuthRoutes(authHandlers),
    ...buildAdminRoutes(adminHandlers),
    ...buildPublicRoutes(publicHandlers),
    ...buildProjectsRoutes(projectsHandlers),
    ...buildToolsRoutes(toolsHandlers),
  ];
};

export { dispatchRequest };