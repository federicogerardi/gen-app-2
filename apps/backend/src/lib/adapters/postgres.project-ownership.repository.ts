import { Kysely } from 'kysely';
import type { Pool } from 'pg';

import { createKyselyDb } from './postgres-kysely.dialect';
import type { DB } from './postgres-kysely.types';
import type { ProjectOwnershipRepository } from './postgres-redis.interfaces';
import type { PersistenceRepositoryOptions } from './postgres-redis.shared.types';

export class PostgresProjectOwnershipRepository implements ProjectOwnershipRepository {
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
  }

  private getDb(): Kysely<DB> {
    return this.schema ? this.db.withSchema(this.schema) : this.db;
  }

  async checkProjectOwnership(input: { userId: string; projectId: string }) {
    const row = await this.getDb()
      .selectFrom('projects')
      .select('user_id')
      .where('id', '=', input.projectId)
      .limit(1)
      .executeTakeFirst();

    if (!row) {
      return { owned: false, reason: 'project_not_found' as const };
    }

    if (row.user_id !== input.userId) {
      return { owned: false, reason: 'ownership_forbidden' as const };
    }

    return { owned: true };
  }
}
