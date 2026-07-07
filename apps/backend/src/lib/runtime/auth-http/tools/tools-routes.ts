import type { ToolsHandlers } from './tools-handlers';
import type { RouteEntry } from '../route-table';

export const buildToolsRoutes = (toolsHandlers: ToolsHandlers): RouteEntry[] => {
  return [
    {
      method: 'POST',
      pattern: '/api/tools/briefs',
      handler: toolsHandlers.handleToolsBriefUpload,
    },
    {
      method: 'POST',
      pattern: '/api/tools/hydrate',
      handler: toolsHandlers.handleToolsHydrate,
    },
    {
      method: 'POST',
      pattern: '/api/tools/orchestrate',
      handler: toolsHandlers.handleToolsOrchestrate,
    },
    {
      method: 'GET',
      pattern: '/api/tools/api-services',
      handler: toolsHandlers.handleToolsApiServiceResolve,
    },
    {
      method: 'GET',
      pattern: '/api/tools/sessions',
      handler: toolsHandlers.handleToolsSessionsList,
    },
    {
      method: 'GET',
      pattern: /^\/api\/tools\/sessions\/([^/]+)\/step\/([^/]+)$/,
      handler: async (request, response, sessionId, stepKey) => {
        await toolsHandlers.handleToolsSessionStepArtifact(
          request,
          response,
          decodeURIComponent(sessionId ?? ''),
          decodeURIComponent(stepKey ?? ''),
        );
      },
    },
    {
      method: 'GET',
      pattern: /^\/api\/tools\/sessions\/([^/]+)\/download$/,
      handler: async (request, response, sessionId) => {
        await toolsHandlers.handleToolsSessionDownload(
          request,
          response,
          decodeURIComponent(sessionId ?? ''),
        );
      },
    },
    {
      method: 'GET',
      pattern: /^\/api\/tools\/sessions\/([^/]+)$/,
      handler: async (request, response, sessionId) => {
        await toolsHandlers.handleToolsSessionArtifacts(
          request,
          response,
          decodeURIComponent(sessionId ?? ''),
        );
      },
    },
  ];
};
