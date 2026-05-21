import type { Pool } from 'pg';

import type { ProjectOwnershipRepository } from './postgres-redis.interfaces';
import type { PersistenceRepositoryOptions } from './postgres-redis.shared.types';
import { buildQualifiedTableName } from './postgres-redis.sql.utils';

export class PostgresProjectOwnershipRepository implements ProjectOwnershipRepository {
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

  async checkProjectOwnership(input: { userId: string; projectId: string }) {
    const query = `
      SELECT user_id
      FROM ${this.projectsTableName}
      WHERE id = $1
      LIMIT 1
    `;

    const result = await this.pg.query<{ user_id: string }>(query, [input.projectId]);
    const row = result.rows[0];
    if (!row) {
      return { owned: false, reason: 'project_not_found' };
    }

    if (row.user_id !== input.userId) {
      return { owned: false, reason: 'ownership_forbidden' };
    }

    return { owned: true };
  }
}
