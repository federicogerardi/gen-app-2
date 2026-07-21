/**
 * Asset HTTP Handlers — Tool Asset Management Endpoints
 *
 * Factory function pattern following existing tools-handlers.ts.
 * Handles Asset CRUD, promotion, groups, versions, and discovery.
 *
 * Uses raw SQL queries through pg Pool (matching existing handler patterns).
 *
 * E-001: Factory function following existing patterns
 * E-002: handlePromoteArtifactToAsset
 * E-003: Asset group CRUD handlers
 * E-004: handleCreateAssetVersion with staleness checks
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

import type { AuthSessionPrincipal } from '../../../types/auth';
import type { AssetSource, AssetGroupUsage } from '@gen-app-2/contracts';
import { isAssetType, getCompatibleAssetTypes } from '@gen-app-2/contracts';
import type { AuthHttpWriteErrorFn, AuthHttpWriteSuccessFn } from '../support';

// =====================================================================
// E-001: Factory function dependencies and types
// =====================================================================

export type CreateToolsAssetHandlersDependencies = {
  requireDb: (response: ServerResponse) => Pool | null;
  now: () => Date;
  parseRequestUrl: (request: IncomingMessage) => URL;
  parseJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  requireSessionPrincipal: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<AuthSessionPrincipal | null>;
  writeError: AuthHttpWriteErrorFn;
  writeSuccess: AuthHttpWriteSuccessFn;
};

export type ToolsAssetHandlers = {
  // Asset CRUD
  handleListAssets(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleGetAsset(request: IncomingMessage, response: ServerResponse, assetId: string): Promise<void>;
  handleCreateAsset(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleUpdateAsset(request: IncomingMessage, response: ServerResponse, assetId: string): Promise<void>;
  handleArchiveAsset(request: IncomingMessage, response: ServerResponse, assetId: string): Promise<void>;
  handleReactivateAsset(request: IncomingMessage, response: ServerResponse, assetId: string): Promise<void>;

  // Promotion
  handlePromoteArtifactToAsset(request: IncomingMessage, response: ServerResponse): Promise<void>;

  // Asset Groups
  handleListAssetGroups(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleGetAssetGroup(request: IncomingMessage, response: ServerResponse, groupId: string): Promise<void>;
  handleCreateAssetGroup(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleUpdateAssetGroup(request: IncomingMessage, response: ServerResponse, groupId: string): Promise<void>;
  handleAddAssetToGroup(request: IncomingMessage, response: ServerResponse, groupId: string): Promise<void>;
  handleRemoveAssetFromGroup(request: IncomingMessage, response: ServerResponse, groupId: string, assetId: string): Promise<void>;

  // Versions
  handleListAssetVersions(request: IncomingMessage, response: ServerResponse, assetId: string): Promise<void>;
  handleCreateAssetVersion(request: IncomingMessage, response: ServerResponse, assetId: string): Promise<void>;

  // Discovery
  handleListCompatibleAssets(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleDetectAssetGaps(request: IncomingMessage, response: ServerResponse): Promise<void>;

  // Feedback
  handleGetFeedbackScore(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleRecordFeedback(request: IncomingMessage, response: ServerResponse): Promise<void>;
};

// =====================================================================
// E-002 through E-004: Handler implementations
// =====================================================================

export const createToolsAssetHandlers = (
  deps: CreateToolsAssetHandlersDependencies,
): ToolsAssetHandlers => {
  const {
    requireDb,
    now,
    parseRequestUrl,
    parseJsonBody,
    requireSessionPrincipal,
    writeError,
    writeSuccess,
  } = deps;

  const randomId = () => `ast_${randomUUID()}`;

  const mapAssetRow = (row: Record<string, unknown>) => ({
    assetId: row.id,
    projectId: row.project_id,
    assetType: row.asset_type,
    source: row.source,
    sourceArtifactId: row.source_artifact_id,
    status: row.status,
    content: row.content,
    label: row.label,
    currentVersion: row.current_version,
    staleUpstream: row.stale_upstream,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  });

  const mapGroupRow = (row: Record<string, unknown>, assetIds: string[] = []) => ({
    groupId: row.id,
    projectId: row.project_id,
    label: row.label,
    assetIds,
    groupUsage: row.group_usage,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  });

  const mapVersionRow = (row: Record<string, unknown>) => ({
    versionNumber: row.version_number,
    assetId: row.asset_id,
    content: row.content,
    sourceArtifactId: row.source_artifact_id,
    createdAt: (row.created_at as Date).toISOString(),
  });

  // -------------------------------------------------------------------
  // Asset CRUD handlers
  // -------------------------------------------------------------------

  const handleListAssets = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for asset list');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const db = requireDb(response);
    if (!db) return;

    const searchParams = parseRequestUrl(request).searchParams;
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      writeError(response, 400, 'bad_request', 'projectId is required');
      return;
    }

    const assetTypeParam = searchParams.get('assetType');
    const statusParam = searchParams.get('status');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    const limit = limitParam ? Math.min(Number.parseInt(limitParam, 10) || 100, 500) : 100;
    const offset = offsetParam ? Math.max(Number.parseInt(offsetParam, 10) || 0, 0) : 0;

    let query = 'SELECT * FROM assets WHERE project_id = $1';
    const params: unknown[] = [projectId];
    let paramIdx = 2;

    if (assetTypeParam && isAssetType(assetTypeParam)) {
      query += ` AND asset_type = $${paramIdx}`;
      params.push(assetTypeParam);
      paramIdx++;
    }

    if (statusParam === 'active' || statusParam === 'archived') {
      query += ` AND status = $${paramIdx}`;
      params.push(statusParam);
      paramIdx++;
    }

    query += ' ORDER BY created_at DESC';
    query += ` LIMIT $${paramIdx}`;
    params.push(limit);
    paramIdx++;
    query += ` OFFSET $${paramIdx}`;
    params.push(offset);

    const result = await db.query(query, params);
    const assets = result.rows.map(mapAssetRow);

    // Count total
    let countQuery = 'SELECT COUNT(*)::int as count FROM assets WHERE project_id = $1';
    const countParams: unknown[] = [projectId];
    let countParamIdx = 2;

    if (assetTypeParam && isAssetType(assetTypeParam)) {
      countQuery += ` AND asset_type = $${countParamIdx}`;
      countParams.push(assetTypeParam);
      countParamIdx++;
    }

    if (statusParam === 'active' || statusParam === 'archived') {
      countQuery += ` AND status = $${countParamIdx}`;
      countParams.push(statusParam);
      countParamIdx++;
    }

    const countResult = await db.query(countQuery, countParams);
    const total = countResult.rows[0]?.count ?? 0;

    writeSuccess(response, 200, {
      assets,
      total,
      limit,
      offset,
    });
  };

  const handleGetAsset = async (
    request: IncomingMessage,
    response: ServerResponse,
    assetId: string,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for asset detail');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const db = requireDb(response);
    if (!db) return;

    const result = await db.query('SELECT * FROM assets WHERE id = $1', [assetId]);
    if (result.rows.length === 0) {
      writeError(response, 404, 'not_found', 'Asset not found');
      return;
    }

    writeSuccess(response, 200, { asset: mapAssetRow(result.rows[0]) });
  };

  const handleCreateAsset = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST to create asset');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const db = requireDb(response);
    if (!db) return;

    const body = await parseJsonBody<{
      projectId?: string;
      assetType?: string;
      source?: string;
      content?: string;
      label?: string;
    }>(request);

    if (!body.projectId || !body.assetType || !body.source || !body.label) {
      writeError(response, 400, 'bad_request', 'projectId, assetType, source, and label are required');
      return;
    }

    if (!isAssetType(body.assetType)) {
      writeError(response, 400, 'bad_request', `Invalid assetType: ${body.assetType}`);
      return;
    }

    const validSources: AssetSource[] = ['generated', 'uploaded', 'manual'];
    if (!validSources.includes(body.source as AssetSource)) {
      writeError(response, 400, 'bad_request', `Invalid source: ${body.source}`);
      return;
    }

    const id = randomId();
    const currentTime = now();

    await db.query(
      `INSERT INTO assets (id, project_id, asset_type, source, source_artifact_id, status, content, label, current_version, stale_upstream, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, 1, false, $8, $8)`,
      [id, body.projectId, body.assetType, body.source, null, body.content ?? '', body.label, currentTime],
    );

    const result = await db.query('SELECT * FROM assets WHERE id = $1', [id]);
    writeSuccess(response, 201, { asset: mapAssetRow(result.rows[0]) });
  };

  const handleUpdateAsset = async (
    request: IncomingMessage,
    response: ServerResponse,
    assetId: string,
  ): Promise<void> => {
    if (request.method !== 'PUT') {
      writeError(response, 405, 'method_not_allowed', 'Use PUT to update asset');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const db = requireDb(response);
    if (!db) return;

    const body = await parseJsonBody<{
      label?: string;
      content?: string;
      status?: string;
    }>(request);

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (body.label !== undefined) {
      updates.push(`label = $${paramIdx}`);
      params.push(body.label);
      paramIdx++;
    }
    if (body.content !== undefined) {
      updates.push(`content = $${paramIdx}`);
      params.push(body.content);
      paramIdx++;
    }
    if (body.status !== undefined) {
      if (body.status !== 'active' && body.status !== 'archived') {
        writeError(response, 400, 'bad_request', `Invalid status: ${body.status}`);
        return;
      }
      updates.push(`status = $${paramIdx}`);
      params.push(body.status);
      paramIdx++;
    }

    if (updates.length === 0) {
      writeError(response, 400, 'bad_request', 'No fields to update');
      return;
    }

    updates.push(`updated_at = $${paramIdx}`);
    params.push(now());
    paramIdx++;

    params.push(assetId);

    await db.query(
      `UPDATE assets SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
      params,
    );

    const result = await db.query('SELECT * FROM assets WHERE id = $1', [assetId]);
    if (result.rows.length === 0) {
      writeError(response, 404, 'not_found', 'Asset not found');
      return;
    }

    writeSuccess(response, 200, { asset: mapAssetRow(result.rows[0]) });
  };

  const handleArchiveAsset = async (
    request: IncomingMessage,
    response: ServerResponse,
    assetId: string,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST to archive asset');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const db = requireDb(response);
    if (!db) return;

    await db.query(
      'UPDATE assets SET status = $1, updated_at = $2 WHERE id = $3',
      ['archived', now(), assetId],
    );

    const result = await db.query('SELECT * FROM assets WHERE id = $1', [assetId]);
    if (result.rows.length === 0) {
      writeError(response, 404, 'not_found', 'Asset not found');
      return;
    }

    writeSuccess(response, 200, { asset: mapAssetRow(result.rows[0]) });
  };

  const handleReactivateAsset = async (
    request: IncomingMessage,
    response: ServerResponse,
    assetId: string,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST to reactivate asset');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const db = requireDb(response);
    if (!db) return;

    await db.query(
      'UPDATE assets SET status = $1, updated_at = $2 WHERE id = $3',
      ['active', now(), assetId],
    );

    const result = await db.query('SELECT * FROM assets WHERE id = $1', [assetId]);
    if (result.rows.length === 0) {
      writeError(response, 404, 'not_found', 'Asset not found');
      return;
    }

    writeSuccess(response, 200, { asset: mapAssetRow(result.rows[0]) });
  };

  // -------------------------------------------------------------------
  // E-002: Promotion handler
  // -------------------------------------------------------------------

  const handlePromoteArtifactToAsset = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST to promote artifact');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const db = requireDb(response);
    if (!db) return;

    const body = await parseJsonBody<{
      artifactId?: string;
      projectId?: string;
      assetType?: string;
      label?: string;
    }>(request);

    if (!body.artifactId || !body.projectId || !body.assetType || !body.label) {
      writeError(response, 400, 'bad_request', 'artifactId, projectId, assetType, and label are required');
      return;
    }

    if (!isAssetType(body.assetType)) {
      writeError(response, 400, 'bad_request', `Invalid assetType: ${body.assetType}`);
      return;
    }

    // Fetch the artifact to get its content
    const artifactResult = await db.query(
      'SELECT content, status FROM artifacts WHERE id = $1 AND project_id = $2',
      [body.artifactId, body.projectId],
    );

    if (artifactResult.rows.length === 0) {
      writeError(response, 404, 'not_found', 'Artifact not found');
      return;
    }

    const artifact = artifactResult.rows[0];
    if (artifact.status !== 'completed') {
      writeError(response, 400, 'bad_request', 'Only completed artifacts can be promoted');
      return;
    }

    const id = randomId();
    const currentTime = now();

    await db.query(
      `INSERT INTO assets (id, project_id, asset_type, source, source_artifact_id, status, content, label, current_version, stale_upstream, created_at, updated_at)
       VALUES ($1, $2, $3, 'generated', $4, 'active', $5, $6, 1, false, $7, $7)`,
      [id, body.projectId, body.assetType, body.artifactId, artifact.content, body.label, currentTime],
    );

    const result = await db.query('SELECT * FROM assets WHERE id = $1', [id]);
    writeSuccess(response, 201, { asset: mapAssetRow(result.rows[0]) });
  };

  // -------------------------------------------------------------------
  // E-003: Asset Group handlers
  // -------------------------------------------------------------------

  const handleListAssetGroups = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for asset groups list');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const db = requireDb(response);
    if (!db) return;

    const searchParams = parseRequestUrl(request).searchParams;
    const projectId = searchParams.get('projectId');
    if (!projectId) {
      writeError(response, 400, 'bad_request', 'projectId is required');
      return;
    }

    const groupsResult = await db.query(
      'SELECT * FROM asset_groups WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId],
    );

    const groups = [];
    for (const groupRow of groupsResult.rows) {
      const membersResult = await db.query(
        'SELECT asset_id FROM asset_group_members WHERE group_id = $1 ORDER BY position ASC',
        [groupRow.id],
      );
      groups.push(mapGroupRow(groupRow, membersResult.rows.map((r) => r.asset_id)));
    }

    writeSuccess(response, 200, { groups });
  };

  const handleGetAssetGroup = async (
    request: IncomingMessage,
    response: ServerResponse,
    groupId: string,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for asset group detail');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const db = requireDb(response);
    if (!db) return;

    const groupResult = await db.query('SELECT * FROM asset_groups WHERE id = $1', [groupId]);
    if (groupResult.rows.length === 0) {
      writeError(response, 404, 'not_found', 'Asset group not found');
      return;
    }

    const membersResult = await db.query(
      'SELECT asset_id FROM asset_group_members WHERE group_id = $1 ORDER BY position ASC',
      [groupId],
    );

    writeSuccess(response, 200, {
      group: mapGroupRow(groupResult.rows[0], membersResult.rows.map((r) => r.asset_id)),
    });
  };

  const handleCreateAssetGroup = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST to create asset group');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const db = requireDb(response);
    if (!db) return;

    const body = await parseJsonBody<{
      projectId?: string;
      label?: string;
      groupUsage?: string;
      assetIds?: string[];
    }>(request);

    if (!body.projectId || !body.label) {
      writeError(response, 400, 'bad_request', 'projectId and label are required');
      return;
    }

    const validUsages: AssetGroupUsage[] = ['individual', 'bundled'];
    const groupUsage = (body.groupUsage && validUsages.includes(body.groupUsage as AssetGroupUsage))
      ? body.groupUsage as AssetGroupUsage
      : 'individual';

    const id = randomId();
    const currentTime = now();

    await db.query(
      `INSERT INTO asset_groups (id, project_id, label, group_usage, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)`,
      [id, body.projectId, body.label, groupUsage, currentTime],
    );

    // Insert members if provided
    if (body.assetIds && body.assetIds.length > 0) {
      for (let i = 0; i < body.assetIds.length; i++) {
        await db.query(
          `INSERT INTO asset_group_members (group_id, asset_id, position, created_at)
           VALUES ($1, $2, $3, $4)`,
          [id, body.assetIds[i], i, currentTime],
        );
      }
    }

    const groupResult = await db.query('SELECT * FROM asset_groups WHERE id = $1', [id]);
    const membersResult = await db.query(
      'SELECT asset_id FROM asset_group_members WHERE group_id = $1 ORDER BY position ASC',
      [id],
    );

    writeSuccess(response, 201, {
      group: mapGroupRow(groupResult.rows[0], membersResult.rows.map((r) => r.asset_id)),
    });
  };

  const handleUpdateAssetGroup = async (
    request: IncomingMessage,
    response: ServerResponse,
    groupId: string,
  ): Promise<void> => {
    if (request.method !== 'PUT') {
      writeError(response, 405, 'method_not_allowed', 'Use PUT to update asset group');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const db = requireDb(response);
    if (!db) return;

    const body = await parseJsonBody<{
      label?: string;
      groupUsage?: string;
    }>(request);

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (body.label !== undefined) {
      updates.push(`label = $${paramIdx}`);
      params.push(body.label);
      paramIdx++;
    }
    if (body.groupUsage !== undefined) {
      const validUsages: AssetGroupUsage[] = ['individual', 'bundled'];
      if (!validUsages.includes(body.groupUsage as AssetGroupUsage)) {
        writeError(response, 400, 'bad_request', `Invalid groupUsage: ${body.groupUsage}`);
        return;
      }
      updates.push(`group_usage = $${paramIdx}`);
      params.push(body.groupUsage);
      paramIdx++;
    }

    if (updates.length === 0) {
      writeError(response, 400, 'bad_request', 'No fields to update');
      return;
    }

    updates.push(`updated_at = $${paramIdx}`);
    params.push(now());
    paramIdx++;

    params.push(groupId);

    await db.query(
      `UPDATE asset_groups SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
      params,
    );

    const groupResult = await db.query('SELECT * FROM asset_groups WHERE id = $1', [groupId]);
    if (groupResult.rows.length === 0) {
      writeError(response, 404, 'not_found', 'Asset group not found');
      return;
    }

    const membersResult = await db.query(
      'SELECT asset_id FROM asset_group_members WHERE group_id = $1 ORDER BY position ASC',
      [groupId],
    );

    writeSuccess(response, 200, {
      group: mapGroupRow(groupResult.rows[0], membersResult.rows.map((r) => r.asset_id)),
    });
  };

  const handleAddAssetToGroup = async (
    request: IncomingMessage,
    response: ServerResponse,
    groupId: string,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST to add asset to group');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const db = requireDb(response);
    if (!db) return;

    const body = await parseJsonBody<{
      assetId?: string;
      position?: number;
    }>(request);

    if (!body.assetId) {
      writeError(response, 400, 'bad_request', 'assetId is required');
      return;
    }

    // Get max position if not specified
    let position = body.position;
    if (position === undefined) {
      const maxPosResult = await db.query(
        'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM asset_group_members WHERE group_id = $1',
        [groupId],
      );
      position = maxPosResult.rows[0]?.next_pos ?? 0;
    }

    await db.query(
      `INSERT INTO asset_group_members (group_id, asset_id, position, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (group_id, asset_id) DO UPDATE SET position = $3`,
      [groupId, body.assetId, position, now()],
    );

    writeSuccess(response, 200, { ok: true });
  };

  const handleRemoveAssetFromGroup = async (
    request: IncomingMessage,
    response: ServerResponse,
    groupId: string,
    assetId: string,
  ): Promise<void> => {
    if (request.method !== 'DELETE') {
      writeError(response, 405, 'method_not_allowed', 'Use DELETE to remove asset from group');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const db = requireDb(response);
    if (!db) return;

    await db.query(
      'DELETE FROM asset_group_members WHERE group_id = $1 AND asset_id = $2',
      [groupId, assetId],
    );

    writeSuccess(response, 200, { ok: true });
  };

  // -------------------------------------------------------------------
  // E-004: Version handlers
  // -------------------------------------------------------------------

  const handleListAssetVersions = async (
    request: IncomingMessage,
    response: ServerResponse,
    assetId: string,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for asset versions');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const db = requireDb(response);
    if (!db) return;

    const result = await db.query(
      'SELECT * FROM asset_versions WHERE asset_id = $1 ORDER BY version_number DESC',
      [assetId],
    );

    writeSuccess(response, 200, {
      versions: result.rows.map(mapVersionRow),
    });
  };

  const handleCreateAssetVersion = async (
    request: IncomingMessage,
    response: ServerResponse,
    assetId: string,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST to create asset version');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const db = requireDb(response);
    if (!db) return;

    // Get current asset to determine next version number
    const assetResult = await db.query('SELECT * FROM assets WHERE id = $1', [assetId]);
    if (assetResult.rows.length === 0) {
      writeError(response, 404, 'not_found', 'Asset not found');
      return;
    }

    const asset = assetResult.rows[0];
    const body = await parseJsonBody<{
      content?: string;
      sourceArtifactId?: string;
    }>(request);

    if (!body.content) {
      writeError(response, 400, 'bad_request', 'content is required');
      return;
    }

    const nextVersion = asset.current_version + 1;
    const currentTime = now();

    // Use transaction for atomicity
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO asset_versions (asset_id, version_number, content, source_artifact_id, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [assetId, nextVersion, body.content, body.sourceArtifactId ?? null, currentTime],
      );

      await client.query(
        'UPDATE assets SET current_version = $1, updated_at = $2 WHERE id = $3',
        [nextVersion, currentTime, assetId],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const versionResult = await db.query(
      'SELECT * FROM asset_versions WHERE asset_id = $1 AND version_number = $2',
      [assetId, nextVersion],
    );

    writeSuccess(response, 201, { version: mapVersionRow(versionResult.rows[0]) });
  };

  // -------------------------------------------------------------------
  // Discovery handlers
  // -------------------------------------------------------------------

  const handleListCompatibleAssets = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for compatible assets');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const db = requireDb(response);
    if (!db) return;

    const searchParams = parseRequestUrl(request).searchParams;
    const projectId = searchParams.get('projectId');
    const toolKey = searchParams.get('toolKey');

    if (!projectId || !toolKey) {
      writeError(response, 400, 'bad_request', 'projectId and toolKey are required');
      return;
    }

    const { required, optional } = getCompatibleAssetTypes(
      toolKey as Parameters<typeof getCompatibleAssetTypes>[0],
    );
    const compatibleTypes = [...required, ...optional];

    if (compatibleTypes.length === 0) {
      writeSuccess(response, 200, { compatibleAssets: [] });
      return;
    }

    const result = await db.query(
      'SELECT * FROM assets WHERE project_id = $1 AND status = $2 AND asset_type = ANY($3) ORDER BY created_at DESC',
      [projectId, 'active', compatibleTypes],
    );

    writeSuccess(response, 200, {
      compatibleAssets: result.rows.map(mapAssetRow),
    });
  };

  const handleDetectAssetGaps = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for asset gaps');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const db = requireDb(response);
    if (!db) return;

    const searchParams = parseRequestUrl(request).searchParams;
    const projectId = searchParams.get('projectId');
    const toolKey = searchParams.get('toolKey');

    if (!projectId || !toolKey) {
      writeError(response, 400, 'bad_request', 'projectId and toolKey are required');
      return;
    }

    const { required, optional } = getCompatibleAssetTypes(
      toolKey as Parameters<typeof getCompatibleAssetTypes>[0],
    );

    // Get existing active AssetTypes in the project
    const existingResult = await db.query(
      'SELECT DISTINCT asset_type FROM assets WHERE project_id = $1 AND status = $2',
      [projectId, 'active'],
    );
    const existingTypeSet = new Set(existingResult.rows.map((r) => r.asset_type));

    // Find missing types
    const allConsumed = [...required, ...optional];
    const gaps: { assetType: string; canBeProducedBy: string[] }[] = [];

    for (const assetType of allConsumed) {
      if (!existingTypeSet.has(assetType)) {
        gaps.push({
          assetType,
          canBeProducedBy: [],
        });
      }
    }

    writeSuccess(response, 200, { gaps });
  };

  const handleGetFeedbackScore = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for feedback score');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const db = requireDb(response);
    if (!db) return;

    const searchParams = parseRequestUrl(request).searchParams;
    const artifactId = searchParams.get('artifactId');
    if (!artifactId) {
      writeError(response, 400, 'bad_request', 'artifactId is required');
      return;
    }

    const positiveResult = await db.query(
      `SELECT COUNT(*) as count FROM generation_feedback WHERE artifact_id = $1 AND rating = 'positive'`,
      [artifactId],
    );
    const negativeResult = await db.query(
      `SELECT COUNT(*) as count FROM generation_feedback WHERE artifact_id = $1 AND rating = 'negative'`,
      [artifactId],
    );

    // Check if current user has voted
    const userVoteResult = await db.query(
      `SELECT rating FROM generation_feedback WHERE artifact_id = $1 AND user_id = $2`,
      [artifactId, principal.user.id],
    );

    const positive = Number(positiveResult.rows[0]?.count ?? 0);
    const negative = Number(negativeResult.rows[0]?.count ?? 0);
    const userVote = userVoteResult.rows[0]?.rating ?? null;

    writeSuccess(response, 200, {
      positive,
      negative,
      netScore: positive * 10 - negative * 5,
      userVote,
    });
  };

  const handleRecordFeedback = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST to record feedback');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const db = requireDb(response);
    if (!db) return;

    const body = await parseJsonBody<{
      artifactId?: string;
      rating?: string;
      comment?: string;
    }>(request);

    if (!body.artifactId || !body.rating) {
      writeError(response, 400, 'bad_request', 'artifactId and rating are required');
      return;
    }

    if (body.rating !== 'positive' && body.rating !== 'negative') {
      writeError(response, 400, 'bad_request', 'rating must be "positive" or "negative"');
      return;
    }

    // Verify artifact exists
    const artifactResult = await db.query(
      'SELECT id FROM artifacts WHERE id = $1',
      [body.artifactId],
    );
    if (artifactResult.rows.length === 0) {
      writeError(response, 404, 'not_found', 'Artifact not found');
      return;
    }

    // Upsert feedback (one per user per artifact)
    await db.query(
      `INSERT INTO generation_feedback (artifact_id, user_id, rating, comment, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (artifact_id, user_id) DO UPDATE SET rating = $3, comment = $4`,
      [body.artifactId, principal.user.id, body.rating, body.comment ?? null],
    );

    // Get updated scores
    const positiveResult = await db.query(
      `SELECT COUNT(*) as count FROM generation_feedback WHERE artifact_id = $1 AND rating = 'positive'`,
      [body.artifactId],
    );
    const negativeResult = await db.query(
      `SELECT COUNT(*) as count FROM generation_feedback WHERE artifact_id = $1 AND rating = 'negative'`,
      [body.artifactId],
    );

    const positive = Number(positiveResult.rows[0]?.count ?? 0);
    const negative = Number(negativeResult.rows[0]?.count ?? 0);

    writeSuccess(response, 200, {
      ok: true,
      positive,
      negative,
      netScore: positive * 10 - negative * 5,
      userVote: body.rating,
    });
  };

  return {
    handleListAssets,
    handleGetAsset,
    handleCreateAsset,
    handleUpdateAsset,
    handleArchiveAsset,
    handleReactivateAsset,
    handlePromoteArtifactToAsset,
    handleListAssetGroups,
    handleGetAssetGroup,
    handleCreateAssetGroup,
    handleUpdateAssetGroup,
    handleAddAssetToGroup,
    handleRemoveAssetFromGroup,
    handleListAssetVersions,
    handleCreateAssetVersion,
    handleListCompatibleAssets,
    handleDetectAssetGaps,
    handleGetFeedbackScore,
    handleRecordFeedback,
  };
};
