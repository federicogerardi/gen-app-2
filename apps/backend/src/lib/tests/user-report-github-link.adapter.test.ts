import test from 'node:test';
import assert from 'node:assert/strict';

import { publishUserReportIssueTransaction } from '../adapters/user-report-github-link.adapter';

type QueryCall = {
  sql: string;
  values: unknown[];
};

class TransactionClientStub {
  readonly calls: QueryCall[] = [];
  shouldFailOnUpdate = false;

  async query<T = unknown>(sql: string, values: unknown[] = []): Promise<{ rows: T[]; rowCount?: number; command?: string }> {
    this.calls.push({ sql, values });

    if (sql.toLowerCase() === 'begin' || sql.toLowerCase() === 'commit' || sql.toLowerCase() === 'rollback') {
      return { rows: [] };
    }

    if (sql.toLowerCase().includes('insert into "user_report_github_links"')) {
      return {
        rows: [
          {
            user_report_id: String(values[0]),
            repository: String(values[1]),
            issue_number: Number(values[2]),
            issue_url: String(values[3]),
            published_by_user_id: String(values[4]),
            published_at: new Date('2026-05-16T13:00:00.000Z'),
          } as T,
        ],
        rowCount: 1,
        command: 'INSERT',
      };
    }

    if (sql.toLowerCase().includes('update "user_reports"')) {
      if (this.shouldFailOnUpdate) {
        throw new Error('update failed');
      }
      return { rows: [], rowCount: 1, command: 'UPDATE' };
    }

    throw new Error(`Unsupported SQL: ${sql}`);
  }

  release(): void {}
}

class PoolConnectStub {
  readonly client: TransactionClientStub;

  constructor(client: TransactionClientStub) {
    this.client = client;
  }

  async connect(): Promise<TransactionClientStub> {
    return this.client;
  }
}

test('publishUserReportIssueTransaction commits link insert and status update atomically', async () => {
  const client = new TransactionClientStub();
  const db = new PoolConnectStub(client);

  const link = await publishUserReportIssueTransaction(db as never, {
    userReportId: 'rpt_tx_ok_001',
    repository: 'acme/platform',
    issueNumber: 42,
    issueUrl: 'https://github.com/acme/platform/issues/42',
    publishedByUserId: 'admin_001',
  });

  assert.equal(link.userReportId, 'rpt_tx_ok_001');
  assert.equal(link.issueNumber, 42);

  const callSql = client.calls.map((call) => call.sql);
  assert.equal(callSql[0]?.toLowerCase(), 'begin');
  assert.ok(callSql[1]?.toLowerCase().includes('insert into "user_report_github_links"'));
  assert.ok(callSql[2]?.toLowerCase().includes('update "user_reports"'));
  assert.equal(callSql[3]?.toLowerCase(), 'commit');
});

test('publishUserReportIssueTransaction rolls back when update fails', async () => {
  const client = new TransactionClientStub();
  client.shouldFailOnUpdate = true;
  const db = new PoolConnectStub(client);

  await assert.rejects(
    () => publishUserReportIssueTransaction(db as never, {
      userReportId: 'rpt_tx_fail_001',
      repository: 'acme/platform',
      issueNumber: 43,
      issueUrl: 'https://github.com/acme/platform/issues/43',
      publishedByUserId: 'admin_002',
    }),
    /update failed/,
  );

  const callSql = client.calls.map((call) => call.sql);
  assert.equal(callSql[0]?.toLowerCase(), 'begin');
  assert.ok(callSql.some((sql) => sql.toLowerCase().includes('insert into "user_report_github_links"')));
  assert.ok(callSql.some((sql) => sql.toLowerCase().includes('update "user_reports"')));
  assert.equal(callSql[callSql.length - 1]?.toLowerCase(), 'rollback');
});
