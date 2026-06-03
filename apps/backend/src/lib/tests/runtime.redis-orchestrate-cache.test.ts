import test from 'node:test';
import assert from 'node:assert/strict';
import { RedisOrchestrateArtifactCache } from '../adapters/redis-orchestrate-artifact-cache';

class MockRedis {
  pipelineExecuted = false;
  hsetCalls: Array<{ key: string; field: string; value: string }> = [];
  expireCalls: Array<{ key: string; ttlSeconds: number }> = [];
  hgetallCalls: Array<{ key: string }> = [];
  private hgetallResults = new Map<string, Record<string, string>>();

  setHgetallResult(key: string, result: Record<string, string>): void {
    this.hgetallResults.set(key, result);
  }

  pipeline(): {
    hset: (key: string, field: string, value: string) => unknown;
    expire: (key: string, ttlSeconds: number) => unknown;
    exec: () => Promise<void>;
  } {
    const self = this;
    return {
      hset(key: string, field: string, value: string) {
        self.hsetCalls.push({ key, field, value });
      },
      expire(key: string, ttlSeconds: number) {
        self.expireCalls.push({ key, ttlSeconds });
      },
      async exec() {
        self.pipelineExecuted = true;
      },
    };
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    this.hgetallCalls.push({ key });
    return this.hgetallResults.get(key) ?? {};
  }
}

test('setStepArtifact writes to Redis Hash with correct key using pipeline', async () => {
  const mockRedis = new MockRedis() as any;
  const cache = new RedisOrchestrateArtifactCache(mockRedis);

  await cache.setStepArtifact('user-1', 'proj-1', 'funnel_pages', 'optin', 'art-001');

  assert.equal(mockRedis.hsetCalls.length, 1);
  assert.equal(mockRedis.hsetCalls[0].key, 'orchestrate:artifacts:user-1:proj-1:funnel_pages');
  assert.equal(mockRedis.hsetCalls[0].field, 'optin');
  assert.equal(mockRedis.hsetCalls[0].value, 'art-001');

  assert.equal(mockRedis.expireCalls.length, 1);
  assert.equal(mockRedis.expireCalls[0].key, 'orchestrate:artifacts:user-1:proj-1:funnel_pages');
  assert.equal(mockRedis.expireCalls[0].ttlSeconds, 14400);

  assert.ok(mockRedis.pipelineExecuted);
});

test('setStepArtifact overwrites artifactId for same step key', async () => {
  const mockRedis = new MockRedis() as any;
  const cache = new RedisOrchestrateArtifactCache(mockRedis);

  await cache.setStepArtifact('user-1', 'proj-1', 'funnel_pages', 'optin', 'art-001');
  await cache.setStepArtifact('user-1', 'proj-1', 'funnel_pages', 'optin', 'art-002');

  assert.equal(mockRedis.hsetCalls.length, 2);
  assert.equal(mockRedis.hsetCalls[0].value, 'art-001');
  assert.equal(mockRedis.hsetCalls[1].value, 'art-002');
});

test('getCompletedArtifactsByStep returns step-to-artifactId map', async () => {
  const mockRedis = new MockRedis() as any;
  const cache = new RedisOrchestrateArtifactCache(mockRedis);

  mockRedis.setHgetallResult('orchestrate:artifacts:user-1:proj-1:funnel_pages', {
    optin: 'art-001',
    quiz: 'art-002',
  });

  const result = await cache.getCompletedArtifactsByStep('user-1', 'proj-1', 'funnel_pages');

  assert.deepEqual(result, {
    optin: 'art-001',
    quiz: 'art-002',
  });
  assert.equal(mockRedis.hgetallCalls.length, 1);
  assert.equal(mockRedis.hgetallCalls[0].key, 'orchestrate:artifacts:user-1:proj-1:funnel_pages');
});

test('getCompletedArtifactsByStep returns empty object on cache miss', async () => {
  const mockRedis = new MockRedis() as any;
  const cache = new RedisOrchestrateArtifactCache(mockRedis);

  const result = await cache.getCompletedArtifactsByStep('user-1', 'proj-1', 'funnel_pages');

  assert.deepEqual(result, {});
  assert.equal(mockRedis.hgetallCalls.length, 1);
});

test('RedisOrchestrateArtifactCache uses custom prefix and TTL when provided', async () => {
  const mockRedis = new MockRedis() as any;
  const cache = new RedisOrchestrateArtifactCache(mockRedis, {
    prefix: 'custom:orch',
    ttlSeconds: 3600,
  });

  await cache.setStepArtifact('user-1', 'proj-1', 'funnel_pages', 'optin', 'art-001');

  assert.equal(mockRedis.hsetCalls[0].key, 'custom:orch:user-1:proj-1:funnel_pages');
  assert.equal(mockRedis.expireCalls[0].ttlSeconds, 3600);
});

test('pipeline exec is used for atomic hset + expire in setStepArtifact', async () => {
  const mockRedis = new MockRedis() as any;
  const cache = new RedisOrchestrateArtifactCache(mockRedis);

  mockRedis.pipelineExecuted = false;
  await cache.setStepArtifact('user-1', 'proj-1', 'nextland', 'landing', 'art-landing-001');

  assert.ok(mockRedis.pipelineExecuted);
  assert.equal(mockRedis.hsetCalls.length, 1);
  assert.equal(mockRedis.expireCalls.length, 1);
});
