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

export class PostgresProjectQueryRepository implements ProjectQueryRepository {
  private readonly schema: string | undefined;

  constructor(
    private readonly pg: Pool,
    options: PersistenceRepositoryOptions = {},
  ) {
    this.schema = options.projectsSchema;
  }

  private getDb(): Kysely<DB> {
    const db = createKyselyDb(this.pg);
    return this.schema ? db.withSchema(this.schema) : db;
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
        created_at: sql`NOW()` as any,
        updated_at: sql`NOW()` as any,
      })
      .returning(['id', 'user_id', 'name', 'created_at', 'updated_at'])
      .executeTakeFirstOrThrow();

    return mapProjectRowToDetail(row);
  }
}
