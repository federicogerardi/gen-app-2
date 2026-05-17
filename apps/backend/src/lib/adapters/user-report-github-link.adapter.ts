import type { Pool } from 'pg';
import {
  rowToUserReportGithubLink,
  type UserReportGithubLink,
  type UserReportGithubLinkRow,
} from '../types/feedback-center';

const SELECT_COLS =
  'user_report_id, repository, issue_number, issue_url, published_by_user_id, published_at';

export const createUserReportGithubLink = async (
  db: Pool,
  payload: {
    userReportId: string;
    repository: string;
    issueNumber: number;
    issueUrl: string;
    publishedByUserId: string;
  },
): Promise<UserReportGithubLink> => {
  const result = await db.query<UserReportGithubLinkRow>(
    `INSERT INTO user_report_github_links (
       user_report_id,
       repository,
       issue_number,
       issue_url,
       published_by_user_id
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${SELECT_COLS}`,
    [payload.userReportId, payload.repository, payload.issueNumber, payload.issueUrl, payload.publishedByUserId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new Error('Insert returned no row');
  }
  return rowToUserReportGithubLink(row);
};

export const publishUserReportIssueTransaction = async (
  db: Pool,
  payload: {
    userReportId: string;
    repository: string;
    issueNumber: number;
    issueUrl: string;
    publishedByUserId: string;
  },
): Promise<UserReportGithubLink> => {
  console.debug('[publishUserReportIssueTransaction] Starting transaction', { userReportId: payload.userReportId, issueNumber: payload.issueNumber, repository: payload.repository });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    console.debug('[publishUserReportIssueTransaction] Transaction BEGIN');
    
    const linkResult = await client.query<UserReportGithubLinkRow>(
      `INSERT INTO user_report_github_links (
         user_report_id,
         repository,
         issue_number,
         issue_url,
         published_by_user_id
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SELECT_COLS}`,
      [payload.userReportId, payload.repository, payload.issueNumber, payload.issueUrl, payload.publishedByUserId],
    );
    console.debug('[publishUserReportIssueTransaction] INSERT user_report_github_links executed, rows:', linkResult.rows.length);

    const updateResult = await client.query(
      `UPDATE user_reports
       SET status = 'github-published',
           triaged_by_user_id = COALESCE(triaged_by_user_id, $2),
           triaged_at = COALESCE(triaged_at, now()),
           updated_at = now()
       WHERE id = $1`,
      [payload.userReportId, payload.publishedByUserId],
    );
    console.debug('[publishUserReportIssueTransaction] UPDATE user_reports executed, rows affected:', updateResult.rowCount);

    await client.query('COMMIT');
    console.debug('[publishUserReportIssueTransaction] Transaction COMMIT');
    
    const row = linkResult.rows[0];
    if (!row) {
      throw new Error('Insert returned no row');
    }
    const link = rowToUserReportGithubLink(row);
    console.debug('[publishUserReportIssueTransaction] Transaction completed successfully', { linkId: link.userReportId });
    return link;
  } catch (error) {
    console.error('[publishUserReportIssueTransaction] Transaction error, rolling back', { error: error instanceof Error ? { message: error.message, code: (error as any).code } : error });
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    console.debug('[publishUserReportIssueTransaction] Database client released');
  }
};
