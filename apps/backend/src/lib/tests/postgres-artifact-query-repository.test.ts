import test from 'node:test';
import assert from 'node:assert/strict';

import { PostgresArtifactQueryRepository } from '../adapters';

test('listArtifactsByUser qualifies artifact filters when joining users', async () => {
  let capturedSql = '';
  let capturedParams: unknown[] = [];

  const pg = {
    query: async (sql: string, params: unknown[]) => {
      capturedSql = sql;
      capturedParams = params;
      return { rows: [] };
    },
  };

  const repository = new PostgresArtifactQueryRepository(
    pg as unknown as ConstructorParameters<typeof PostgresArtifactQueryRepository>[0],
  );

  await repository.listArtifactsByUser('user-001', {
    status: 'completed',
    projectId: 'proj-001',
  });

  assert.deepEqual(capturedParams, ['user-001', 'completed', 'proj-001']);
  assert.match(capturedSql, /WHERE a\.user_id = \$1 AND a\.status = \$2 AND a\.project_id = \$3/);
  assert.doesNotMatch(capturedSql, /WHERE user_id = \$1 AND status = \$2/);
});