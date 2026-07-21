/**
 * Asset Adapter — Kysely-based CRUD for Asset domain entities.
 *
 * Follows existing patterns from api-service.adapter.ts and postgres-redis.production.ts.
 * All functions use Kysely query builder for type-safe SQL.
 *
 * DDD canonical terms:
 *   - Asset CRUD (DDD-188)
 *   - AssetGroup CRUD (DDD-194)
 *   - AssetVersion (DDD-196)
 *   - AssetDerivationChain (DDD-197)
 *   - AssetDiscovery (DDD-202)
 *   - AssetGapDetection (DDD-203)
 */

import type { Kysely } from 'kysely';
import type { DB } from '../adapters/postgres-kysely.types';
import type {
  AssetRow,
  AssetGroupRow,
  AssetVersionRow,
  AssetDerivationChainRow,
  CreateAssetInput,
  UpdateAssetInput,
  CreateAssetGroupInput,
  UpdateAssetGroupInput,
  CreateAssetVersionInput,
  CreateDerivationLinkInput,
  AssetListFilters,
  AssetGroupListFilters,
} from '../types/asset';
import {
  rowToAsset,
  rowToAssetGroup,
  rowToAssetVersion,
  rowToDerivationChain,
} from '../types/asset';
import type { AssetDto, AssetGroupDto, AssetVersionDto, AssetDerivationChainDto } from '@gen-app-2/contracts';
import { getCompatibleAssetTypes } from '@gen-app-2/contracts';

// =====================================================================
// C-005: Asset CRUD functions
// =====================================================================

/**
 * Create a new Asset in the database.
 * DDD-188: Asset is property of Project.
 */
export const createAsset = async (
  db: Kysely<DB>,
  input: CreateAssetInput,
  runtime?: { now?: () => Date },
): Promise<AssetDto> => {
  const now = runtime?.now?.() ?? new Date();

  const row = await db
    .insertInto('assets')
    .values({
      id: input.id,
      project_id: input.projectId,
      asset_type: input.assetType,
      source: input.source,
      source_artifact_id: input.sourceArtifactId ?? null,
      status: 'active',
      content: input.content,
      label: input.label,
      current_version: 1,
      stale_upstream: false,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return rowToAsset(row as AssetRow);
};

/**
 * Get an Asset by ID.
 */
export const getAssetById = async (
  db: Kysely<DB>,
  assetId: string,
): Promise<AssetDto | null> => {
  const row = await db
    .selectFrom('assets')
    .where('id', '=', assetId)
    .selectAll()
    .executeTakeFirst();

  return row ? rowToAsset(row as AssetRow) : null;
};

/**
 * Get an Asset by ID, scoped to a project.
 */
export const getAssetByIdForProject = async (
  db: Kysely<DB>,
  projectId: string,
  assetId: string,
): Promise<AssetDto | null> => {
  const row = await db
    .selectFrom('assets')
    .where('id', '=', assetId)
    .where('project_id', '=', projectId)
    .selectAll()
    .executeTakeFirst();

  return row ? rowToAsset(row as AssetRow) : null;
};

/**
 * Update an Asset.
 */
export const updateAsset = async (
  db: Kysely<DB>,
  assetId: string,
  input: UpdateAssetInput,
  runtime?: { now?: () => Date },
): Promise<AssetDto | null> => {
  const now = runtime?.now?.() ?? new Date();

  const updatePayload: Record<string, unknown> = { updated_at: now };
  if (input.label !== undefined) updatePayload.label = input.label;
  if (input.content !== undefined) updatePayload.content = input.content;
  if (input.status !== undefined) updatePayload.status = input.status;

  const row = await db
    .updateTable('assets')
    .set(updatePayload)
    .where('id', '=', assetId)
    .returningAll()
    .executeTakeFirst();

  return row ? rowToAsset(row as AssetRow) : null;
};

/**
 * Archive an Asset (set status = 'archived').
 */
export const archiveAsset = async (
  db: Kysely<DB>,
  assetId: string,
  runtime?: { now?: () => Date },
): Promise<AssetDto | null> => {
  return updateAsset(db, assetId, { status: 'archived' }, runtime);
};

/**
 * Reactivate an Archived Asset (set status = 'active').
 */
export const reactivateAsset = async (
  db: Kysely<DB>,
  assetId: string,
  runtime?: { now?: () => Date },
): Promise<AssetDto | null> => {
  return updateAsset(db, assetId, { status: 'active' }, runtime);
};

/**
 * List Assets with filters.
 */
export const listAssets = async (
  db: Kysely<DB>,
  filters: AssetListFilters,
): Promise<AssetDto[]> => {
  let query = db
    .selectFrom('assets')
    .where('project_id', '=', filters.projectId);

  if (filters.assetType) {
    query = query.where('asset_type', '=', filters.assetType);
  }
  if (filters.status) {
    query = query.where('status', '=', filters.status);
  }

  const rows = await query
    .orderBy('created_at', 'desc')
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0)
    .selectAll()
    .execute();

  return rows.map((row) => rowToAsset(row as AssetRow));
};

/**
 * Count Assets with filters.
 */
export const countAssets = async (
  db: Kysely<DB>,
  filters: AssetListFilters,
): Promise<number> => {
  let query = db
    .selectFrom('assets')
    .where('project_id', '=', filters.projectId);

  if (filters.assetType) {
    query = query.where('asset_type', '=', filters.assetType);
  }
  if (filters.status) {
    query = query.where('status', '=', filters.status);
  }

  const result = await query
    .select(db.fn.count('id').as('count'))
    .executeTakeFirst();

  return Number(result?.count ?? 0);
};

// =====================================================================
// C-006: AssetGroup CRUD functions
// =====================================================================

/**
 * Create a new AssetGroup.
 * DDD-194: AssetGroup is a named collection of Assets within a Project.
 */
export const createAssetGroup = async (
  db: Kysely<DB>,
  input: CreateAssetGroupInput,
  runtime?: { now?: () => Date },
): Promise<AssetGroupDto> => {
  const now = runtime?.now?.() ?? new Date();

  const groupRow = await db
    .insertInto('asset_groups')
    .values({
      id: input.id,
      project_id: input.projectId,
      label: input.label,
      group_usage: input.groupUsage,
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  // Insert members with ordered positions
  if (input.assetIds && input.assetIds.length > 0) {
    const members = input.assetIds.map((assetId, index) => ({
      group_id: input.id,
      asset_id: assetId,
      position: index,
      created_at: now,
    }));

    await db
      .insertInto('asset_group_members')
      .values(members)
      .execute();
  }

  return rowToAssetGroup(
    groupRow as AssetGroupRow,
    input.assetIds ?? [],
  );
};

/**
 * Add an Asset to a group at a specific position.
 */
export const addAssetToGroup = async (
  db: Kysely<DB>,
  groupId: string,
  assetId: string,
  position?: number,
  runtime?: { now?: () => Date },
): Promise<void> => {
  const now = runtime?.now?.() ?? new Date();

  // If no position specified, append at the end
  if (position === undefined) {
    const maxPos = await db
      .selectFrom('asset_group_members')
      .where('group_id', '=', groupId)
      .select(db.fn.max('position').as('maxPos'))
      .executeTakeFirst();

    position = Number(maxPos?.maxPos ?? -1) + 1;
  }

  await db
    .insertInto('asset_group_members')
    .values({
      group_id: groupId,
      asset_id: assetId,
      position,
      created_at: now,
    })
    .execute();
};

/**
 * Remove an Asset from a group.
 */
export const removeAssetFromGroup = async (
  db: Kysely<DB>,
  groupId: string,
  assetId: string,
): Promise<void> => {
  await db
    .deleteFrom('asset_group_members')
    .where('group_id', '=', groupId)
    .where('asset_id', '=', assetId)
    .execute();
};

/**
 * Get an AssetGroup by ID with its members.
 */
export const getAssetGroupById = async (
  db: Kysely<DB>,
  groupId: string,
): Promise<AssetGroupDto | null> => {
  const groupRow = await db
    .selectFrom('asset_groups')
    .where('id', '=', groupId)
    .selectAll()
    .executeTakeFirst();

  if (!groupRow) return null;

  const members = await db
    .selectFrom('asset_group_members')
    .where('group_id', '=', groupId)
    .orderBy('position', 'asc')
    .select('asset_id')
    .execute();

  return rowToAssetGroup(
    groupRow as AssetGroupRow,
    members.map((m) => m.asset_id),
  );
};

/**
 * Update an AssetGroup.
 */
export const updateAssetGroup = async (
  db: Kysely<DB>,
  groupId: string,
  input: UpdateAssetGroupInput,
  runtime?: { now?: () => Date },
): Promise<AssetGroupDto | null> => {
  const now = runtime?.now?.() ?? new Date();

  const updatePayload: Record<string, unknown> = { updated_at: now };
  if (input.label !== undefined) updatePayload.label = input.label;
  if (input.groupUsage !== undefined) updatePayload.group_usage = input.groupUsage;

  const groupRow = await db
    .updateTable('asset_groups')
    .set(updatePayload)
    .where('id', '=', groupId)
    .returningAll()
    .executeTakeFirst();

  if (!groupRow) return null;

  const members = await db
    .selectFrom('asset_group_members')
    .where('group_id', '=', groupId)
    .orderBy('position', 'asc')
    .select('asset_id')
    .execute();

  return rowToAssetGroup(
    groupRow as AssetGroupRow,
    members.map((m) => m.asset_id),
  );
};

/**
 * List AssetGroups for a project.
 */
export const listAssetGroups = async (
  db: Kysely<DB>,
  filters: AssetGroupListFilters,
): Promise<AssetGroupDto[]> => {
  const groupRows = await db
    .selectFrom('asset_groups')
    .where('project_id', '=', filters.projectId)
    .orderBy('created_at', 'desc')
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0)
    .selectAll()
    .execute();

  const groups: AssetGroupDto[] = [];
  for (const groupRow of groupRows) {
    const members = await db
      .selectFrom('asset_group_members')
      .where('group_id', '=', groupRow.id)
      .orderBy('position', 'asc')
      .select('asset_id')
      .execute();

    groups.push(
      rowToAssetGroup(
        groupRow as AssetGroupRow,
        members.map((m) => m.asset_id),
      ),
    );
  }

  return groups;
};

// =====================================================================
// C-007: AssetVersion functions
// =====================================================================

/**
 * Create a new AssetVersion and update the Asset's current_version.
 * DDD-196: Atomic operation — version creation + current_version increment.
 */
export const createAssetVersion = async (
  db: Kysely<DB>,
  input: CreateAssetVersionInput,
  runtime?: { now?: () => Date },
): Promise<AssetVersionDto> => {
  const now = runtime?.now?.() ?? new Date();

  // Use a transaction to ensure atomicity
  const result = await db.transaction().execute(async (trx) => {
    // Create the version record
    const versionRow = await trx
      .insertInto('asset_versions')
      .values({
        asset_id: input.assetId,
        version_number: input.versionNumber,
        content: input.content,
        source_artifact_id: input.sourceArtifactId ?? null,
        created_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Update the asset's current_version
    await trx
      .updateTable('assets')
      .set({
        current_version: input.versionNumber,
        updated_at: now,
      })
      .where('id', '=', input.assetId)
      .execute();

    return versionRow;
  });

  return rowToAssetVersion(result as AssetVersionRow);
};

/**
 * Get all versions for an Asset, ordered by version number descending.
 */
export const getAssetVersions = async (
  db: Kysely<DB>,
  assetId: string,
): Promise<AssetVersionDto[]> => {
  const rows = await db
    .selectFrom('asset_versions')
    .where('asset_id', '=', assetId)
    .orderBy('version_number', 'desc')
    .selectAll()
    .execute();

  return rows.map((row) => rowToAssetVersion(row as AssetVersionRow));
};

/**
 * Get a specific version of an Asset.
 */
export const getAssetVersion = async (
  db: Kysely<DB>,
  assetId: string,
  versionNumber: number,
): Promise<AssetVersionDto | null> => {
  const row = await db
    .selectFrom('asset_versions')
    .where('asset_id', '=', assetId)
    .where('version_number', '=', versionNumber)
    .selectAll()
    .executeTakeFirst();

  return row ? rowToAssetVersion(row as AssetVersionRow) : null;
};

// =====================================================================
// C-008: AssetDerivationChain functions
// =====================================================================

/**
 * Create a derivation link between two Assets.
 * DDD-197: Tracks genealogical relationship (upstream → downstream).
 */
export const createDerivationLink = async (
  db: Kysely<DB>,
  input: CreateDerivationLinkInput,
  runtime?: { now?: () => Date },
): Promise<AssetDerivationChainDto> => {
  const now = runtime?.now?.() ?? new Date();

  const row = await db
    .insertInto('asset_derivation_chains')
    .values({
      upstream_asset_id: input.upstreamAssetId,
      upstream_version: input.upstreamVersion,
      downstream_asset_id: input.downstreamAssetId,
      tool_key: input.toolKey,
      session_id: input.sessionId,
      created_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return rowToDerivationChain(row as AssetDerivationChainRow);
};

/**
 * Get all downstream Assets derived from a given upstream Asset.
 */
export const getDownstreamAssets = async (
  db: Kysely<DB>,
  upstreamAssetId: string,
): Promise<AssetDerivationChainDto[]> => {
  const rows = await db
    .selectFrom('asset_derivation_chains')
    .where('upstream_asset_id', '=', upstreamAssetId)
    .orderBy('created_at', 'desc')
    .selectAll()
    .execute();

  return rows.map((row) => rowToDerivationChain(row as AssetDerivationChainRow));
};

/**
 * Get all upstream Assets that feed into a given downstream Asset.
 */
export const getUpstreamAssets = async (
  db: Kysely<DB>,
  downstreamAssetId: string,
): Promise<AssetDerivationChainDto[]> => {
  const rows = await db
    .selectFrom('asset_derivation_chains')
    .where('downstream_asset_id', '=', downstreamAssetId)
    .orderBy('created_at', 'desc')
    .selectAll()
    .execute();

  return rows.map((row) => rowToDerivationChain(row as AssetDerivationChainRow));
};

// =====================================================================
// C-009: listCompatibleAssets — combines contracts with DB query
// =====================================================================

/**
 * DDD-202: Find compatible Assets for a given Project and Tool.
 * Uses AssetCompatibilityMatrix to determine which AssetTypes are consumable,
 * then queries the database for matching active Assets.
 */
export const listCompatibleAssets = async (
  db: Kysely<DB>,
  projectId: string,
  toolKey: string,
): Promise<AssetDto[]> => {
  const { required, optional } = getCompatibleAssetTypes(
    toolKey as Parameters<typeof getCompatibleAssetTypes>[0],
  );
  const compatibleTypes = [...required, ...optional];

  if (compatibleTypes.length === 0) {
    return [];
  }

  const rows = await db
    .selectFrom('assets')
    .where('project_id', '=', projectId)
    .where('status', '=', 'active')
    .where('asset_type', 'in', compatibleTypes)
    .orderBy('created_at', 'desc')
    .selectAll()
    .execute();

  return rows.map((row) => rowToAsset(row as AssetRow));
};

// =====================================================================
// C-010: detectAssetGaps — compares contract requirements with existing
// =====================================================================

/**
 * DDD-203: Identify missing Assets that would improve a Tool's output.
 * Compares the Tool's `consumes` contract against existing project Assets.
 */
export const detectAssetGaps = async (
  db: Kysely<DB>,
  projectId: string,
  toolKey: string,
): Promise<{ assetType: string; canBeProducedBy: string[] }[]> => {
  const { required, optional } = getCompatibleAssetTypes(
    toolKey as Parameters<typeof getCompatibleAssetTypes>[0],
  );

  // Get existing active AssetTypes in the project
  const existingTypes = await db
    .selectFrom('assets')
    .where('project_id', '=', projectId)
    .where('status', '=', 'active')
    .select('asset_type')
    .distinct()
    .execute();

  const existingTypeSet = new Set(existingTypes.map((r) => r.asset_type));

  // Find missing types (both required and optional)
  const allConsumed = [...required, ...optional];
  const missing: { assetType: string; canBeProducedBy: string[] }[] = [];

  for (const assetType of allConsumed) {
    if (!existingTypeSet.has(assetType)) {
      missing.push({
        assetType,
        canBeProducedBy: [],
      });
    }
  }

  return missing;
};

// =====================================================================
// C-011: GenerationFeedback functions (for quality scoring)
// =====================================================================

/**
 * Record feedback for an artifact.
 * Used by AssetQualityScore (DDD-205) for feedbackScore factor.
 */
export const recordFeedback = async (
  db: Kysely<DB>,
  artifactId: string,
  userId: string,
  rating: 'positive' | 'negative',
  comment?: string,
  runtime?: { now?: () => Date },
): Promise<void> => {
  const now = runtime?.now?.() ?? new Date();

  await db
    .insertInto('generation_feedback')
    .values({
      artifact_id: artifactId,
      user_id: userId,
      rating,
      comment: comment ?? null,
      created_at: now,
    })
    .onConflict((oc) =>
      oc.columns(['artifact_id', 'user_id']).doUpdateSet({
        rating,
        comment: comment ?? null,
      }),
    )
    .execute();
};

/**
 * Get aggregate feedback score for an artifact.
 * Returns positive count, negative count, and net score.
 */
export const getArtifactFeedbackScore = async (
  db: Kysely<DB>,
  artifactId: string,
): Promise<{ positive: number; negative: number; netScore: number }> => {
  const positiveResult = await db
    .selectFrom('generation_feedback')
    .where('artifact_id', '=', artifactId)
    .where('rating', '=', 'positive')
    .select(db.fn.count('id').as('count'))
    .executeTakeFirst();

  const negativeResult = await db
    .selectFrom('generation_feedback')
    .where('artifact_id', '=', artifactId)
    .where('rating', '=', 'negative')
    .select(db.fn.count('id').as('count'))
    .executeTakeFirst();

  const positive = Number(positiveResult?.count ?? 0);
  const negative = Number(negativeResult?.count ?? 0);

  return {
    positive,
    negative,
    netScore: positive * 10 - negative * 5, // DDD-205: +10 per positive, -5 per negative
  };
};
