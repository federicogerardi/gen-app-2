/**
 * Asset Client — Frontend HTTP functions for Asset management.
 *
 * Follows existing patterns from tools-client.ts and session-client.ts.
 * All functions use requestJson from http-client for consistent error handling.
 *
 * F-003: Create asset-client.ts with HTTP functions.
 */

import type { AssetDto, AssetGroupDto, AssetVersionDto, AssetType } from '@gen-app-2/contracts';
import { joinApiPath, requestJson } from '../../../app/runtime/http-client';

// =====================================================================
// Types
// =====================================================================

export type AssetListResponse = {
  assets: AssetDto[];
  total: number;
  limit: number;
  offset: number;
};

export type AssetGroupListResponse = {
  groups: AssetGroupDto[];
};

export type AssetVersionsResponse = {
  versions: AssetVersionDto[];
};

export type CompatibleAssetsResponse = {
  compatibleAssets: AssetDto[];
};

export type AssetGapsResponse = {
  gaps: {
    assetType: string;
    canBeProducedBy: string[];
  }[];
};

export type CreateAssetInput = {
  projectId: string;
  assetType: AssetType;
  source: 'generated' | 'uploaded' | 'manual';
  content?: string;
  label: string;
  sourceArtifactId?: string;
};

export type UpdateAssetInput = {
  label?: string;
  content?: string;
  status?: 'active' | 'archived';
};

export type CreateAssetGroupInput = {
  projectId: string;
  label: string;
  groupUsage?: 'individual' | 'bundled';
  assetIds?: string[];
};

export type PromoteArtifactInput = {
  artifactId: string;
  projectId: string;
  assetType: AssetType;
  label: string;
};

// Backend wraps success responses as { ok: true, data: {...} }
type ApiResponse<T> = { ok?: boolean; data?: T; };
const assetFetch = async <T>(url: string, opts: Parameters<typeof requestJson>[1] = {}): Promise<T> => {
  const res = await requestJson<ApiResponse<T>>(url, { credentials: 'include', ...opts });
  return (res.data ?? {}) as T;
};

// =====================================================================
// Asset CRUD functions
// =====================================================================

/**
 * List assets for a project.
 */
export const listAssets = async (
  projectId: string,
  options?: {
    assetType?: AssetType;
    status?: 'active' | 'archived';
    limit?: number;
    offset?: number;
  },
): Promise<AssetListResponse> => {
  const params = new URLSearchParams({ projectId });
  if (options?.assetType) params.set('assetType', options.assetType);
  if (options?.status) params.set('status', options.status);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.offset) params.set('offset', String(options.offset));

  return assetFetch<AssetListResponse>(
    joinApiPath('/api/tools/assets', `?${params.toString()}`),
    { method: 'GET' },
  );
};

/**
 * Get an asset by ID.
 */
export const getAsset = async (assetId: string): Promise<{ asset: AssetDto }> => {
  return assetFetch<{ asset: AssetDto }>(
    joinApiPath('/api/tools/assets', `/${encodeURIComponent(assetId)}`),
    { method: 'GET' },
  );
};

/**
 * Create a new asset.
 */
export const createAsset = async (input: CreateAssetInput): Promise<{ asset: AssetDto }> => {
  return assetFetch<{ asset: AssetDto }>(
    joinApiPath('/api/tools/assets', ''),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
};

/**
 * Update an asset.
 */
export const updateAsset = async (
  assetId: string,
  input: UpdateAssetInput,
): Promise<{ asset: AssetDto }> => {
  return assetFetch<{ asset: AssetDto }>(
    joinApiPath('/api/tools/assets', `/${encodeURIComponent(assetId)}`),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
};

/**
 * Archive an asset.
 */
export const archiveAsset = async (assetId: string): Promise<{ asset: AssetDto }> => {
  return assetFetch<{ asset: AssetDto }>(
    joinApiPath('/api/tools/assets', `/${encodeURIComponent(assetId)}/archive`),
    { method: 'POST' },
  );
};

/**
 * Reactivate an archived asset.
 */
export const reactivateAsset = async (assetId: string): Promise<{ asset: AssetDto }> => {
  return assetFetch<{ asset: AssetDto }>(
    joinApiPath('/api/tools/assets', `/${encodeURIComponent(assetId)}/reactivate`),
    { method: 'POST' },
  );
};

/**
 * Promote an artifact to an asset.
 */
export const promoteArtifactToAsset = async (
  input: PromoteArtifactInput,
): Promise<{ asset: AssetDto }> => {
  return assetFetch<{ asset: AssetDto }>(
    joinApiPath('/api/tools/assets', '/promote'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
};

// =====================================================================
// Asset Versions
// =====================================================================

/**
 * List versions for an asset.
 */
export const listAssetVersions = async (assetId: string): Promise<AssetVersionsResponse> => {
  return assetFetch<AssetVersionsResponse>(
    joinApiPath('/api/tools/assets', `/${encodeURIComponent(assetId)}/versions`),
    { method: 'GET' },
  );
};

/**
 * Create a new version for an asset.
 */
export const createAssetVersion = async (
  assetId: string,
  input: { content: string; sourceArtifactId?: string },
): Promise<{ version: AssetVersionDto }> => {
  return assetFetch<{ version: AssetVersionDto }>(
    joinApiPath('/api/tools/assets', `/${encodeURIComponent(assetId)}/versions`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
};

// =====================================================================
// Asset Groups
// =====================================================================

/**
 * List asset groups for a project.
 */
export const listAssetGroups = async (projectId: string): Promise<AssetGroupListResponse> => {
  const params = new URLSearchParams({ projectId });
  return assetFetch<AssetGroupListResponse>(
    joinApiPath('/api/tools/asset-groups', `?${params.toString()}`),
    { method: 'GET' },
  );
};

/**
 * Get an asset group by ID.
 */
export const getAssetGroup = async (groupId: string): Promise<{ group: AssetGroupDto }> => {
  return assetFetch<{ group: AssetGroupDto }>(
    joinApiPath('/api/tools/asset-groups', `/${encodeURIComponent(groupId)}`),
    { method: 'GET' },
  );
};

/**
 * Create a new asset group.
 */
export const createAssetGroup = async (
  input: CreateAssetGroupInput,
): Promise<{ group: AssetGroupDto }> => {
  return assetFetch<{ group: AssetGroupDto }>(
    joinApiPath('/api/tools/asset-groups', ''),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
};

/**
 * Update an asset group.
 */
export const updateAssetGroup = async (
  groupId: string,
  input: { label?: string; groupUsage?: string },
): Promise<{ group: AssetGroupDto }> => {
  return assetFetch<{ group: AssetGroupDto }>(
    joinApiPath('/api/tools/asset-groups', `/${encodeURIComponent(groupId)}`),
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  );
};

/**
 * Add an asset to a group.
 */
export const addAssetToGroup = async (
  groupId: string,
  assetId: string,
  position?: number,
): Promise<{ ok: boolean }> => {
  return assetFetch<{ ok: boolean }>(
    joinApiPath('/api/tools/asset-groups', `/${encodeURIComponent(groupId)}/assets`),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId, position }),
    },
  );
};

/**
 * Remove an asset from a group.
 */
export const removeAssetFromGroup = async (
  groupId: string,
  assetId: string,
): Promise<{ ok: boolean }> => {
  return assetFetch<{ ok: boolean }>(
    joinApiPath(
      '/api/tools/asset-groups',
      `/${encodeURIComponent(groupId)}/assets/${encodeURIComponent(assetId)}`,
    ),
    { method: 'DELETE' },
  );
};

// =====================================================================
// Discovery
// =====================================================================

/**
 * List compatible assets for a project and tool.
 */
export const listCompatibleAssets = async (
  projectId: string,
  toolKey: string,
): Promise<CompatibleAssetsResponse> => {
  const params = new URLSearchParams({ projectId, toolKey });
  return assetFetch<CompatibleAssetsResponse>(
    joinApiPath('/api/tools/assets', `/compatible?${params.toString()}`),
    { method: 'GET' },
  );
};

/**
 * Detect asset gaps for a project and tool.
 */
export const detectAssetGaps = async (
  projectId: string,
  toolKey: string,
): Promise<AssetGapsResponse> => {
  const params = new URLSearchParams({ projectId, toolKey });
  return assetFetch<AssetGapsResponse>(
    joinApiPath('/api/tools/assets', `/gaps?${params.toString()}`),
    { method: 'GET' },
  );
};
