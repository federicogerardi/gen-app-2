import { Kysely, PostgresDialect } from 'kysely';
import type { Pool } from 'pg';

import type { DB } from './postgres-kysely.types';

/**
 * Factory that wraps a pg Pool into a typed Kysely instance.
 *
 * Schema-qualified table resolution is handled per-query by the owning
 * repository via {@link Kysely.withSchema} (e.g. `db.withSchema('public').selectFrom('artifacts')`).
 * This keeps the global `DB` interface free of deployment-specific schema names.
 */
export function createKyselyDb(pool: Pool): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool,
    }),
  });
}
