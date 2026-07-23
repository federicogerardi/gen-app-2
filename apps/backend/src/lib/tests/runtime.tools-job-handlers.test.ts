import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import { createToolsJobHandlers } from '../runtime/auth-http/tools/tools-job-handlers';

class MockRedis extends EventEmitter {
  store = new Map<string, string>();
  deleted: string[] = [];

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string, _ex?: string, _ttl?: number): Promise<string> {
    this.store.set(key, value);
    return 'OK';
  }
  async del(key: string): Promise<number> {
    this.deleted.push(key);
    this.store.delete(key);
    return 1;
  }
  duplicate(): MockRedis { return new MockRedis(); }
}

class MockQueue {
  added: Array<{ name: string; data: any; opts: any }> = [];
  async add(name: string, data: any, opts: any) {
    this.added.push({ name, data, opts });
    return { id: opts.jobId };
  }
}

class MockResponse extends EventEmitter {
  statusCode = 200;
  headers: Record<string, string> = {};
  body = '';
  writableEnded = false;

  setHeader(name: string, value: string) { this.headers[name] = value; }
  writeHead(status: number) { this.statusCode = status; }
  end(data?: string) { if (data) this.body = data; this.writableEnded = true; }
  jsonBody() {
    try { return JSON.parse(this.body); } catch { return null; }
  }
}

class MockRequest extends EventEmitter {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;

  constructor(method: string, url: string, body?: any) {
    super();
    this.method = method;
    this.url = url;
    this.headers = { host: 'localhost' };
    this.body = body ? JSON.stringify(body) : '';
  }
}

const mockPrincipal = { user: { id: 'user-1', role: 'member' }, session: { id: 'session-1' } };
const mockProject = { id: 'project-1' };

const buildHandlers = (redis: MockRedis, queue: MockQueue) => {
  return createToolsJobHandlers({
    queue: queue as any,
    redis: redis as any,
    repositories: { sessions: { touchSession: async () => {} } } as any,
    now: () => new Date('2026-07-24'),
    parseJsonBody: async (req: any) => JSON.parse(req.body),
    requireSessionPrincipal: async () => mockPrincipal as any,
    requireQueryRepositories: () => ({ projects: { getProjectByIdForUser: async () => mockProject } }) as any,
    writeError: (res: any, status: number, code: string, message: string) => {
      res.writeHead(status);
      res.end(JSON.stringify({ ok: false, error: { code, message } }));
    },
    writeSuccess: (res: any, status: number, data: Record<string, unknown>) => {
      res.writeHead(status);
      res.end(JSON.stringify({ ok: true, data }));
    },
  });
};

test('POST /api/tools/jobs acquires single-flight lock', async () => {
  const redis = new MockRedis();
  const queue = new MockQueue();
  const handlers = buildHandlers(redis, queue);

  const req = new MockRequest('POST', '/api/tools/jobs', {
    toolKey: 'funnel-pages',
    projectId: 'project-1',
    extractionPayload: { schemaVersion: 'extraction.v1' },
    model: 'openrouter/auto',
    intent: 'new',
    idempotencyKey: 'idem-1',
  });
  const res = new MockResponse();

  await handlers.handleSubmitJob(req as any, res as any);

  assert.equal(res.statusCode, 200);
  const body = res.jsonBody();
  assert.equal(body.ok, true);
  assert.ok(body.data.jobId, 'should return jobId');
  assert.equal(body.data.status, 'queued');

  const lockKey = 'tool-job-active:user-1:project-1:funnel-pages';
  assert.ok(redis.store.has(lockKey), 'should set single-flight lock');
});

test('POST /api/tools/jobs returns 409 when lock exists', async () => {
  const redis = new MockRedis();
  const queue = new MockQueue();
  redis.store.set('tool-job-active:user-1:project-1:funnel-pages', 'existing-job');
  const handlers = buildHandlers(redis, queue);

  const req = new MockRequest('POST', '/api/tools/jobs', {
    toolKey: 'funnel-pages',
    projectId: 'project-1',
    extractionPayload: { schemaVersion: 'extraction.v1' },
    model: 'openrouter/auto',
    intent: 'new',
    idempotencyKey: 'idem-1',
  });
  const res = new MockResponse();

  await handlers.handleSubmitJob(req as any, res as any);

  assert.equal(res.statusCode, 409);
  const body = res.jsonBody();
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'conflict');
});

test('POST /api/tools/jobs/:id/cancel sets Redis cancel flag', async () => {
  const redis = new MockRedis();
  const queue = new MockQueue();
  redis.store.set('tool-job:job-1', JSON.stringify({
    jobId: 'job-1',
    status: 'running',
    userId: 'user-1',
    toolKey: 'funnel-pages',
    projectId: 'project-1',
    createdAt: '2026-07-24',
  }));
  const handlers = buildHandlers(redis, queue);

  const req = new MockRequest('POST', '/api/tools/jobs/job-1/cancel');
  const res = new MockResponse();

  await handlers.handleCancelJob(req as any, res as any, 'job-1');

  assert.equal(res.statusCode, 202);
  assert.ok(redis.store.has('tool-job-cancel:job-1'), 'should set cancel flag');
});

test('GET /api/tools/jobs/:id returns 404 for missing job', async () => {
  const redis = new MockRedis();
  const queue = new MockQueue();
  const handlers = buildHandlers(redis, queue);

  const req = new MockRequest('GET', '/api/tools/jobs/nonexistent');
  const res = new MockResponse();

  await handlers.handleGetJobStatus(req as any, res as any, 'nonexistent');

  assert.equal(res.statusCode, 404);
  const body = res.jsonBody();
  assert.equal(body.error.code, 'not_found');
});
