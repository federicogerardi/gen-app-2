/**
 * Asset Domain Types — Backend Layer (Generation Context)
 *
 * Type definitions and mappers for Asset entities persisted in the database.
 * Follows existing patterns from artifact.ts and api-service.ts.
 *
 * DDD canonical terms:
 *   - Asset Entity (DDD-188)
 *   - AssetGroup Entity (DDD-194)
 *   - AssetVersion Value Object (DDD-196)
 *   - AssetDerivationChain Entity (DDD-197)
 */

import type {
  AssetType,
  AssetSource,
  AssetStatus,
  AssetGroupUsage,
  AssetDto,
  AssetGroupDto,
  AssetVersionDto,
  AssetDerivationChainDto,
} from '@gen-app-2/contracts';

// =====================================================================
// Row Types — DB representation (snake_case)
// =====================================================================

/**
 * AssetRow — raw database row from the `assets` table.
 */
export type AssetRow = {
  id: string;
  project_id: string;
  asset_type: string;
  source: string;
  source_artifact_id: string | null;
  status: string;
  content: string;
  label: string;
  current_version: number;
  stale_upstream: boolean;
  created_at: Date;
  updated_at: Date;
};

/**
 * AssetGroupRow — raw database row from the `asset_groups` table.
 */
export type AssetGroupRow = {
  id: string;
  project_id: string;
  label: string;
  group_usage: string;
  created_at: Date;
  updated_at: Date;
};

/**
 * AssetGroupMemberRow — raw database row from the `asset_group_members` table.
 */
export type AssetGroupMemberRow = {
  group_id: string;
  asset_id: string;
  position: number;
  created_at: Date;
};

/**
 * AssetVersionRow — raw database row from the `asset_versions` table.
 */
export type AssetVersionRow = {
  id: number;
  asset_id: string;
  version_number: number;
  content: string;
  source_artifact_id: string | null;
  created_at: Date;
};

/**
 * AssetDerivationChainRow — raw database row from `asset_derivation_chains`.
 */
export type AssetDerivationChainRow = {
  id: number;
  upstream_asset_id: string;
  upstream_version: number;
  downstream_asset_id: string;
  tool_key: string;
  session_id: string;
  created_at: Date;
};

/**
 * GenerationFeedbackRow — raw database row from `generation_feedback`.
 */
export type GenerationFeedbackRow = {
  id: number;
  artifact_id: string;
  user_id: string;
  rating: string;
  comment: string | null;
  created_at: Date;
};

// =====================================================================
// Mappers — Row → DTO (snake_case → camelCase)
// =====================================================================

/**
 * C-001: Map AssetRow to AssetDto (camelCase conversion).
 */
export const rowToAsset = (row: AssetRow): AssetDto => ({
  assetId: row.id,
  projectId: row.project_id,
  assetType: row.asset_type as AssetType,
  source: row.source as AssetSource,
  sourceArtifactId: row.source_artifact_id,
  status: row.status as AssetStatus,
  content: row.content,
  label: row.label,
  currentVersion: row.current_version,
  staleUpstream: row.stale_upstream,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

/**
 * C-002: Map AssetGroupRow to AssetGroupDto.
 */
export const rowToAssetGroup = (
  groupRow: AssetGroupRow,
  memberAssetIds: string[] = [],
): AssetGroupDto => ({
  groupId: groupRow.id,
  projectId: groupRow.project_id,
  label: groupRow.label,
  assetIds: memberAssetIds,
  groupUsage: groupRow.group_usage as AssetGroupUsage,
  createdAt: groupRow.created_at.toISOString(),
  updatedAt: groupRow.updated_at.toISOString(),
});

/**
 * C-003: Map AssetVersionRow to AssetVersionDto.
 */
export const rowToAssetVersion = (row: AssetVersionRow): AssetVersionDto => ({
  versionNumber: row.version_number,
  assetId: row.asset_id,
  content: row.content,
  sourceArtifactId: row.source_artifact_id,
  createdAt: row.created_at.toISOString(),
});

/**
 * C-004: Map AssetDerivationChainRow to AssetDerivationChainDto.
 */
export const rowToDerivationChain = (
  row: AssetDerivationChainRow,
): AssetDerivationChainDto => ({
  upstreamAssetId: row.upstream_asset_id,
  upstreamVersion: row.upstream_version,
  downstreamAssetId: row.downstream_asset_id,
  toolKey: row.tool_key as AssetDerivationChainDto['toolKey'],
  sessionId: row.session_id,
  createdAt: row.created_at.toISOString(),
});

// =====================================================================
// Input Types — for CRUD operations
// =====================================================================

/**
 * Input for creating a new Asset.
 */
export type CreateAssetInput = {
  id: string;
  projectId: string;
  assetType: AssetType;
  source: AssetSource;
  sourceArtifactId?: string | null;
  content: string;
  label: string;
};

/**
 * Input for updating an Asset.
 */
export type UpdateAssetInput = {
  label?: string;
  content?: string;
  status?: AssetStatus;
};

/**
 * Input for creating a new AssetGroup.
 */
export type CreateAssetGroupInput = {
  id: string;
  projectId: string;
  label: string;
  groupUsage: AssetGroupUsage;
  assetIds?: string[];
};

/**
 * Input for updating an AssetGroup.
 */
export type UpdateAssetGroupInput = {
  label?: string;
  groupUsage?: AssetGroupUsage;
};

/**
 * Input for creating a new AssetVersion.
 */
export type CreateAssetVersionInput = {
  assetId: string;
  versionNumber: number;
  content: string;
  sourceArtifactId?: string | null;
};

/**
 * Input for creating a derivation link.
 */
export type CreateDerivationLinkInput = {
  upstreamAssetId: string;
  upstreamVersion: number;
  downstreamAssetId: string;
  toolKey: string;
  sessionId: string;
};

/**
 * Filters for listing Assets.
 */
export type AssetListFilters = {
  projectId: string;
  assetType?: AssetType;
  status?: AssetStatus;
  limit?: number;
  offset?: number;
};

/**
 * Filters for listing AssetGroups.
 */
export type AssetGroupListFilters = {
  projectId: string;
  limit?: number;
  offset?: number;
};
