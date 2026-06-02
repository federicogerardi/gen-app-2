import { randomUUID } from 'node:crypto';
import { Kysely, sql } from 'kysely';
import type { Pool } from 'pg';

import {
  rowToProductChangelog,
  type ProductChangelog,
  type ProductChangelogRow,
} from '../types/feedback-center';

import { createKyselyDb } from './postgres-kysely.dialect';
import type { DB } from './postgres-kysely.types';

/**
 * Escape hatch: Kysely has no typed builder API for PostgreSQL server-side timestamp functions.
 * NOW() must be expressed via the sql template tag.
 */
const dbNow = sql<Date>`NOW()`;

/**
 * Module-level Kysely instance cache keyed by pool identity, mirroring the
 * class-based repository pattern (this.db = createKyselyDb(pg) in constructor).
 */
const _kyselyDbCache = new WeakMap<object, Kysely<DB>>();

function getDb(pool: Pool): Kysely<DB> {
  let db = _kyselyDbCache.get(pool);
  if (!db) {
    db = createKyselyDb(pool);
    _kyselyDbCache.set(pool, db);
  }
  return db;
}

export const createProductChangelog = async (
  pool: Pool,
  payload: {
    title: string;
    body: string;
    createdByUserId: string;
    id?: string;
  },
): Promise<ProductChangelog> => {
  const row = await getDb(pool)
    .insertInto('product_changelogs')
    .values({
      id: payload.id ?? `chg_${randomUUID()}`,
      title: payload.title,
      body: payload.body,
      status: 'draft',
      created_by_user_id: payload.createdByUserId,
      created_at: dbNow,
      updated_at: dbNow,
    })
    .returningAll()
    .executeTakeFirstOrThrow() as unknown as ProductChangelogRow;

  return rowToProductChangelog(row);
};

export const publishProductChangelog = async (
  pool: Pool,
  payload: {
    id: string;
    publishedByUserId: string;
  },
): Promise<ProductChangelog | null> => {
  const row = await getDb(pool)
    .updateTable('product_changelogs')
    .set({
      status: 'published',
      published_by_user_id: payload.publishedByUserId,
      published_at: dbNow,
      updated_at: dbNow,
    })
    .where('id', '=', payload.id)
    .returningAll()
    .executeTakeFirst() as unknown as ProductChangelogRow | undefined;

  return row ? rowToProductChangelog(row) : null;
};

export const archiveProductChangelog = async (
  pool: Pool,
  payload: {
    id: string;
    archivedByUserId: string;
  },
): Promise<ProductChangelog | null> => {
  const row = await getDb(pool)
    .updateTable('product_changelogs')
    .set({
      status: 'archived',
      archived_by_user_id: payload.archivedByUserId,
      archived_at: dbNow,
      updated_at: dbNow,
    })
    .where('id', '=', payload.id)
    .returningAll()
    .executeTakeFirst() as unknown as ProductChangelogRow | undefined;

  return row ? rowToProductChangelog(row) : null;
};

export const listPublishedProductChangelogs = async (pool: Pool): Promise<ProductChangelog[]> => {
  const rows = await getDb(pool)
    .selectFrom('product_changelogs')
    .selectAll()
    .where('status', '=', 'published')
    .orderBy('published_at', 'desc')
    .orderBy('created_at', 'desc')
    .execute() as unknown as ProductChangelogRow[];

  return rows.map(rowToProductChangelog);
};

export const listProductChangelogs = async (pool: Pool): Promise<ProductChangelog[]> => {
  const rows = await getDb(pool)
    .selectFrom('product_changelogs')
    .selectAll()
    .orderBy('created_at', 'desc')
    .execute() as unknown as ProductChangelogRow[];

  return rows.map(rowToProductChangelog);
};
