import type { Pool, QueryResult } from 'pg';

import {
  mapArtifactRowToDetail,
  mapArtifactRowToSummary,
  type ArtifactDetail,
  type ArtifactListFilters,
  type ArtifactReadProjection,
  type SessionListCursor,
  type SessionListEntry,
  type SessionListPage,
  type ArtifactSummary,
} from '../types/artifacts';

import { normalizeToolWorkflowKey } from '../runtime/workflow-normalizers';

import type { ArtifactQueryRepository } from './postgres-redis.interfaces';
import type { ArtifactRow, PersistenceRepositoryOptions } from './postgres-redis.shared.types';
import { buildQualifiedTableName } from './postgres-redis.sql.utils';

export class PostgresArtifactQueryRepository implements ArtifactQueryRepository {
  private readonly artifactsTableName: string;
  private readonly usersTableName: string;

  constructor(
    private readonly pg: Pool,
    options: PersistenceRepositoryOptions = {},
  ) {
    this.artifactsTableName = buildQualifiedTableName(
      options.artifactsSchema,
      options.artifactsTableName ?? 'artifacts',
    );
    this.usersTableName = buildQualifiedTableName(
      options.usersSchema,
      options.usersTableName ?? 'users',
    );
  }

  private buildProjectedDetailSelect(projection: ArtifactReadProjection): string {
    const includeInput = projection.includeInput === true;
    const includeContent = projection.includeContent === true;

    return [
      'id',
      'request_id',
      'user_id',
      'project_id',
      'type',
      'status',
      'model',
      'workflow_type',
      'session_id',
      'step_key',
      'artifact_role',
      'run_mode',
      includeInput ? 'input_json' : 'NULL::jsonb AS input_json',
      includeContent ? 'content' : "''::text AS content",
      'failure_reason',
      'created_at',
      'updated_at',
    ].join(',\n        ');
  }

  async listArtifacts(filters: ArtifactListFilters): Promise<ArtifactSummary[]> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.type) {
      params.push(filters.type);
      where.push(`a.type = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      where.push(`a.status = $${params.length}`);
    }

    if (filters.projectId) {
      params.push(filters.projectId);
      where.push(`a.project_id = $${params.length}`);
    }

    if (filters.from) {
      params.push(filters.from);
      where.push(`a.updated_at >= $${params.length}::timestamptz`);
    }

    if (filters.to) {
      params.push(filters.to);
      where.push(`a.updated_at <= $${params.length}::timestamptz`);
    }

    const whereClause = where.length > 0 ? where.join(' AND ') : 'TRUE';

    let paginationClause = '';
    if (typeof filters.limit === 'number') {
      params.push(filters.limit);
      paginationClause += `\n      LIMIT $${params.length}`;
    }

    if (typeof filters.offset === 'number') {
      params.push(filters.offset);
      paginationClause += `\n      OFFSET $${params.length}`;
    }

    const query = `
      SELECT
        a.id,
        a.request_id,
        a.user_id,
        u.email AS user_email,
        a.project_id,
        a.type,
        a.status,
        a.model,
        a.workflow_type,
        a.session_id,
        a.step_key,
        a.artifact_role,
        a.run_mode,
        a.created_at,
        a.updated_at
      FROM ${this.artifactsTableName} a
      LEFT JOIN ${this.usersTableName} u ON u.id = a.user_id
      WHERE ${whereClause}
      ORDER BY a.updated_at DESC, a.id DESC
      ${paginationClause}
    `;

    const result: QueryResult<ArtifactRow> = await this.pg.query(query, params);
    return result.rows.map((row): ArtifactSummary => mapArtifactRowToSummary(row));
  }

  async listArtifactsByUser(userId: string, filters: ArtifactListFilters): Promise<ArtifactSummary[]> {
    const where: string[] = ['a.user_id = $1'];
    const params: unknown[] = [userId];

    if (filters.type) {
      params.push(filters.type);
      where.push(`a.type = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      where.push(`a.status = $${params.length}`);
    }

    if (filters.projectId) {
      params.push(filters.projectId);
      where.push(`a.project_id = $${params.length}`);
    }

    if (filters.from) {
      params.push(filters.from);
      where.push(`a.updated_at >= $${params.length}::timestamptz`);
    }

    if (filters.to) {
      params.push(filters.to);
      where.push(`a.updated_at <= $${params.length}::timestamptz`);
    }

    let paginationClause = '';
    if (typeof filters.limit === 'number') {
      params.push(filters.limit);
      paginationClause += `\n      LIMIT $${params.length}`;
    }

    if (typeof filters.offset === 'number') {
      params.push(filters.offset);
      paginationClause += `\n      OFFSET $${params.length}`;
    }

    const query = `
      SELECT
        a.id,
        a.request_id,
        a.user_id,
        u.email AS user_email,
        a.project_id,
        a.type,
        a.status,
        a.model,
        a.workflow_type,
        a.session_id,
        a.step_key,
        a.artifact_role,
        a.run_mode,
        a.created_at,
        a.updated_at
      FROM ${this.artifactsTableName} a
      LEFT JOIN ${this.usersTableName} u ON u.id = a.user_id
      WHERE ${where.join(' AND ')}
      ORDER BY a.updated_at DESC, a.id DESC
      ${paginationClause}
    `;

    const result: QueryResult<ArtifactRow> = await this.pg.query(query, params);
    return result.rows.map((row): ArtifactSummary => mapArtifactRowToSummary(row));
  }

  async listRecentCompletedArtifactsForToolByUser(
    userId: string,
    input: { projectId: string; workflowType: string; limit: number },
  ): Promise<ArtifactSummary[]> {
    const limit = Number.isFinite(input.limit) && input.limit > 0
      ? Math.trunc(input.limit)
      : 0;

    if (limit <= 0) {
      return [];
    }

    const query = `
      SELECT
        a.id,
        a.request_id,
        a.user_id,
        u.email AS user_email,
        a.project_id,
        a.type,
        a.status,
        a.model,
        a.workflow_type,
        a.session_id,
        a.step_key,
        a.artifact_role,
        a.run_mode,
        a.created_at,
        a.updated_at
      FROM ${this.artifactsTableName} a
      LEFT JOIN ${this.usersTableName} u ON u.id = a.user_id
      WHERE a.user_id = $1
        AND a.project_id = $2
        AND a.status = 'completed'
        AND a.workflow_type = $3
      ORDER BY a.updated_at DESC, a.id DESC
      LIMIT $4
    `;

    const result: QueryResult<ArtifactRow> = await this.pg.query(query, [
      userId,
      input.projectId,
      input.workflowType,
      limit,
    ]);
    return result.rows.map((row): ArtifactSummary => mapArtifactRowToSummary(row));
  }

  async countArtifacts(filters: ArtifactListFilters): Promise<number> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.type) {
      params.push(filters.type);
      where.push(`type = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      where.push(`status = $${params.length}`);
    }

    if (filters.projectId) {
      params.push(filters.projectId);
      where.push(`project_id = $${params.length}`);
    }

    if (filters.from) {
      params.push(filters.from);
      where.push(`updated_at >= $${params.length}::timestamptz`);
    }

    if (filters.to) {
      params.push(filters.to);
      where.push(`updated_at <= $${params.length}::timestamptz`);
    }

    const whereClause = where.length > 0 ? where.join(' AND ') : 'TRUE';

    const query = `
      SELECT COUNT(*) as total
      FROM ${this.artifactsTableName}
      WHERE ${whereClause}
    `;

    const result: QueryResult<{ total: string }> = await this.pg.query(query, params);
    return parseInt(result.rows[0]?.total ?? '0', 10);
  }

  async countArtifactsByUser(userId: string, filters: ArtifactListFilters): Promise<number> {
    const where: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];

    if (filters.type) {
      params.push(filters.type);
      where.push(`type = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      where.push(`status = $${params.length}`);
    }

    if (filters.projectId) {
      params.push(filters.projectId);
      where.push(`project_id = $${params.length}`);
    }

    if (filters.from) {
      params.push(filters.from);
      where.push(`updated_at >= $${params.length}::timestamptz`);
    }

    if (filters.to) {
      params.push(filters.to);
      where.push(`updated_at <= $${params.length}::timestamptz`);
    }

    const query = `
      SELECT COUNT(*) as total
      FROM ${this.artifactsTableName}
      WHERE ${where.join(' AND ')}
    `;

    const result: QueryResult<{ total: string }> = await this.pg.query(query, params);
    return parseInt(result.rows[0]?.total ?? '0', 10);
  }

  async getArtifactByIdForUser(
    userId: string,
    artifactId: string,
    projection: ArtifactReadProjection = {
      includeInput: true,
      includeContent: true,
    },
  ): Promise<ArtifactDetail | null> {
    const select = this.buildProjectedDetailSelect(projection);
    const query = `
      SELECT
        ${select}
      FROM ${this.artifactsTableName}
      WHERE user_id = $1 AND id = $2
      LIMIT 1
    `;

    const result: QueryResult<ArtifactRow> = await this.pg.query(query, [userId, artifactId]);
    const row = result.rows[0];
    return row ? mapArtifactRowToDetail(row) : null;
  }

  async getArtifactsByIdsForUser(
    userId: string,
    artifactIds: string[],
    projection: ArtifactReadProjection = {
      includeInput: true,
      includeContent: true,
    },
  ): Promise<ArtifactDetail[]> {
    if (artifactIds.length === 0) {
      return [];
    }

    const select = this.buildProjectedDetailSelect(projection);
    const query = `
      SELECT
        ${select}
      FROM ${this.artifactsTableName}
      WHERE user_id = $1
        AND id = ANY($2::text[])
    `;

    const result: QueryResult<ArtifactRow> = await this.pg.query(query, [userId, artifactIds]);
    return result.rows.map((row) => mapArtifactRowToDetail(row));
  }

  async getArtifactById(
    artifactId: string,
    projection: ArtifactReadProjection = {
      includeInput: true,
      includeContent: true,
    },
  ): Promise<ArtifactDetail | null> {
    const select = this.buildProjectedDetailSelect(projection);
    const query = `
      SELECT
        ${select}
      FROM ${this.artifactsTableName}
      WHERE id = $1
      LIMIT 1
    `;

    const result: QueryResult<ArtifactRow> = await this.pg.query(query, [artifactId]);
    const row = result.rows[0];
    return row ? mapArtifactRowToDetail(row) : null;
  }

  async listArtifactDetailsBySession(
    userId: string,
    sessionId: string,
    projection: ArtifactReadProjection = {
      includeInput: true,
      includeContent: true,
    },
  ): Promise<ArtifactDetail[]> {
    const select = this.buildProjectedDetailSelect(projection);
    const query = `
      SELECT
        ${select}
      FROM ${this.artifactsTableName}
      WHERE user_id = $1 AND session_id = $2
      ORDER BY updated_at ASC, id ASC
    `;

    const result: QueryResult<ArtifactRow> = await this.pg.query(query, [userId, sessionId]);
    return result.rows.map((row) => mapArtifactRowToDetail(row));
  }

  async getArtifactDetailBySessionStep(
    userId: string,
    sessionId: string,
    stepKey: string,
    projection: ArtifactReadProjection = {
      includeInput: true,
      includeContent: true,
    },
  ): Promise<ArtifactDetail | null> {
    const select = this.buildProjectedDetailSelect(projection);
    const query = `
      SELECT
        ${select}
      FROM ${this.artifactsTableName}
      WHERE user_id = $1
        AND session_id = $2
        AND COALESCE(step_key, input_json->'toolWorkflow'->>'stepKey', input_json->>'step') = $3
      ORDER BY updated_at ASC, id ASC
      LIMIT 1
    `;

    const result: QueryResult<ArtifactRow> = await this.pg.query(query, [userId, sessionId, stepKey]);
    const row = result.rows[0];
    return row ? mapArtifactRowToDetail(row) : null;
  }

  async listSessionSummaries(
    userId: string,
    projectId: string | null,
    options: { limit?: number; cursor?: SessionListCursor | null } = {},
  ): Promise<SessionListPage> {
    const where: string[] = [
      'user_id = $1',
      "session_id IS NOT NULL",
      "session_id <> ''",
    ];
    const params: unknown[] = [userId];

    if (projectId) {
      params.push(projectId);
      where.push(`project_id = $${params.length}`);
    }

    const limit = Number.isFinite(options.limit) && (options.limit ?? 0) > 0
      ? Math.trunc(options.limit as number)
      : 500;
    const cursor = options.cursor ?? null;

    const cursorFilter = cursor
      ? `
      WHERE (
        grouped.updated_at < $${params.length + 1}::timestamptz
        OR (
          grouped.updated_at = $${params.length + 1}::timestamptz
          AND grouped.session_id < $${params.length + 2}
        )
      )`
      : '';

    if (cursor) {
      params.push(cursor.updatedAt);
      params.push(cursor.sessionId);
    }

    params.push(limit + 1);
    const limitParam = `$${params.length}`;

    type SessionRow = {
      session_id: string;
      project_id: string | null;
      workflow_type: string | null;
      artifact_count: string;
      updated_at: Date | string;
      status: 'generating' | 'failed' | 'completed';
    };

    const query = `
      WITH grouped AS (
        SELECT
          session_id,
          project_id,
          COUNT(*) AS artifact_count,
          MAX(updated_at) AS updated_at,
          CASE
            WHEN BOOL_OR(status = 'generating') THEN 'generating'
            WHEN BOOL_OR(status = 'failed') THEN 'failed'
            ELSE 'completed'
          END AS status
        FROM ${this.artifactsTableName}
        WHERE ${where.join(' AND ')}
        GROUP BY session_id, project_id
      )
      SELECT
        grouped.session_id,
        grouped.project_id,
        latest.workflow_type,
        grouped.artifact_count,
        grouped.updated_at,
        grouped.status
      FROM grouped
      LEFT JOIN LATERAL (
        SELECT a.workflow_type
        FROM ${this.artifactsTableName} a
        WHERE a.user_id = $1
          AND a.session_id = grouped.session_id
          AND a.project_id = grouped.project_id
        ORDER BY a.updated_at DESC, a.id DESC
        LIMIT 1
      ) latest ON TRUE
      ${cursorFilter}
      ORDER BY grouped.updated_at DESC, grouped.session_id DESC
      LIMIT ${limitParam}
    `;

    const result: QueryResult<SessionRow> = await this.pg.query(query, params);
    const rows = result.rows.slice(0, limit);
    const hasMore = result.rows.length > limit;
    const entries: SessionListEntry[] = rows.map((row) => ({
      sessionId: row.session_id,
      projectId: row.project_id ?? '',
      toolKey: normalizeToolWorkflowKey(row.workflow_type),
      status: row.status === 'generating' || row.status === 'failed' ? row.status : 'completed',
      artifactCount: parseInt(row.artifact_count, 10),
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : row.updated_at.toISOString(),
    }));

    const last = entries[entries.length - 1];
    return {
      entries,
      nextCursor: hasMore && last
        ? { updatedAt: last.updatedAt, sessionId: last.sessionId }
        : null,
    };
  }
}
