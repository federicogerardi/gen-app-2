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

function getDb(pool: Pool): Kysely<DB> {
  return createKyselyDb(pool);
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
  const row = await getDb(pool)
    .insertInto('user_reports')
    .values({
      id: reportId,
      category: payload.category,
      status: 'submitted',
      title: payload.title,
      description: payload.description,
      created_by_user_id: payload.createdByUserId,
      created_at: sql`NOW()` as any,
      updated_at: sql`NOW()` as any,
    })
    .returningAll()
    .executeTakeFirstOrThrow() as unknown as UserReportRow;

  return rowToUserReport(row);
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
    updated_at: sql`NOW()` as any,
  };

  if (payload.status === 'triaged') {
    setValues.triaged_by_user_id = payload.actedByUserId;
    setValues.triaged_at = sql`NOW()` as any;
  }
  if (payload.status === 'closed') {
    setValues.closed_at = sql`NOW()` as any;
  }

  const row = await getDb(pool)
    .updateTable('user_reports')
    .set(setValues as any)
    .where('id', '=', payload.id)
    .returningAll()
    .executeTakeFirst() as unknown as UserReportRow | undefined;

  return row ? rowToUserReport(row) : null;
};
