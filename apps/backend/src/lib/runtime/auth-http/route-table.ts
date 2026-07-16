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

export namespace HttpRouteCapabilities {
  export type AuthOperations    = 'login' | 'logout' | 'session' | 'google.start';
  export type AdminOperations   = 'users' | 'models' | 'api-services' | 'api-service-bindings';
  export type ToolsOperations   = 'briefs' | 'hydrate' | 'orchestrate' | 'api-services' | 'sessions' | 'assets' | 'asset-groups';
  export type ProjectOperations = 'projects';
  export type ArtifactOperations = 'artifacts';
  export type FeedbackOperations = 'public' | 'admin';
}

export type AuthHttpRouteCapability =
  | `auth.${HttpRouteCapabilities.AuthOperations}`
  | `admin.${HttpRouteCapabilities.AdminOperations}`
  | `tools.${HttpRouteCapabilities.ToolsOperations}`
  | HttpRouteCapabilities.ProjectOperations
  | HttpRouteCapabilities.ArtifactOperations
  | `feedback.${HttpRouteCapabilities.FeedbackOperations}`;

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
  'tools.assets': true,
  'tools.asset-groups': true,
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