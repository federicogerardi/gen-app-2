import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pool, PoolClient } from 'pg';
import type Redis from 'ioredis';

import { PostgresRedisUsageRepository } from '../adapters/postgres-redis.production';

test('PostgresRedisUsageRepository.claimUsage returns usage_failed on transactional error', async () => {
  const mockClient = {
    async query(queryText: string) {
      if (queryText.includes('SELECT monthly_used, monthly_quota, quota_window_started_at')) {
        throw new Error('forced db failure');
      }

      return {
        rowCount: 0,
        rows: [],
      };
    },
    release() {
      return undefined;
    },
  } as unknown as PoolClient;

  const mockPool = {
    async connect() {
      return mockClient;
    },
  } as unknown as Pool;

  const mockRedis = {
    async incr() {
      return 1;
    },
    async expire() {
      return 1;
    },
  } as unknown as Redis;

  const repository = new PostgresRedisUsageRepository(mockPool, mockRedis);
  const decision = await repository.claimUsage({
    requestId: 'req-usage-db-failure-001',
    userId: 'seed-user-001',
    artifactType: 'content',
    workflowType: null,
    registrySnapshotRef: 'snapshot:usage-db-failure' as never,
  });

  assert.deepEqual(decision, {
    granted: false,
    reason: 'usage_failed',
  });
});
