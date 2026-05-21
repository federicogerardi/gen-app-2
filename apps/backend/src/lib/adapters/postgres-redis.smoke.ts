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
  const artifactId = 'artifact-smoke-001';
  const idemInput = {
    requestId: 'seed-request-claimed-001',
    userId: 'seed-user-001',
    projectId: 'seed-project-001',
    workflowType: null,
    idempotencyKey: 'seed-idem-claimed-001',
    registrySnapshotRef: 'snapshot:smoke' as never,
  };
  const lockKey = buildIdempotencyRedisLockKey('generation:idempotency', idemInput, 'generation');

  try {
    const adapters = createPostgresRedisProductionGenerationAdapters({ pg, redis });

    await pg.query(
      `DELETE FROM request_idempotency WHERE user_id = $1 AND project_id = $2 AND endpoint = $3 AND idempotency_key = $4`,
      [idemInput.userId, idemInput.projectId, 'generation', idemInput.idempotencyKey],
    );

    await redis.del(lockKey);

    const first = await adapters.idempotency.checkAndClaim(idemInput);
    assert.equal(first.status, 'claimed');

    await pg.query(
      `INSERT INTO artifacts (id, request_id, user_id, project_id, type, workflow_type, model, input_json, content, status)
       VALUES ($1, $2, $3, $4, 'content', NULL, 'smoke-model', '{}'::jsonb, '', 'generating')
       ON CONFLICT (id) DO UPDATE SET updated_at = NOW()`,
      [artifactId, idemInput.requestId, idemInput.userId, idemInput.projectId],
    );

    await adapters.idempotency.markCompleted(
      idemInput,
      artifactId,
      'smoke-content',
    );

    const replay = await adapters.idempotency.checkAndClaim(idemInput);
    assert.equal(replay.status, 'replay');
    assert.equal(replay.artifactId, artifactId);

    console.log('Smoke OK: claimed -> completed -> replay');
  } finally {
    await redis.del(lockKey);
    await pg.query(
      `DELETE FROM request_idempotency WHERE user_id = $1 AND project_id = $2 AND endpoint = $3 AND idempotency_key = $4`,
      [idemInput.userId, idemInput.projectId, 'generation', idemInput.idempotencyKey],
    );
    await pg.query(`DELETE FROM artifacts WHERE id = $1`, [artifactId]);
    await redis.quit();
    await pg.end();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
