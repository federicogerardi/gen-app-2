import type { ToolsHandlers } from './tools-handlers';
import type { RouteEntry } from './route-table';

export const buildToolsRoutes = (toolsHandlers: ToolsHandlers): RouteEntry[] => {
  return [
    {
      method: null,
      pattern: '/api/tools/briefs',
      handler: toolsHandlers.handleToolsBriefUpload,
    },
    {
      method: null,
      pattern: '/api/tools/hydrate',
      handler: toolsHandlers.handleToolsHydrate,
    },
    {
      method: null,
      pattern: '/api/tools/orchestrate',
      handler: toolsHandlers.handleToolsOrchestrate,
    },
    {
      method: null,
      pattern: '/api/tools/sessions',
      handler: toolsHandlers.handleToolsSessionsList,
    },
    {
      method: null,
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
      method: null,
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
      method: null,
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
