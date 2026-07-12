import type { ProjectsHandlers } from './projects-handlers';
import type { RouteEntry } from '../route-table';

export const buildProjectsRoutes = (
  projectsHandlers: ProjectsHandlers,
): RouteEntry[] => {
  return [
    {
      method: 'GET',
      pattern: '/api/projects',
      handler: projectsHandlers.handleProjectsList,
    },
    {
      method: 'POST',
      pattern: '/api/projects',
      handler: projectsHandlers.handleProjectsCreate,
    },
    {
      method: 'GET',
      pattern: /^\/api\/projects\/([^/]+)$/,
      handler: async (request, response, projectId) => {
        await projectsHandlers.handleProjectById(request, response, decodeURIComponent(projectId ?? ''));
      },
    },
    {
      method: 'GET',
      pattern: '/api/artifacts',
      handler: projectsHandlers.handleArtifactsList,
    },
    {
      method: 'GET',
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
      method: 'GET',
      pattern: /^\/api\/artifacts\/([^/]+)$/,
      handler: async (request, response, artifactId) => {
        await projectsHandlers.handleArtifactById(request, response, decodeURIComponent(artifactId ?? ''));
      },
    },
  ];
};
