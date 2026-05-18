import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import Redis from 'ioredis';
import { Pool } from 'pg';

import {
  buildIdempotencyRedisLockKey,
  createPostgresRedisProductionGenerationAdapters,
} from '../adapters';

const requiredEnv = (name: 'DATABASE_URL'): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const resolveRedisUrl = (): string => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('Missing Redis URL. Set REDIS_URL');
  }
  return redisUrl;
};

const run = async () => {
  const databaseUrl = requiredEnv('DATABASE_URL');
  const redisUrl = resolveRedisUrl();

  const pg = new Pool({ connectionString: databaseUrl });
  const redis = new Redis(redisUrl);

  try {
    const usageRedisKeyPrefix = 'generation:usage:smoke-conflict';
    const adapters = createPostgresRedisProductionGenerationAdapters(
      { pg, redis },
      {
        usage: {
          redisKeyPrefix: usageRedisKeyPrefix,
          maxRequestsPerWindow: 10_000,
        },
      },
    );

    // Keep smoke deterministic even when the DB has not yet applied TASK-005 migration.
    await pg.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS quota_window_started_at timestamptz`);
    await pg.query(
      `UPDATE users
       SET quota_window_started_at = date_trunc('month', COALESCE(created_at, NOW()))
       WHERE quota_window_started_at IS NULL`,
    );

    const idemInput = {
      requestId: 'seed-request-conflict-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      workflowType: null,
      idempotencyKey: 'seed-idempotency-001',
      registrySnapshotRef: 'snapshot:smoke' as never,
    };

    await pg.query(
      `DELETE FROM request_idempotency WHERE user_id = $1 AND project_id = $2 AND endpoint = $3 AND idempotency_key = $4`,
      [idemInput.userId, idemInput.projectId, 'generation', idemInput.idempotencyKey],
    );

    const lockKey = buildIdempotencyRedisLockKey('generation:idempotency', idemInput, 'generation');
    await redis.set(lockKey, 'lock-present', 'EX', 900, 'NX');

    const result = await adapters.idempotency.checkAndClaim(idemInput);
    assert.equal(result.status, 'conflict');

    const runSuffix = randomUUID().slice(0, 8);
    const concurrentUserId = `seed-user-concurrency-${runSuffix}`;
    const concurrentProjectId = `seed-project-concurrency-${runSuffix}`;
    const concurrentEmail = `seed-user-concurrency-${runSuffix}@example.com`;

    await redis.del(`${usageRedisKeyPrefix}:rate:${concurrentUserId}`);

    await pg.query(
      `INSERT INTO users (id, email, monthly_quota, monthly_used)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id)
       DO UPDATE SET monthly_quota = EXCLUDED.monthly_quota, monthly_used = EXCLUDED.monthly_used, updated_at = NOW()`,
      [concurrentUserId, concurrentEmail, 1, 0],
    );

    await pg.query(
      `INSERT INTO projects (id, user_id, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id)
       DO UPDATE SET user_id = EXCLUDED.user_id, name = EXCLUDED.name, updated_at = NOW()`,
      [concurrentProjectId, concurrentUserId, 'Concurrency Project'],
    );

    const claimInput = {
      requestId: 'seed-request-concurrency-001',
      userId: concurrentUserId,
      projectId: concurrentProjectId,
      artifactType: 'content' as const,
      workflowType: null,
      registrySnapshotRef: 'snapshot:smoke' as never,
      adapters: {
        usage: adapters.usage,
      },
    };

    const [decisionA, decisionB] = await Promise.all([
      adapters.usage.claimUsage(claimInput),
      adapters.usage.claimUsage({ ...claimInput, requestId: 'seed-request-concurrency-002' }),
    ]);

    const grantedCount = [decisionA, decisionB].filter((entry) => entry.granted).length;
    const rejectedReasons = [decisionA, decisionB]
      .filter((entry) => !entry.granted)
      .map((entry) => entry.reason);

    assert.equal(grantedCount, 1);
    assert.deepEqual(rejectedReasons, ['quota_exhausted']);

    console.log('Smoke OK: lock present -> conflict');
    console.log('Smoke OK: parallel usage claims -> one grant, one quota_exhausted');
  } finally {
    await redis.quit();
    await pg.end();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
