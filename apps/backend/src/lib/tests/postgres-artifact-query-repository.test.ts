import test from 'node:test';
import assert from 'node:assert/strict';

import { PostgresArtifactQueryRepository } from '../adapters/generation';

function createMockPool() {
  let capturedSql = '';
  let capturedParams: unknown[] = [];

  const pool = {
    query: async (sql: string, params: unknown[]) => {
      capturedSql = sql;
      capturedParams = params;
      return { rows: [] };
    },
    connect: async () => ({
      query: async (sql: string, params: unknown[]) => {
        capturedSql = sql;
        capturedParams = params;
        return { rows: [] };
      },
      release: () => {},
    }),
    end: async () => {},
  };

  return { pool, getSql: () => capturedSql, getParams: () => capturedParams };
}

test('listArtifactsByUser qualifies artifact filters when joining users', async () => {
  const { pool, getSql, getParams } = createMockPool();

  const repository = new PostgresArtifactQueryRepository(
    pool as unknown as ConstructorParameters<typeof PostgresArtifactQueryRepository>[0],
  );

  await repository.listArtifactsByUser('user-001', {
    status: 'completed',
    projectId: 'proj-001',
  });

  assert.deepEqual(getParams(), ['user-001', 'completed', 'proj-001']);
  assert.match(getSql(), /where "a"\."user_id" = \$1 and "a"\."status" = \$2 and "a"\."project_id" = \$3/i);
  assert.doesNotMatch(getSql(), /where "user_id" = \$1 and "status" = \$2/i);
});

test('listSessionSummaries groups by session only and applies cursor-based pagination', async () => {
  const { pool, getSql, getParams } = createMockPool();

  const repository = new PostgresArtifactQueryRepository(
    pool as unknown as ConstructorParameters<typeof PostgresArtifactQueryRepository>[0],
  );

  await repository.listSessionSummaries('user-001', 'proj-001', {
    limit: 25,
    cursor: {
      updatedAt: '2026-05-21T09:00:00.000Z',
      sessionId: 'sess-100',
    },
  });

  assert.match(getSql(), /group by "session_id", "project_id"/i);
  assert.doesNotMatch(getSql(), /group by "session_id", "project_id", "workflow_type"/i);
  assert.match(getSql(), /"grouped"\."updated_at" desc, "grouped"\."session_id" desc/i);
  assert.match(getSql(), /limit \$8/i);
  assert.deepEqual(getParams(), [
    'user-001',
    'proj-001',
    'user-001',
    1,
    '2026-05-21T09:00:00.000Z',
    '2026-05-21T09:00:00.000Z',
    'sess-100',
    26,
  ]);
});

test('getArtifactDetailBySessionStep queries one step artifact without loading full session', async () => {
  const { pool, getSql, getParams } = createMockPool();

  const repository = new PostgresArtifactQueryRepository(
    pool as unknown as ConstructorParameters<typeof PostgresArtifactQueryRepository>[0],
  );

  await repository.getArtifactDetailBySessionStep('user-001', 'sess-001', 'packaging');

  assert.match(getSql(), /where "user_id" = \$1\s+and "session_id" = \$2/i);
  assert.match(getSql(), /COALESCE\(step_key, input_json->'toolWorkflow'->>'stepKey', input_json->>'step'\) = \$3/i);
  assert.match(getSql(), /order by "updated_at" asc, "id" asc/i);
  assert.match(getSql(), /limit \$4/i);
  assert.deepEqual(getParams(), ['user-001', 'sess-001', 'packaging', 1]);
});

test('artifact detail queries include input and content by default', async () => {
  const { pool, getSql } = createMockPool();

  const repository = new PostgresArtifactQueryRepository(
    pool as unknown as ConstructorParameters<typeof PostgresArtifactQueryRepository>[0],
  );

  await repository.getArtifactById('artifact-001');

  assert.match(getSql(), /"input_json"/i);
  assert.match(getSql(), /"content"/i);
  assert.doesNotMatch(getSql(), /NULL::jsonb as "input_json"/i);
  assert.doesNotMatch(getSql(), /''::text as "content"/i);
});
