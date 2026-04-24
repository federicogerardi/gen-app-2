import assert from 'node:assert/strict';

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
  const redisUrl = process.env.UPSTASH_REDIS_URL;
  if (!redisUrl) {
    throw new Error('Missing Redis URL. Set UPSTASH_REDIS_URL');
  }
  return redisUrl;
};

const run = async () => {
  const databaseUrl = requiredEnv('DATABASE_URL');
  const redisUrl = resolveRedisUrl();

  const pg = new Pool({ connectionString: databaseUrl });
  const redis = new Redis(redisUrl);

  try {
    const adapters = createPostgresRedisProductionGenerationAdapters({ pg, redis });

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

    console.log('Smoke OK: lock present -> conflict');
  } finally {
    await redis.quit();
    await pg.end();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
