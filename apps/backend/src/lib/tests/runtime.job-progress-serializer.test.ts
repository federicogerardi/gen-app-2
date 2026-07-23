import test from 'node:test';
import assert from 'node:assert/strict';
import { createJobProgressSerializer, type SerializedJobProgress } from '../runtime/job-progress-serializer';

class MockRedis {
  store = new Map<string, string>();
  setCalls: Array<{ key: string; value: string; exArg: string; ttl: number }> = [];
  getCalls: string[] = [];
  delCalls: string[] = [];
  shouldThrow = false;

  async set(key: string, value: string, exArg: string, ttl: number): Promise<string> {
    if (this.shouldThrow) throw new Error('Redis unavailable');
    this.setCalls.push({ key, value, exArg, ttl });
    this.store.set(key, value);
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    if (this.shouldThrow) throw new Error('Redis unavailable');
    this.getCalls.push(key);
    return this.store.get(key) ?? null;
  }

  async del(key: string): Promise<number> {
    if (this.shouldThrow) throw new Error('Redis unavailable');
    this.delCalls.push(key);
    this.store.delete(key);
    return 1;
  }
}

test('save writes JSON to Redis with TTL', async () => {
  const redis = new MockRedis() as any;
  const serializer = createJobProgressSerializer(redis);

  await serializer.save('job-1', {
    completedSteps: [{ key: 'step-a', status: 'done', retryCount: 0, errorMessage: null }],
    currentStepIndex: 1,
  });

  assert.equal(redis.setCalls.length, 1);
  assert.equal(redis.setCalls[0].key, 'generation:job:job-1:progress');
  assert.equal(redis.setCalls[0].exArg, 'EX');
  assert.equal(redis.setCalls[0].ttl, 3600);

  const payload = JSON.parse(redis.setCalls[0].value) as SerializedJobProgress;
  assert.equal(payload.jobId, 'job-1');
  assert.equal(payload.completedSteps.length, 1);
  assert.equal(payload.completedSteps[0]?.key, 'step-a');
  assert.equal(payload.currentStepIndex, 1);
  assert.ok(payload.lastUpdated);
});

test('save uses custom TTL when provided', async () => {
  const redis = new MockRedis() as any;
  const serializer = createJobProgressSerializer(redis, 7200);

  await serializer.save('job-2', {
    completedSteps: [],
    currentStepIndex: 0,
  });

  assert.equal(redis.setCalls[0].ttl, 7200);
});

test('save does not throw when Redis is unavailable', async () => {
  const redis = new MockRedis() as any;
  redis.shouldThrow = true;
  const serializer = createJobProgressSerializer(redis);

  await assert.doesNotReject(() =>
    serializer.save('job-3', { completedSteps: [], currentStepIndex: 0 }),
  );
});

test('load returns deserialized progress', async () => {
  const redis = new MockRedis() as any;
  const serializer = createJobProgressSerializer(redis);

  const progress: SerializedJobProgress = {
    jobId: 'job-4',
    completedSteps: [
      { key: 'step-1', status: 'done', retryCount: 0, errorMessage: null },
      { key: 'step-2', status: 'done', retryCount: 0, errorMessage: null },
    ],
    currentStepIndex: 2,
    lastUpdated: '2026-01-01T00:00:00.000Z',
  };

  redis.store.set('generation:job:job-4:progress', JSON.stringify(progress));

  const result = await serializer.load('job-4');

  assert.ok(result);
  assert.equal(result.jobId, 'job-4');
  assert.equal(result.completedSteps.length, 2);
  assert.equal(result.currentStepIndex, 2);
});

test('load returns null for nonexistent key', async () => {
  const redis = new MockRedis() as any;
  const serializer = createJobProgressSerializer(redis);

  const result = await serializer.load('nonexistent');

  assert.equal(result, null);
});

test('load returns null for invalid JSON shape', async () => {
  const redis = new MockRedis() as any;
  const serializer = createJobProgressSerializer(redis);

  redis.store.set('generation:job:job-5:progress', '{"jobId":"job-5"}');

  const result = await serializer.load('job-5');

  assert.equal(result, null);
});

test('load returns null when Redis is unavailable', async () => {
  const redis = new MockRedis() as any;
  redis.shouldThrow = true;
  const serializer = createJobProgressSerializer(redis);

  const result = await serializer.load('job-6');

  assert.equal(result, null);
});

test('clear removes the key', async () => {
  const redis = new MockRedis() as any;
  const serializer = createJobProgressSerializer(redis);

  redis.store.set('generation:job:job-7:progress', '{"jobId":"job-7"}');

  await serializer.clear('job-7');

  assert.equal(redis.delCalls.length, 1);
  assert.equal(redis.delCalls[0], 'generation:job:job-7:progress');
  assert.equal(redis.store.has('generation:job:job-7:progress'), false);
});

test('clear does not throw when Redis is unavailable', async () => {
  const redis = new MockRedis() as any;
  redis.shouldThrow = true;
  const serializer = createJobProgressSerializer(redis);

  await assert.doesNotReject(() => serializer.clear('job-8'));
});
