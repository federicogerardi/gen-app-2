import { randomUUID } from 'node:crypto';
import type { Pool, QueryResult } from 'pg';

import {
  mapProjectRowToDetail,
  mapProjectRowToSummary,
  type CreateProjectInput,
  type ProjectDetail,
  type ProjectSummary,
} from '../types/projects';

import type { ProjectQueryRepository } from './postgres-redis.interfaces';
import type { PersistenceRepositoryOptions, ProjectRow } from './postgres-redis.shared.types';
import { buildQualifiedTableName } from './postgres-redis.sql.utils';

export class PostgresProjectQueryRepository implements ProjectQueryRepository {
  private readonly projectsTableName: string;

  constructor(
    private readonly pg: Pool,
    options: PersistenceRepositoryOptions = {},
  ) {
    this.projectsTableName = buildQualifiedTableName(
      options.projectsSchema,
      options.projectsTableName ?? 'projects',
    );
  }

  async listProjectsByUser(userId: string): Promise<ProjectSummary[]> {
    const query = `
      SELECT id, user_id, name, created_at, updated_at
      FROM ${this.projectsTableName}
      WHERE user_id = $1
      ORDER BY updated_at DESC, id DESC
    `;

    const result: QueryResult<ProjectRow> = await this.pg.query(query, [userId]);
    return result.rows.map(mapProjectRowToSummary);
  }

  async getProjectByIdForUser(userId: string, projectId: string): Promise<ProjectDetail | null> {
    const query = `
      SELECT id, user_id, name, created_at, updated_at
      FROM ${this.projectsTableName}
      WHERE user_id = $1 AND id = $2
      LIMIT 1
    `;

    const result: QueryResult<ProjectRow> = await this.pg.query(query, [userId, projectId]);
    const row = result.rows[0];
    return row ? mapProjectRowToDetail(row) : null;
  }

  async createProjectForUser(userId: string, input: CreateProjectInput): Promise<ProjectDetail> {
    const query = `
      INSERT INTO ${this.projectsTableName}
        (id, user_id, name, created_at, updated_at)
      VALUES
        ($1, $2, $3, NOW(), NOW())
      RETURNING id, user_id, name, created_at, updated_at
    `;

    const projectId = `proj_${randomUUID()}`;
    const result: QueryResult<ProjectRow> = await this.pg.query(query, [
      projectId,
      userId,
      input.name,
    ]);
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create project row');
    }

    return mapProjectRowToDetail(row);
  }
}
