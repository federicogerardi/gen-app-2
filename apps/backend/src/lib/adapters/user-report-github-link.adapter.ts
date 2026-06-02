import { Kysely, sql } from 'kysely';
import type { Pool } from 'pg';

import {
  rowToUserReportGithubLink,
  type UserReportGithubLink,
  type UserReportGithubLinkRow,
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
      published_at: dbNow,
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
  console.debug('[publishUserReportIssueTransaction] Starting transaction', {
    userReportId: payload.userReportId,
    issueNumber: payload.issueNumber,
    repository: payload.repository,
  });

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
        published_at: dbNow,
      })
      .returningAll()
      .executeTakeFirstOrThrow() as unknown as UserReportGithubLinkRow;

    console.debug('[publishUserReportIssueTransaction] INSERT user_report_github_links executed');

    await trx
      .updateTable('user_reports')
      .set({
        status: 'github-published',
        // Escape hatch: COALESCE preserves an existing triaged_by_user_id if already set,
        // otherwise falls back to publishedByUserId. Kysely's typed .set() has no API for
        // COALESCE mixing a bare column reference with a parameterized value.
        triaged_by_user_id: sql<string>`COALESCE(triaged_by_user_id, ${payload.publishedByUserId})`,
        // Escape hatch: same pattern — COALESCE preserves existing triaged_at if set.
        triaged_at: sql<Date>`COALESCE(triaged_at, NOW())`,
        updated_at: dbNow,
      })
      .where('id', '=', payload.userReportId)
      .execute();

    console.debug('[publishUserReportIssueTransaction] UPDATE user_reports executed');

    return inserted;
  });

  console.debug('[publishUserReportIssueTransaction] Transaction committed', { linkId: linkRow.user_report_id });
  return rowToUserReportGithubLink(linkRow);
};
