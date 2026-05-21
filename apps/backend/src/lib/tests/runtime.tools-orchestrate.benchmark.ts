import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';

import {
  ArtifactQueryRepositoryStub,
  ProjectQueryRepositoryStub,
  createAuthStubRepositories,
  createInMemoryGenerationAdapters,
  type StubArtifactQueryRecord,
} from '../adapters';
import {
  createAuthHttpRuntime,
  createDefaultPasswordHashRuntime,
  createDefaultSessionCookieRuntime,
} from '../runtime';

class MockIncomingMessage extends EventEmitter {
  method: string;
  url: string;
  headers: Record<string, string>;
  socket: { remoteAddress: string | null };

  constructor(options: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string;
    remoteAddress?: string | null;
  }) {
    super();
    this.method = options.method;
    this.url = options.url;
    this.headers = options.headers ?? {};
    this.socket = { remoteAddress: options.remoteAddress ?? null };

    process.nextTick(() => {
      if (typeof options.body === 'string') {
        this.emit('data', Buffer.from(options.body));
      }
      this.emit('end');
    });
  }
}

class MockServerResponse extends EventEmitter {
  statusCode = 200;
  writableEnded = false;
  private readonly headers = new Map<string, string | string[]>();
  private readonly bodyChunks: string[] = [];

  setHeader(name: string, value: string | string[]) {
    this.headers.set(name.toLowerCase(), value);
  }

  getHeader(name: string): string | string[] | undefined {
    return this.headers.get(name.toLowerCase());
  }

  end(chunk?: string) {
    if (typeof chunk === 'string' && chunk.length > 0) {
      this.bodyChunks.push(chunk);
    }
    this.writableEnded = true;
    this.emit('finish');
  }

  jsonBody(): Record<string, unknown> {
    const serialized = this.bodyChunks.join('');
    return serialized.length > 0 ? (JSON.parse(serialized) as Record<string, unknown>) : {};
  }
}

type ScenarioResult = {
  datasetSize: number;
  totalRequests: number;
  concurrency: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  timeoutCount: number;
  errorCount: number;
  memoryDeltaMb: number;
};

const FIXED_NOW = new Date('2026-05-21T10:00:00.000Z');

const percentile = (sorted: number[], pct: number): number => {
  if (sorted.length === 0) {
    return 0;
  }

  const index = Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length));
  return sorted[index] ?? 0;
};

const buildNoiseArtifacts = (count: number, projectId: string): StubArtifactQueryRecord[] => {
  const artifacts: StubArtifactQueryRecord[] = [];

  for (let i = 0; i < count; i += 1) {
    const second = String(i % 60).padStart(2, '0');
    const isFunnel = i % 2 === 0;
    const step = i % 3 === 0 ? 'optin' : i % 3 === 1 ? 'quiz' : 'vsl';
    const hasStepKey = i % 5 !== 0;

    artifacts.push({
      artifactId: `art-bench-${String(i).padStart(6, '0')}`,
      requestId: `req-bench-${String(i).padStart(6, '0')}`,
      userId: 'user-bench-001',
      projectId,
      artifactType: 'content',
      status: 'completed',
      model: 'gpt-4o',
      workflowType: isFunnel ? 'funnel_pages' : 'nextland',
      input: hasStepKey ? { toolWorkflow: { stepKey: step }, step } : { step },
      content: '{"bench":true}',
      failureReason: null,
      createdAt: `2026-05-20T09:00:${second}.000Z`,
      updatedAt: `2026-05-20T10:00:${second}.000Z`,
    });
  }

  artifacts.push({
    artifactId: 'art-bench-optin-latest',
    requestId: 'req-bench-optin-latest',
    userId: 'user-bench-001',
    projectId,
    artifactType: 'content',
    status: 'completed',
    model: 'gpt-4o',
    workflowType: 'funnel_pages',
    input: { toolWorkflow: { stepKey: 'optin' }, step: 'optin' },
    content: '{"headline":"latest optin"}',
    failureReason: null,
    createdAt: '2026-05-21T09:59:58.000Z',
    updatedAt: '2026-05-21T10:00:58.000Z',
  });

  artifacts.push({
    artifactId: 'art-bench-quiz-latest',
    requestId: 'req-bench-quiz-latest',
    userId: 'user-bench-001',
    projectId,
    artifactType: 'content',
    status: 'completed',
    model: 'gpt-4o',
    workflowType: 'funnel_pages',
    input: { toolWorkflow: { stepKey: 'quiz' }, step: 'quiz' },
    content: '{"quiz":"latest"}',
    failureReason: null,
    createdAt: '2026-05-21T09:59:59.000Z',
    updatedAt: '2026-05-21T10:00:59.000Z',
  });

  return artifacts;
};

const loginCookie = async (
  runtime: ReturnType<typeof createAuthHttpRuntime>,
  repositories: ReturnType<typeof createAuthStubRepositories>,
  hasher: ReturnType<typeof createDefaultPasswordHashRuntime>,
): Promise<string> => {
  const passwordHash = await hasher.hashPassword('Bench-Pass-1!');
  await repositories.users.createUser({
    id: 'user-bench-001',
    email: 'bench@example.com',
    role: 'member',
    status: 'active',
    passwordHash,
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const loginReq = new MockIncomingMessage({
    method: 'POST',
    url: '/auth/login',
    body: JSON.stringify({ email: 'bench@example.com', password: 'Bench-Pass-1!' }),
  });
  const loginRes = new MockServerResponse();

  await runtime.handleRequest(
    loginReq as unknown as IncomingMessage,
    loginRes as unknown as ServerResponse,
  );

  assert.equal(loginRes.statusCode, 200);
  const setCookie = loginRes.getHeader('set-cookie');
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return (typeof raw === 'string' ? raw.split(';')[0] : '') ?? '';
};

const runScenario = async (datasetSize: number): Promise<ScenarioResult> => {
  const artifactStub = new ArtifactQueryRepositoryStub();
  const repositories = createAuthStubRepositories();
  const generationAdapters = createInMemoryGenerationAdapters();
  const hasher = createDefaultPasswordHashRuntime();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub({
    randomId: () => `project-bench-${datasetSize}`,
    now: () => FIXED_NOW,
  });

  const runtime = createAuthHttpRuntime({
    repositories,
    queryRepositories: {
      projects: projectQueries,
      artifacts: artifactStub,
    },
    idempotency: generationAdapters.idempotency,
    passwordHashing: hasher,
    sessionCookies,
    now: () => FIXED_NOW,
    idGenerator: { nextSessionId: () => 'session-bench-001' },
    toolsOrchestrateArtifactScanLimit: datasetSize,
    toolsOrchestrateTimeoutMs: 6500,
  });

  const cookie = await loginCookie(runtime, repositories, hasher);
  const project = await projectQueries.createProjectForUser('user-bench-001', {
    name: `Benchmark ${datasetSize}`,
  });

  artifactStub.seed(buildNoiseArtifacts(datasetSize, project.id));

  const totalRequests = 120;
  const concurrency = 12;

  for (let i = 0; i < 5; i += 1) {
    const warmReq = new MockIncomingMessage({
      method: 'POST',
      url: '/api/tools/orchestrate',
      headers: { cookie },
      body: JSON.stringify({
        projectId: project.id,
        toolKey: 'funnel-pages',
        targetStep: 'vsl',
      }),
    });
    const warmRes = new MockServerResponse();
    await runtime.handleRequest(warmReq as unknown as IncomingMessage, warmRes as unknown as ServerResponse);
  }

  const beforeMem = process.memoryUsage().heapUsed;
  const latencies: number[] = [];
  let timeoutCount = 0;
  let errorCount = 0;

  const runOne = async (): Promise<void> => {
    const request = new MockIncomingMessage({
      method: 'POST',
      url: '/api/tools/orchestrate',
      headers: { cookie },
      body: JSON.stringify({
        projectId: project.id,
        toolKey: 'funnel-pages',
        targetStep: 'vsl',
      }),
    });
    const response = new MockServerResponse();

    const started = performance.now();
    await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
    latencies.push(performance.now() - started);

    if (response.statusCode === 503) {
      timeoutCount += 1;
      return;
    }

    if (response.statusCode !== 200) {
      errorCount += 1;
      return;
    }

    const body = response.jsonBody();
    if (body.ok !== true) {
      errorCount += 1;
    }
  };

  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < totalRequests) {
      const current = cursor;
      cursor += 1;
      if (current >= totalRequests) {
        return;
      }
      await runOne();
    }
  });

  await Promise.all(workers);

  const afterMem = process.memoryUsage().heapUsed;
  const sorted = [...latencies].sort((a, b) => a - b);
  const avgMs = sorted.length > 0
    ? sorted.reduce((acc, value) => acc + value, 0) / sorted.length
    : 0;

  return {
    datasetSize,
    totalRequests,
    concurrency,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    minMs: sorted[0] ?? 0,
    maxMs: sorted[sorted.length - 1] ?? 0,
    avgMs,
    timeoutCount,
    errorCount,
    memoryDeltaMb: (afterMem - beforeMem) / (1024 * 1024),
  };
};

const main = async () => {
  const sizes = [1_000, 5_000, 10_000];
  const results: ScenarioResult[] = [];

  for (const size of sizes) {
    const result = await runScenario(size);
    results.push(result);
  }

  const payload = {
    benchmark: 'runtime.tools-orchestrate',
    executedAt: new Date().toISOString(),
    nodeVersion: process.version,
    scenarios: results,
  };

  console.log(JSON.stringify(payload, null, 2));
};

void main();