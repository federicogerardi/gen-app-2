import type { ProjectsHandlers } from './projects-handlers';
import type { AuthHttpWriteErrorFn } from './support';
import type { RouteEntry } from './route-table';

export const buildProjectsRoutes = (
  projectsHandlers: ProjectsHandlers,
  writeError: AuthHttpWriteErrorFn,
): RouteEntry[] => {
  return [
    {
      method: null,
      pattern: '/api/projects',
      handler: async (request, response) => {
        if (request.method === 'GET') {
          await projectsHandlers.handleProjectsList(request, response);
          return;
        }

        if (request.method === 'POST') {
          await projectsHandlers.handleProjectsCreate(request, response);
          return;
        }

        writeError(response, 405, 'method_not_allowed', 'Method not allowed for /api/projects');
      },
    },
    {
      method: null,
      pattern: /^\/api\/projects\/([^/]+)$/,
      handler: async (request, response, projectId) => {
        await projectsHandlers.handleProjectById(request, response, decodeURIComponent(projectId ?? ''));
      },
    },
    {
      method: null,
      pattern: '/api/artifacts',
      handler: projectsHandlers.handleArtifactsList,
    },
    {
      method: null,
      pattern: /^\/api\/artifacts\/([^/]+)\/download$/,
      handler: async (request, response, artifactId) => {
        await projectsHandlers.handleArtifactDownload(
          request,
          response,
          decodeURIComponent(artifactId ?? ''),
        );
      },
    },
    {
      method: null,
      pattern: /^\/api\/artifacts\/([^/]+)$/,
      handler: async (request, response, artifactId) => {
        await projectsHandlers.handleArtifactById(request, response, decodeURIComponent(artifactId ?? ''));
      },
    },
  ];
};
