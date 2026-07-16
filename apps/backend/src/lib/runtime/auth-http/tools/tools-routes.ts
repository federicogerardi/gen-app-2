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

    // ====================================================================
    // Asset routes (DDD-188 through DDD-207)
    // ====================================================================

    // Asset CRUD
    {
      method: 'GET',
      pattern: '/api/tools/assets',
      handler: toolsHandlers.handleListAssets,
    },
    {
      method: 'POST',
      pattern: '/api/tools/assets',
      handler: toolsHandlers.handleCreateAsset,
    },
    {
      method: 'GET',
      pattern: /^\/api\/tools\/assets\/([^/]+)$/,
      handler: async (request, response, assetId) => {
        await toolsHandlers.handleGetAsset(
          request,
          response,
          decodeURIComponent(assetId ?? ''),
        );
      },
    },
    {
      method: 'PUT',
      pattern: /^\/api\/tools\/assets\/([^/]+)$/,
      handler: async (request, response, assetId) => {
        await toolsHandlers.handleUpdateAsset(
          request,
          response,
          decodeURIComponent(assetId ?? ''),
        );
      },
    },

    // Promotion
    {
      method: 'POST',
      pattern: '/api/tools/assets/promote',
      handler: toolsHandlers.handlePromoteArtifactToAsset,
    },

    // Archive/Reactivate
    {
      method: 'POST',
      pattern: /^\/api\/tools\/assets\/([^/]+)\/archive$/,
      handler: async (request, response, assetId) => {
        await toolsHandlers.handleArchiveAsset(
          request,
          response,
          decodeURIComponent(assetId ?? ''),
        );
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/tools\/assets\/([^/]+)\/reactivate$/,
      handler: async (request, response, assetId) => {
        await toolsHandlers.handleReactivateAsset(
          request,
          response,
          decodeURIComponent(assetId ?? ''),
        );
      },
    },

    // Versions
    {
      method: 'GET',
      pattern: /^\/api\/tools\/assets\/([^/]+)\/versions$/,
      handler: async (request, response, assetId) => {
        await toolsHandlers.handleListAssetVersions(
          request,
          response,
          decodeURIComponent(assetId ?? ''),
        );
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/tools\/assets\/([^/]+)\/versions$/,
      handler: async (request, response, assetId) => {
        await toolsHandlers.handleCreateAssetVersion(
          request,
          response,
          decodeURIComponent(assetId ?? ''),
        );
      },
    },

    // Discovery
    {
      method: 'GET',
      pattern: '/api/tools/assets/compatible',
      handler: toolsHandlers.handleListCompatibleAssets,
    },
    {
      method: 'GET',
      pattern: '/api/tools/assets/gaps',
      handler: toolsHandlers.handleDetectAssetGaps,
    },

    // Asset Groups
    {
      method: 'GET',
      pattern: '/api/tools/asset-groups',
      handler: toolsHandlers.handleListAssetGroups,
    },
    {
      method: 'POST',
      pattern: '/api/tools/asset-groups',
      handler: toolsHandlers.handleCreateAssetGroup,
    },
    {
      method: 'GET',
      pattern: /^\/api\/tools\/asset-groups\/([^/]+)$/,
      handler: async (request, response, groupId) => {
        await toolsHandlers.handleGetAssetGroup(
          request,
          response,
          decodeURIComponent(groupId ?? ''),
        );
      },
    },
    {
      method: 'PUT',
      pattern: /^\/api\/tools\/asset-groups\/([^/]+)$/,
      handler: async (request, response, groupId) => {
        await toolsHandlers.handleUpdateAssetGroup(
          request,
          response,
          decodeURIComponent(groupId ?? ''),
        );
      },
    },
    {
      method: 'POST',
      pattern: /^\/api\/tools\/asset-groups\/([^/]+)\/assets$/,
      handler: async (request, response, groupId) => {
        await toolsHandlers.handleAddAssetToGroup(
          request,
          response,
          decodeURIComponent(groupId ?? ''),
        );
      },
    },
    {
      method: 'DELETE',
      pattern: /^\/api\/tools\/asset-groups\/([^/]+)\/assets\/([^/]+)$/,
      handler: async (request, response, groupId, assetId) => {
        await toolsHandlers.handleRemoveAssetFromGroup(
          request,
          response,
          decodeURIComponent(groupId ?? ''),
          decodeURIComponent(assetId ?? ''),
        );
      },
    },
  ];
};
