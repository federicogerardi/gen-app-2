import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import {
  rowToProductChangelog,
  type ProductChangelog,
  type ProductChangelogRow,
} from '../types/feedback-center';

const SELECT_COLS =
  'id, title, body, status, created_by_user_id, published_by_user_id, published_at, created_at, updated_at';

export const createProductChangelog = async (
  db: Pool,
  payload: {
    title: string;
    body: string;
    createdByUserId: string;
    id?: string;
  },
): Promise<ProductChangelog> => {
  const result = await db.query<ProductChangelogRow>(
    `INSERT INTO product_changelogs (id, title, body, status, created_by_user_id)
     VALUES ($1, $2, $3, 'draft', $4)
     RETURNING ${SELECT_COLS}`,
    [payload.id ?? `chg_${randomUUID()}`, payload.title, payload.body, payload.createdByUserId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('Insert returned no row');
  }
  return rowToProductChangelog(row);
};

export const publishProductChangelog = async (
  db: Pool,
  payload: {
    id: string;
    publishedByUserId: string;
  },
): Promise<ProductChangelog | null> => {
  const result = await db.query<ProductChangelogRow>(
    `UPDATE product_changelogs
     SET status = 'published',
         published_by_user_id = $2,
         published_at = now(),
         updated_at = now()
     WHERE id = $1
     RETURNING ${SELECT_COLS}`,
    [payload.id, payload.publishedByUserId],
  );
  const row = result.rows[0];
  return row ? rowToProductChangelog(row) : null;
};

export const listPublishedProductChangelogs = async (db: Pool): Promise<ProductChangelog[]> => {
  const result = await db.query<ProductChangelogRow>(
    `SELECT ${SELECT_COLS}
     FROM product_changelogs
     WHERE status = 'published'
     ORDER BY published_at DESC, created_at DESC`,
  );
  return result.rows.map(rowToProductChangelog);
};

export const listProductChangelogs = async (db: Pool): Promise<ProductChangelog[]> => {
  const result = await db.query<ProductChangelogRow>(
    `SELECT ${SELECT_COLS}
     FROM product_changelogs
     ORDER BY created_at DESC`,
  );
  return result.rows.map(rowToProductChangelog);
};
