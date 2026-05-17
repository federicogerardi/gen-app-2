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
  'ur.id, ur.category, ur.status, ur.title, ur.description, ur.created_by_user_id, ur.triaged_by_user_id, ur.triaged_at, ur.closed_at, ur.created_at, ur.updated_at, gl.issue_url AS github_issue_url';

const SELECT_COLS_NO_ALIAS =
  'id, category, status, title, description, created_by_user_id, triaged_by_user_id, triaged_at, closed_at, created_at, updated_at, NULL::text AS github_issue_url';

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
  const reportId = payload.id ?? `rpt_${randomUUID()}`;
  console.debug('[createUserReport] Starting insert with:', { reportId, category: payload.category, userId: payload.createdByUserId });
  try {
    const result = await db.query<UserReportRow>(
      `INSERT INTO user_reports (id, category, status, title, description, created_by_user_id)
       VALUES ($1, $2, 'submitted', $3, $4, $5)
       RETURNING ${SELECT_COLS_NO_ALIAS}`,
      [reportId, payload.category, payload.title, payload.description, payload.createdByUserId],
    );
    console.debug('[createUserReport] Query executed, rows returned:', result.rows.length);
    const row = result.rows[0];
    if (!row) {
      throw new Error('Insert returned no row');
    }
    const report = rowToUserReport(row);
    console.debug('[createUserReport] Report successfully created:', { id: report.id, status: report.status });
    return report;
  } catch (error) {
    console.error('[createUserReport] Error during insert:', error instanceof Error ? { message: error.message, code: (error as any).code } : error);
    throw error;
  }
};

export const getUserReportById = async (db: Pool, id: string): Promise<UserReport | null> => {
  const result = await db.query<UserReportRow>(
    `SELECT ${SELECT_COLS}
     FROM user_reports ur
     LEFT JOIN user_report_github_links gl ON gl.user_report_id = ur.id
     WHERE ur.id = $1`,
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
    clauses.push(`ur.status = $${idx++}`);
    values.push(filters.status);
  }
  if (filters?.category) {
    clauses.push(`ur.category = $${idx++}`);
    values.push(filters.category);
  }
  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await db.query<UserReportRow>(
    `SELECT ${SELECT_COLS}
     FROM user_reports ur
     LEFT JOIN user_report_github_links gl ON gl.user_report_id = ur.id
     ${whereClause}
     ORDER BY ur.created_at DESC`,
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
     RETURNING ${SELECT_COLS_NO_ALIAS}`,
    [payload.id, payload.status, payload.actedByUserId],
  );
  const row = result.rows[0];
  return row ? rowToUserReport(row) : null;
};
