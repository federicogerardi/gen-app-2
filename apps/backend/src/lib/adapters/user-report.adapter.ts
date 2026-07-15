import { randomUUID } from 'node:crypto';
import { Kysely, sql } from 'kysely';
import type { Pool } from 'pg';

import {
  rowToUserReport,
  type UserReport,
  type UserReportCategory,
  type UserReportRow,
  type UserReportStatus,
} from '../types/feedback-center';

import { createKyselyDb } from './postgres-kysely.dialect';
import type { DB } from './postgres-kysely.types';
import { createComponentLogger, LogComponent } from '../runtime/log-components';

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

export const createUserReport = async (
  pool: Pool,
  payload: {
    category: UserReportCategory;
    title: string;
    description: string;
    createdByUserId: string;
    id?: string;
  },
): Promise<UserReport> => {
  const reportId = payload.id ?? `rpt_${randomUUID()}`;
  const log = createComponentLogger(LogComponent.USER_REPORT);
  log.debug({ reportId, category: payload.category, userId: payload.createdByUserId }, 'createUserReport starting insert');
  try {
    const row = await getDb(pool)
      .insertInto('user_reports')
      .values({
        id: reportId,
        category: payload.category,
        status: 'submitted',
        title: payload.title,
        description: payload.description,
        created_by_user_id: payload.createdByUserId,
        created_at: dbNow,
        updated_at: dbNow,
      })
      .returningAll()
      .executeTakeFirstOrThrow() as unknown as UserReportRow;

    const report = rowToUserReport(row);
    log.debug({ reportId: report.id, status: report.status }, 'createUserReport completed');
    return report;
  } catch (error) {
    log.error({ err: error instanceof Error ? { message: error.message, code: (error as any).code } : error }, 'createUserReport insert failed');
    throw error;
  }
};

export const getUserReportById = async (pool: Pool, id: string): Promise<UserReport | null> => {
  const row = await getDb(pool)
    .selectFrom('user_reports as ur')
    .leftJoin('user_report_github_links as gl', 'gl.user_report_id', 'ur.id')
    .select([
      'ur.id',
      'ur.category',
      'ur.status',
      'ur.title',
      'ur.description',
      'ur.created_by_user_id',
      'ur.triaged_by_user_id',
      'ur.triaged_at',
      'ur.closed_at',
      'ur.created_at',
      'ur.updated_at',
      // Escape hatch: gl.issue_url is a joined column from a LEFT JOIN and needs an alias.
      // Kysely does not support renaming joined columns via the typed .select() API;
      // the sql template tag with .as() is required for cross-table column aliasing.
      sql<string | null>`gl.issue_url`.as('github_issue_url'),
    ])
    .where('ur.id', '=', id)
    .executeTakeFirst() as unknown as UserReportRow | undefined;

  return row ? rowToUserReport(row) : null;
};

export const listUserReports = async (
  pool: Pool,
  filters?: Partial<{ status: UserReportStatus; category: UserReportCategory }>,
): Promise<UserReport[]> => {
  let query = getDb(pool)
    .selectFrom('user_reports as ur')
    .leftJoin('user_report_github_links as gl', 'gl.user_report_id', 'ur.id')
    .select([
      'ur.id',
      'ur.category',
      'ur.status',
      'ur.title',
      'ur.description',
      'ur.created_by_user_id',
      'ur.triaged_by_user_id',
      'ur.triaged_at',
      'ur.closed_at',
      'ur.created_at',
      'ur.updated_at',
      // Escape hatch: same as getUserReportById — cross-table column aliasing requires sql tag.
      sql<string | null>`gl.issue_url`.as('github_issue_url'),
    ]);

  if (filters?.status) {
    query = query.where('ur.status', '=', filters.status);
  }
  if (filters?.category) {
    query = query.where('ur.category', '=', filters.category);
  }

  const rows = await query
    .orderBy('ur.created_at', 'desc')
    .execute() as unknown as UserReportRow[];

  return rows.map(rowToUserReport);
};

export const updateUserReportStatus = async (
  pool: Pool,
  payload: {
    id: string;
    status: UserReportStatus;
    actedByUserId: string;
  },
): Promise<UserReport | null> => {
  const setValues: Record<string, unknown> = {
    status: payload.status,
    updated_at: dbNow,
  };

  if (payload.status === 'triaged') {
    setValues.triaged_by_user_id = payload.actedByUserId;
    setValues.triaged_at = dbNow;
  }
  if (payload.status === 'closed') {
    setValues.closed_at = dbNow;
  }

  const row = await getDb(pool)
    .updateTable('user_reports')
    .set(setValues as any)
    .where('id', '=', payload.id)
    .returningAll()
    .executeTakeFirst() as unknown as UserReportRow | undefined;

  return row ? rowToUserReport(row) : null;
};
