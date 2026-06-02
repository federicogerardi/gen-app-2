import { Kysely, sql } from 'kysely';
import type { Pool } from 'pg';

import {
  rowToUserReportGithubLink,
  type UserReportGithubLink,
  type UserReportGithubLinkRow,
} from '../types/feedback-center';

import { createKyselyDb } from './postgres-kysely.dialect';
import type { DB } from './postgres-kysely.types';

function getDb(pool: Pool): Kysely<DB> {
  return createKyselyDb(pool);
}

export const createUserReportGithubLink = async (
  pool: Pool,
  payload: {
    userReportId: string;
    repository: string;
    issueNumber: number;
    issueUrl: string;
    publishedByUserId: string;
  },
): Promise<UserReportGithubLink> => {
  const row = await getDb(pool)
    .insertInto('user_report_github_links')
    .values({
      user_report_id: payload.userReportId,
      repository: payload.repository,
      issue_number: payload.issueNumber,
      issue_url: payload.issueUrl,
      published_by_user_id: payload.publishedByUserId,
      published_at: sql`NOW()` as any,
    })
    .returningAll()
    .executeTakeFirstOrThrow() as unknown as UserReportGithubLinkRow;

  return rowToUserReportGithubLink(row);
};

export const publishUserReportIssueTransaction = async (
  pool: Pool,
  payload: {
    userReportId: string;
    repository: string;
    issueNumber: number;
    issueUrl: string;
    publishedByUserId: string;
  },
): Promise<UserReportGithubLink> => {
  const db = getDb(pool);

  const linkRow = await db.transaction().execute(async (trx) => {
    const inserted = await trx
      .insertInto('user_report_github_links')
      .values({
        user_report_id: payload.userReportId,
        repository: payload.repository,
        issue_number: payload.issueNumber,
        issue_url: payload.issueUrl,
        published_by_user_id: payload.publishedByUserId,
        published_at: sql`NOW()` as any,
      })
      .returningAll()
      .executeTakeFirstOrThrow() as unknown as UserReportGithubLinkRow;

    await trx
      .updateTable('user_reports')
      .set({
        status: 'github-published',
        triaged_by_user_id: sql<string>`COALESCE(triaged_by_user_id, ${payload.publishedByUserId})`,
        triaged_at: sql<Date>`COALESCE(triaged_at, NOW())`,
        updated_at: sql`NOW()` as any,
      })
      .where('id', '=', payload.userReportId)
      .execute();

    return inserted;
  });

  return rowToUserReportGithubLink(linkRow);
};
