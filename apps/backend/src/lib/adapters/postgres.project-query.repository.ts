import { randomUUID } from 'node:crypto';
import { Kysely, sql } from 'kysely';
import type { Pool } from 'pg';

import {
  mapProjectRowToDetail,
  mapProjectRowToSummary,
  type CreateProjectInput,
  type ProjectDetail,
  type ProjectSummary,
} from '../types/projects';

import { createKyselyDb } from './postgres-kysely.dialect';
import type { DB } from './postgres-kysely.types';
import type { ProjectQueryRepository } from './postgres-redis.interfaces';
import type { PersistenceRepositoryOptions } from './postgres-redis.shared.types';

/**
 * Escape hatch: Kysely has no typed builder API for PostgreSQL server-side timestamp functions.
 * NOW() must be expressed via the sql template tag.
 */
const dbNow = sql<Date>`NOW()`;

export class PostgresProjectQueryRepository implements ProjectQueryRepository {
  private readonly db: Kysely<DB>;
  private readonly schema: string | undefined;

  constructor(
    pg: Pool,
    options: PersistenceRepositoryOptions = {},
  ) {
    this.db = createKyselyDb(pg);
    this.schema = options.projectsSchema;
    // Note: options.projectsTableName is accepted for API compatibility but is not applied
    // to queries. With Kysely, the table name is fixed to 'projects' by the DB interface key.
    // A custom table name would require adding it as a key in postgres-kysely.types.ts.
    // Schema qualification is fully supported via db.withSchema(options.projectsSchema).
  }

  private getDb(): Kysely<DB> {
    return this.schema ? this.db.withSchema(this.schema) : this.db;
  }

  async listProjectsByUser(userId: string): Promise<ProjectSummary[]> {
    const rows = await this.getDb()
      .selectFrom('projects')
      .select(['id', 'user_id', 'name', 'created_at', 'updated_at'])
      .where('user_id', '=', userId)
      .orderBy('updated_at', 'desc')
      .orderBy('id', 'desc')
      .execute();

    return rows.map(mapProjectRowToSummary);
  }

  async getProjectByIdForUser(userId: string, projectId: string): Promise<ProjectDetail | null> {
    const row = await this.getDb()
      .selectFrom('projects')
      .select(['id', 'user_id', 'name', 'created_at', 'updated_at'])
      .where('user_id', '=', userId)
      .where('id', '=', projectId)
      .limit(1)
      .executeTakeFirst();

    return row ? mapProjectRowToDetail(row) : null;
  }

  async createProjectForUser(userId: string, input: CreateProjectInput): Promise<ProjectDetail> {
    const projectId = `proj_${randomUUID()}`;
    const row = await this.getDb()
      .insertInto('projects')
      .values({
        id: projectId,
        user_id: userId,
        name: input.name,
        created_at: dbNow,
        updated_at: dbNow,
      })
      .returning(['id', 'user_id', 'name', 'created_at', 'updated_at'])
      .executeTakeFirstOrThrow();

    return mapProjectRowToDetail(row);
  }
}
