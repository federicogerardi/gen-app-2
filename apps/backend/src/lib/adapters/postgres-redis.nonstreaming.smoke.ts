import assert from 'node:assert/strict';

import Redis from 'ioredis';
import { Pool } from 'pg';

import {
  buildIdempotencyRedisLockKey,
  createPostgresRedisProductionGenerationAdapters,
} from '../adapters';
import { createSmokeCleanup } from './smoke-cleanup';
import { runBackendGenerationSessionAsJson } from '../runtime/backend-session';

const requiredEnv = (name: 'DATABASE_URL' | 'REDIS_URL'): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const run = async () => {
  const databaseUrl = requiredEnv('DATABASE_URL');
  const redisUrl = requiredEnv('REDIS_URL');

  const pg = new Pool({ connectionString: databaseUrl });
  const redis = new Redis(redisUrl);
  const cleanup = createSmokeCleanup();

  const userId = 'seed-user-smoke-001';
  const projectId = 'seed-project-smoke-001';
  const idempotencyKey = `seed-idem-nonstream-${Date.now()}`;
  const requestId = `seed-req-nonstream-${Date.now()}`;
  const artifactId = `artifact-nonstream-${Date.now()}`;
  const lockKey = buildIdempotencyRedisLockKey('generation:idempotency', {
    requestId,
    userId,
    projectId,
    workflowType: null,
    idempotencyKey,
    registrySnapshotRef: 'snapshot:smoke' as never,
  }, 'generation');

  cleanup.register(async () => {
    await redis.del(lockKey);
    await pg.query(
      `DELETE FROM request_idempotency WHERE user_id = $1 AND project_id = $2 AND endpoint = $3 AND idempotency_key = $4`,
      [userId, projectId, 'generation', idempotencyKey],
    );
    await pg.query(`DELETE FROM quota_history WHERE request_id = $1`, [requestId]);
    await pg.query(`DELETE FROM artifacts WHERE id = $1`, [artifactId]);
    await pg.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
    await pg.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await redis.quit();
    await pg.end();
  });

  try {
    // Seed user and project
    await pg.query(
      `INSERT INTO users (id, email, monthly_quota, monthly_used, role, status, password_hash, password_algo, quota_window_started_at)
       VALUES ($1, $2, 100, 0, 'member', 'active', NULL, NULL, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [userId, `${userId}@test.local`],
    );
    await pg.query(
      `INSERT INTO projects (id, user_id, name, created_at, updated_at)
       VALUES ($1, $2, 'Smoke Test Project', NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [projectId, userId],
    );

    const adapters = createPostgresRedisProductionGenerationAdapters({ pg, redis });

    // Mock generate to avoid real LLM calls
    adapters.generate.generateText = async () => ({
      content: 'smoke-generated-content',
      usage: { inputTokens: 10, outputTokens: 20, costUsd: 0.0001 },
    });

    let flushProgressCalls = 0;
    const originalFlushProgress = adapters.persistence.flushProgress;
    adapters.persistence.flushProgress = async (...args) => {
      flushProgressCalls += 1;
      await originalFlushProgress(...args);
    };

    const firstResult = await runBackendGenerationSessionAsJson(
      {
        requestId,
        userId,
        projectId,
        artifactType: 'content',
        model: 'openrouter/gpt-5.3-codex',
        input: { prompt: 'smoke test non-streaming' },
        workflowType: null,
        idempotencyKey,
        registrySnapshotRef: 'snapshot:smoke-nonstream',
      },
      adapters,
    );

    assert.equal(firstResult.status, 'completed', `Expected completed but got ${firstResult.status} with error: ${firstResult.error?.message}`);
    assert.ok(firstResult.artifactId, 'artifactId should be present');
    assert.equal(firstResult.content, 'smoke-generated-content');
    assert.equal(firstResult.error, null);

    // Verify artifact in DB
    const artifactRow = await pg.query(
      `SELECT status, content FROM artifacts WHERE request_id = $1`,
      [requestId],
    );
    assert.equal(artifactRow.rows.length, 1, 'Exactly one artifact should exist');
    assert.equal(artifactRow.rows[0].status, 'completed');
    assert.equal(artifactRow.rows[0].content, 'smoke-generated-content');

    // Verify quota_history in DB
    const quotaRow = await pg.query(
      `SELECT status, input_tokens, output_tokens FROM quota_history WHERE request_id = $1`,
      [requestId],
    );
    assert.equal(quotaRow.rows.length, 1, 'Exactly one quota_history row should exist');
    assert.equal(quotaRow.rows[0].status, 'success');
    assert.ok(quotaRow.rows[0].input_tokens > 0, 'input_tokens should be > 0');
    assert.ok(quotaRow.rows[0].output_tokens > 0, 'output_tokens should be > 0');

    // Verify no flushProgress calls (single DB write path)
    assert.equal(flushProgressCalls, 0, 'flushProgress should not be called in non-streaming path');

    // Verify idempotency replay
    const secondResult = await runBackendGenerationSessionAsJson(
      {
        requestId: `${requestId}-replay`,
        userId,
        projectId,
        artifactType: 'content',
        model: 'openrouter/gpt-5.3-codex',
        input: { prompt: 'smoke test non-streaming replay' },
        workflowType: null,
        idempotencyKey,
        registrySnapshotRef: 'snapshot:smoke-nonstream',
      },
      adapters,
    );

    assert.equal(secondResult.status, 'completed');
    assert.equal(secondResult.artifactId, firstResult.artifactId);
    assert.equal(secondResult.content, firstResult.content);

    // Verify only one artifact exists (replay should not create a new one)
    const artifactCount = await pg.query(
      `SELECT COUNT(*)::int as count FROM artifacts WHERE request_id = $1`,
      [requestId],
    );
    assert.equal(artifactCount.rows[0].count, 1, 'Replay should not create additional artifacts');

    console.log('Smoke OK: non-streaming path — single write, quota recorded, idempotency replay');
  } finally {
    await cleanup.run();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
