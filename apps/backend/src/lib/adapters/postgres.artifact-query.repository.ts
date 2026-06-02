import { Kysely, sql } from 'kysely';
import type { Pool } from 'pg';

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
import { createKyselyDb } from './postgres-kysely.dialect';
import type { DB } from './postgres-kysely.types';

export class PostgresArtifactQueryRepository implements ArtifactQueryRepository {
  private readonly db: Kysely<DB>;
  private readonly artifactsSchema: string | undefined;

  constructor(
    pg: Pool,
    options: PersistenceRepositoryOptions = {},
  ) {
    this.db = createKyselyDb(pg);
    this.artifactsSchema = options.artifactsSchema;
    if (options.usersTableName !== undefined && options.usersTableName !== 'users') {
      throw new Error(`Unsupported usersTableName: ${options.usersTableName}`);
    }
    if (
      options.usersSchema !== undefined
      && options.usersSchema !== options.artifactsSchema
    ) {
      throw new Error('usersSchema must match artifactsSchema for artifact query joins');
    }
  }

  private getArtifactDb(): Kysely<DB> {
    return this.artifactsSchema ? this.db.withSchema(this.artifactsSchema) : this.db;
  }

  private buildDetailSelection(projection: ArtifactReadProjection): any[] {
    const includeInput = projection.includeInput === true;
    const includeContent = projection.includeContent === true;

    const fields: any[] = [
      'id', 'request_id', 'user_id', 'project_id', 'type', 'status',
      'model', 'workflow_type', 'session_id', 'step_key', 'artifact_role',
      'run_mode', 'failure_reason', 'created_at', 'updated_at',
    ];

    fields.push(
      includeInput
        ? 'input_json'
        : sql<Record<string, unknown> | null>`NULL::jsonb`.as('input_json'),
    );

    fields.push(
      includeContent
        ? 'content'
        : sql<string>`''::text`.as('content'),
    );

    return fields;
  }

  async listArtifacts(filters: ArtifactListFilters): Promise<ArtifactSummary[]> {
    const db = this.getArtifactDb();

    let query = db
      .selectFrom('artifacts as a')
      .leftJoin('users as u', 'u.id', 'a.user_id')
      .select([
        'a.id', 'a.request_id', 'a.user_id', 'u.email as user_email',
        'a.project_id', 'a.type', 'a.status', 'a.model', 'a.workflow_type',
        'a.session_id', 'a.step_key', 'a.artifact_role', 'a.run_mode',
        'a.created_at', 'a.updated_at',
      ]);

    if (filters.type) {
      query = query.where('a.type', '=', filters.type);
    }
    if (filters.status) {
      query = query.where('a.status', '=', filters.status);
    }
    if (filters.projectId) {
      query = query.where('a.project_id', '=', filters.projectId);
    }
    if (filters.from) {
      // Escape hatch: ::timestamptz cast is PostgreSQL-specific; Kysely's .where() has no
      // typed builder for explicit column type coercion on timestamp comparisons.
      query = query.where(sql<boolean>`a.updated_at >= ${filters.from}::timestamptz`);
    }
    if (filters.to) {
      query = query.where(sql<boolean>`a.updated_at <= ${filters.to}::timestamptz`);
    }

    query = query
      .orderBy('a.updated_at', 'desc')
      .orderBy('a.id', 'desc');

    if (typeof filters.limit === 'number') {
      query = query.limit(filters.limit);
    }
    if (typeof filters.offset === 'number') {
      query = query.offset(filters.offset);
    }

    const rows = await query.execute() as unknown as ArtifactRow[];
    return rows.map(mapArtifactRowToSummary);
  }

  async listArtifactsByUser(userId: string, filters: ArtifactListFilters): Promise<ArtifactSummary[]> {
    const db = this.getArtifactDb();

    let query = db
      .selectFrom('artifacts as a')
      .leftJoin('users as u', 'u.id', 'a.user_id')
      .select([
        'a.id', 'a.request_id', 'a.user_id', 'u.email as user_email',
        'a.project_id', 'a.type', 'a.status', 'a.model', 'a.workflow_type',
        'a.session_id', 'a.step_key', 'a.artifact_role', 'a.run_mode',
        'a.created_at', 'a.updated_at',
      ])
      .where('a.user_id', '=', userId);

    if (filters.type) {
      query = query.where('a.type', '=', filters.type);
    }
    if (filters.status) {
      query = query.where('a.status', '=', filters.status);
    }
    if (filters.projectId) {
      query = query.where('a.project_id', '=', filters.projectId);
    }
    if (filters.from) {
      query = query.where(sql<boolean>`a.updated_at >= ${filters.from}::timestamptz`);
    }
    if (filters.to) {
      query = query.where(sql<boolean>`a.updated_at <= ${filters.to}::timestamptz`);
    }

    query = query
      .orderBy('a.updated_at', 'desc')
      .orderBy('a.id', 'desc');

    if (typeof filters.limit === 'number') {
      query = query.limit(filters.limit);
    }
    if (typeof filters.offset === 'number') {
      query = query.offset(filters.offset);
    }

    const rows = await query.execute() as unknown as ArtifactRow[];
    return rows.map(mapArtifactRowToSummary);
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

    const db = this.getArtifactDb();
    const rows = await db
      .selectFrom('artifacts as a')
      .select([
        'a.id', 'a.request_id', 'a.user_id', 'a.project_id', 'a.type',
        'a.status', 'a.model', 'a.workflow_type', 'a.session_id', 'a.step_key',
        'a.artifact_role', 'a.run_mode', 'a.created_at', 'a.updated_at',
      ])
      .where('a.user_id', '=', userId)
      .where('a.project_id', '=', input.projectId)
      .where('a.status', '=', 'completed')
      .where('a.workflow_type', '=', input.workflowType)
      .orderBy('a.updated_at', 'desc')
      .orderBy('a.id', 'desc')
      .limit(limit)
      .execute() as unknown as ArtifactRow[];

    return rows.map(mapArtifactRowToSummary);
  }

  async countArtifacts(filters: ArtifactListFilters): Promise<number> {
    const db = this.getArtifactDb();

    let query = db
      .selectFrom('artifacts')
      // Escape hatch: count(*) is a PostgreSQL aggregate function; Kysely has no typed
      // builder equivalent for COUNT in a .select() context.
      .select(sql<string>`count(*)`.as('total'));

    if (filters.type) {
      query = query.where('type', '=', filters.type);
    }
    if (filters.status) {
      query = query.where('status', '=', filters.status);
    }
    if (filters.projectId) {
      query = query.where('project_id', '=', filters.projectId);
    }
    if (filters.from) {
      query = query.where(sql<boolean>`updated_at >= ${filters.from}::timestamptz`);
    }
    if (filters.to) {
      query = query.where(sql<boolean>`updated_at <= ${filters.to}::timestamptz`);
    }

    const result = await query.execute();
    return parseInt(result[0]?.total ?? '0', 10);
  }

  async countArtifactsByUser(userId: string, filters: ArtifactListFilters): Promise<number> {
    const db = this.getArtifactDb();

    let query = db
      .selectFrom('artifacts')
      .select(sql<string>`count(*)`.as('total'))
      .where('user_id', '=', userId);

    if (filters.type) {
      query = query.where('type', '=', filters.type);
    }
    if (filters.status) {
      query = query.where('status', '=', filters.status);
    }
    if (filters.projectId) {
      query = query.where('project_id', '=', filters.projectId);
    }
    if (filters.from) {
      query = query.where(sql<boolean>`updated_at >= ${filters.from}::timestamptz`);
    }
    if (filters.to) {
      query = query.where(sql<boolean>`updated_at <= ${filters.to}::timestamptz`);
    }

    const result = await query.execute();
    return parseInt(result[0]?.total ?? '0', 10);
  }

  async getArtifactByIdForUser(
    userId: string,
    artifactId: string,
    projection: ArtifactReadProjection = {
      includeInput: true,
      includeContent: true,
    },
  ): Promise<ArtifactDetail | null> {
    const db = this.getArtifactDb();

    const row = await db
      .selectFrom('artifacts')
      .select(this.buildDetailSelection(projection))
      .where('user_id', '=', userId)
      .where('id', '=', artifactId)
      .limit(1)
      .executeTakeFirst() as unknown as ArtifactRow | undefined;

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

    const db = this.getArtifactDb();

    const rows = await db
      .selectFrom('artifacts')
      .select(this.buildDetailSelection(projection))
      .where('user_id', '=', userId)
      // Escape hatch: id = ANY(...::text[]) uses the PostgreSQL ANY operator with an
      // array cast. Kysely has no typed builder equivalent for ANY with array parameters.
      .where(sql<boolean>`id = ANY(${artifactIds}::text[])`)
      .execute() as unknown as ArtifactRow[];

    return rows.map(mapArtifactRowToDetail);
  }

  async getArtifactById(
    artifactId: string,
    projection: ArtifactReadProjection = {
      includeInput: true,
      includeContent: true,
    },
  ): Promise<ArtifactDetail | null> {
    const db = this.getArtifactDb();

    const row = await db
      .selectFrom('artifacts')
      .select(this.buildDetailSelection(projection))
      .where('id', '=', artifactId)
      .limit(1)
      .executeTakeFirst() as unknown as ArtifactRow | undefined;

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
    const db = this.getArtifactDb();

    const rows = await db
      .selectFrom('artifacts')
      .select(this.buildDetailSelection(projection))
      .where('user_id', '=', userId)
      .where('session_id', '=', sessionId)
      .orderBy('updated_at', 'asc')
      .orderBy('id', 'asc')
      .execute() as unknown as ArtifactRow[];

    return rows.map(mapArtifactRowToDetail);
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
    const db = this.getArtifactDb();

    const row = await db
      .selectFrom('artifacts')
      .select(this.buildDetailSelection(projection))
      .where('user_id', '=', userId)
      .where('session_id', '=', sessionId)
      // Escape hatch: COALESCE across a column and JSONB path operators (->, ->>) cannot
      // be expressed via Kysely's typed .where() builder; requires the sql template tag.
      .where(sql<boolean>`COALESCE(step_key, input_json->'toolWorkflow'->>'stepKey', input_json->>'step') = ${stepKey}`)
      .orderBy('updated_at', 'asc')
      .orderBy('id', 'asc')
      .limit(1)
      .executeTakeFirst() as unknown as ArtifactRow | undefined;

    return row ? mapArtifactRowToDetail(row) : null;
  }

  async listSessionSummaries(
    userId: string,
    projectId: string | null,
    options: { limit?: number; cursor?: SessionListCursor | null } = {},
  ): Promise<SessionListPage> {
    const limit = Number.isFinite(options.limit) && (options.limit ?? 0) > 0
      ? Math.trunc(options.limit as number)
      : 500;
    const cursor = options.cursor ?? null;

    const db = this.getArtifactDb();
    const limitWithExtra = limit + 1;

    let outerQuery = db
      .with('grouped', (qb) => {
        let q = qb
          .selectFrom('artifacts')
          .select([
            'session_id',
            'project_id',
            // Escape hatch: count(*) — no typed Kysely builder equivalent for COUNT.
            sql<string>`count(*)`.as('artifact_count'),
            // Escape hatch: max() — no typed Kysely builder equivalent for MAX aggregate.
            sql<Date>`max(updated_at)`.as('updated_at'),
            // Escape hatch: BOOL_OR is a PostgreSQL aggregate with no Kysely typed builder
            // equivalent. CASE/WHEN also requires the sql template tag for complex conditionals.
            sql<string>`
              CASE
                WHEN BOOL_OR(${sql.ref('status')} = 'generating') THEN 'generating'
                WHEN BOOL_OR(${sql.ref('status')} = 'failed') THEN 'failed'
                ELSE 'completed'
              END
            `.as('status'),
          ])
          .where('user_id', '=', userId)
          .where('session_id', 'is not', null)
          // Escape hatch: session_id <> '' — Kysely's typed .where(col, op, val) would
          // work here but only for the empty string literal; using sql for consistency
          // with the is-not-null check directly above.
          .where(sql<boolean>`session_id <> ''`);

        if (projectId) {
          q = q.where('project_id', '=', projectId);
        }

        return q.groupBy(['session_id', 'project_id']);
      })
      .selectFrom('grouped')
      .leftJoinLateral(
        (eb) => eb
          .selectFrom('artifacts as a')
          .select('a.workflow_type')
          .where('a.user_id', '=', userId)
          .whereRef('a.session_id', '=', 'grouped.session_id')
          .whereRef('a.project_id', '=', 'grouped.project_id')
          .orderBy('a.updated_at', 'desc')
          .orderBy('a.id', 'desc')
          .limit(1)
          .as('latest'),
        (join) => join.onTrue(),
      )
      .select([
        'grouped.session_id',
        'grouped.project_id',
        'latest.workflow_type',
        'grouped.artifact_count',
        'grouped.updated_at',
        'grouped.status',
      ]);

    if (cursor) {
      // Escape hatch: compound cursor comparison (col < val OR (col = val AND col2 < val2))
      // cannot be expressed via Kysely's typed .where() chains without nesting expression
      // builders in a way that is less readable than the direct sql template tag.
      outerQuery = outerQuery.where(sql<boolean>`
        (grouped.updated_at < ${cursor.updatedAt}
         OR (grouped.updated_at = ${cursor.updatedAt} AND grouped.session_id < ${cursor.sessionId}))
      `);
    }

    outerQuery = outerQuery
      .orderBy('grouped.updated_at', 'desc')
      .orderBy('grouped.session_id', 'desc')
      .limit(limitWithExtra);

    const result = await outerQuery.execute();

    const rows = result.slice(0, limit);
    const hasMore = result.length > limit;

    const entries: SessionListEntry[] = rows.map((row) => {
      if (row.session_id === null || row.session_id === '') {
        throw new Error('Session summary row missing session_id after non-null session filter');
      }

      return {
        sessionId: row.session_id,
        projectId: row.project_id ?? '',
        toolKey: normalizeToolWorkflowKey(row.workflow_type),
        status: row.status === 'generating' || row.status === 'failed' ? row.status : 'completed',
        artifactCount: parseInt(row.artifact_count, 10),
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      };
    });

    const last = entries[entries.length - 1];
    return {
      entries,
      nextCursor: hasMore && last
        ? { updatedAt: last.updatedAt, sessionId: last.sessionId }
        : null,
    };
  }
}
