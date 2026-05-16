import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import {
  rowToUserReport,
  type UserReport,
  type UserReportCategory,
  type UserReportRow,
  type UserReportStatus,
} from '../types/feedback-center';

const SELECT_COLS =
  'id, category, status, title, description, created_by_user_id, triaged_by_user_id, triaged_at, closed_at, created_at, updated_at';

export const createUserReport = async (
  db: Pool,
  payload: {
    category: UserReportCategory;
    title: string;
    description: string;
    createdByUserId: string;
    id?: string;
  },
): Promise<UserReport> => {
  const result = await db.query<UserReportRow>(
    `INSERT INTO user_reports (id, category, status, title, description, created_by_user_id)
     VALUES ($1, $2, 'submitted', $3, $4, $5)
     RETURNING ${SELECT_COLS}`,
    [payload.id ?? `rpt_${randomUUID()}`, payload.category, payload.title, payload.description, payload.createdByUserId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('Insert returned no row');
  }
  return rowToUserReport(row);
};

export const getUserReportById = async (db: Pool, id: string): Promise<UserReport | null> => {
  const result = await db.query<UserReportRow>(
    `SELECT ${SELECT_COLS}
     FROM user_reports
     WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  return row ? rowToUserReport(row) : null;
};

export const listUserReports = async (
  db: Pool,
  filters?: Partial<{ status: UserReportStatus; category: UserReportCategory }>,
): Promise<UserReport[]> => {
  const clauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  if (filters?.status) {
    clauses.push(`status = $${idx++}`);
    values.push(filters.status);
  }
  if (filters?.category) {
    clauses.push(`category = $${idx++}`);
    values.push(filters.category);
  }
  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await db.query<UserReportRow>(
    `SELECT ${SELECT_COLS}
     FROM user_reports
     ${whereClause}
     ORDER BY created_at DESC`,
    values,
  );
  return result.rows.map(rowToUserReport);
};

export const updateUserReportStatus = async (
  db: Pool,
  payload: {
    id: string;
    status: UserReportStatus;
    actedByUserId: string;
  },
): Promise<UserReport | null> => {
  const setClauses: string[] = ['status = $2', 'updated_at = now()'];
  if (payload.status === 'triaged') {
    setClauses.push('triaged_by_user_id = $3', 'triaged_at = now()');
  }
  if (payload.status === 'closed') {
    setClauses.push('closed_at = now()');
  }
  const result = await db.query<UserReportRow>(
    `UPDATE user_reports
     SET ${setClauses.join(', ')}
     WHERE id = $1
     RETURNING ${SELECT_COLS}`,
    [payload.id, payload.status, payload.actedByUserId],
  );
  const row = result.rows[0];
  return row ? rowToUserReport(row) : null;
};
