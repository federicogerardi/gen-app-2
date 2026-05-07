import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  ArtifactQueryRepositoryStub,
  createAuthStubRepositories,
  ProjectQueryRepositoryStub,
  type StubArtifactQueryRecord,
} from '../adapters';
import {
  createAuthHttpRuntime,
  createDefaultPasswordHashRuntime,
  createDefaultSessionCookieRuntime,
} from '../runtime';

// ---------------------------------------------------------------------------
// Minimal mock HTTP helpers (same pattern as runtime.auth-http.test.ts)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const FIXED_NOW = new Date('2026-05-04T10:00:00.000Z');

const buildRuntime = (artifactStub: ArtifactQueryRepositoryStub) => {
  const repositories = createAuthStubRepositories();
  const hasher = createDefaultPasswordHashRuntime();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub({
    randomId: () => 'project-orch-001',
    now: () => FIXED_NOW,
  });

  return {
    repositories,
    hasher,
    sessionCookies,
    runtime: createAuthHttpRuntime({
      repositories,
      queryRepositories: {
        projects: projectQueries,
        artifacts: artifactStub,
      },
      passwordHashing: hasher,
      sessionCookies,
      now: () => FIXED_NOW,
      idGenerator: { nextSessionId: () => 'session-orch-001' },
    }),
  };
};

const createAndLoginUser = async (
  runtime: ReturnType<typeof createAuthHttpRuntime>,
  repositories: ReturnType<typeof createAuthStubRepositories>,
  hasher: ReturnType<typeof createDefaultPasswordHashRuntime>,
): Promise<string> => {
  const passwordHash = await hasher.hashPassword('Orch-Pass-1!');
  await repositories.users.createUser({
    id: 'user-orch-001',
    email: 'orch@example.com',
    role: 'member',
    status: 'active',
    passwordHash,
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const loginReq = new MockIncomingMessage({
    method: 'POST',
    url: '/auth/login',
    body: JSON.stringify({ email: 'orch@example.com', password: 'Orch-Pass-1!' }),
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

const POST_ORCHESTRATE = (cookie: string, body: object) =>
  new MockIncomingMessage({
    method: 'POST',
    url: '/api/tools/orchestrate',
    headers: { cookie },
    body: JSON.stringify(body),
  });

// ---------------------------------------------------------------------------
// Stub artifact records for funnel-pages
// ---------------------------------------------------------------------------

const OPTIN_ARTIFACT: StubArtifactQueryRecord = {
  artifactId: 'art-optin-001',
  requestId: 'req-optin-001',
  userId: 'user-orch-001',
  projectId: 'project-orch-001',
  artifactType: 'content',
  status: 'completed',
  model: 'gpt-4o',
  workflowType: 'funnel-pages',
  input: { toolWorkflow: { stepKey: 'optin' }, step: 'optin' },
  content: '{"headline":"Opt-in page"}',
  failureReason: null,
  createdAt: '2026-05-04T09:00:00.000Z',
  updatedAt: '2026-05-04T09:05:00.000Z',
};

const QUIZ_ARTIFACT: StubArtifactQueryRecord = {
  artifactId: 'art-quiz-001',
  requestId: 'req-quiz-001',
  userId: 'user-orch-001',
  projectId: 'project-orch-001',
  artifactType: 'content',
  status: 'completed',
  model: 'gpt-4o',
  workflowType: 'funnel-pages',
  input: { toolWorkflow: { stepKey: 'quiz' }, step: 'quiz' },
  content: '{"questions":[]}',
  failureReason: null,
  createdAt: '2026-05-04T09:10:00.000Z',
  updatedAt: '2026-05-04T09:15:00.000Z',
};

const YOUTUBE_PRE_SCRIPT_ANALYSIS_ARTIFACT: StubArtifactQueryRecord = {
  artifactId: 'art-youtube-pre-script-analysis-001',
  requestId: 'req-youtube-pre-script-analysis-001',
  userId: 'user-orch-001',
  projectId: 'project-orch-001',
  artifactType: 'content',
  status: 'completed',
  model: 'gpt-4o',
  workflowType: 'youtube-lf-script',
  input: { toolWorkflow: { stepKey: 'pre-script-analysis' }, step: 'pre-script-analysis' },
  content: '{"analysis":"ok"}',
  failureReason: null,
  createdAt: '2026-05-04T09:00:00.000Z',
  updatedAt: '2026-05-04T09:05:00.000Z',
};

const YOUTUBE_PACKAGING_ARTIFACT: StubArtifactQueryRecord = {
  artifactId: 'art-youtube-packaging-001',
  requestId: 'req-youtube-packaging-001',
  userId: 'user-orch-001',
  projectId: 'project-orch-001',
  artifactType: 'content',
  status: 'completed',
  model: 'gpt-4o',
  workflowType: 'youtube-lf-script',
  input: { toolWorkflow: { stepKey: 'packaging' }, step: 'packaging' },
  content: '{"packaging":"ok"}',
  failureReason: null,
  createdAt: '2026-05-04T09:10:00.000Z',
  updatedAt: '2026-05-04T09:15:00.000Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('/api/tools/orchestrate returns empty deps for first step (optin)', async () => {
  const artifactStub = new ArtifactQueryRepositoryStub();
  artifactStub.seed([OPTIN_ARTIFACT]);
  const { repositories, hasher, runtime } = buildRuntime(artifactStub);
  const cookie = await createAndLoginUser(runtime, repositories, hasher);

  const req = POST_ORCHESTRATE(cookie, {
    projectId: 'project-orch-001',
    toolKey: 'funnel-pages',
    targetStep: 'optin',
  });
  const res = new MockServerResponse();
  await runtime.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);

  assert.equal(res.statusCode, 200);
  const body = res.jsonBody();
  assert.equal(body.ok, true);
  const orch = (body.data as { orchestration: Record<string, unknown> }).orchestration;
  assert.equal(orch.toolKey, 'funnel-pages');
  assert.equal(orch.targetStep, 'optin');
  assert.deepEqual(orch.stepDependencyArtifactIds, []);
  assert.deepEqual(orch.dependencyArtifactIdsByStep, {});
});

test('/api/tools/orchestrate resolves optin dep for quiz step', async () => {
  const artifactStub = new ArtifactQueryRepositoryStub();
  artifactStub.seed([OPTIN_ARTIFACT]);
  const { repositories, hasher, runtime } = buildRuntime(artifactStub);
  const cookie = await createAndLoginUser(runtime, repositories, hasher);

  const req = POST_ORCHESTRATE(cookie, {
    projectId: 'project-orch-001',
    toolKey: 'funnel-pages',
    targetStep: 'quiz',
  });
  const res = new MockServerResponse();
  await runtime.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);

  assert.equal(res.statusCode, 200);
  const orch = (res.jsonBody().data as { orchestration: Record<string, unknown> }).orchestration;
  assert.deepEqual(orch.stepDependencyArtifactIds, ['art-optin-001']);
  assert.deepEqual(orch.dependencyArtifactIdsByStep, { optin: 'art-optin-001' });
});

test('/api/tools/orchestrate resolves optin + quiz deps for vsl step', async () => {
  const artifactStub = new ArtifactQueryRepositoryStub();
  artifactStub.seed([OPTIN_ARTIFACT, QUIZ_ARTIFACT]);
  const { repositories, hasher, runtime } = buildRuntime(artifactStub);
  const cookie = await createAndLoginUser(runtime, repositories, hasher);

  const req = POST_ORCHESTRATE(cookie, {
    projectId: 'project-orch-001',
    toolKey: 'funnel-pages',
    targetStep: 'vsl',
  });
  const res = new MockServerResponse();
  await runtime.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);

  assert.equal(res.statusCode, 200);
  const orch = (res.jsonBody().data as { orchestration: Record<string, unknown> }).orchestration;
  assert.deepEqual(orch.stepDependencyArtifactIds, ['art-optin-001', 'art-quiz-001']);
  assert.deepEqual(orch.dependencyArtifactIdsByStep, {
    optin: 'art-optin-001',
    quiz: 'art-quiz-001',
  });
});

test('/api/tools/orchestrate returns 400 for unknown toolKey', async () => {
  const artifactStub = new ArtifactQueryRepositoryStub();
  const { repositories, hasher, runtime } = buildRuntime(artifactStub);
  const cookie = await createAndLoginUser(runtime, repositories, hasher);

  const req = POST_ORCHESTRATE(cookie, {
    projectId: 'project-orch-001',
    toolKey: 'unknown-tool',
    targetStep: 'some-step',
  });
  const res = new MockServerResponse();
  await runtime.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);

  assert.equal(res.statusCode, 400);
  const body = res.jsonBody();
  assert.equal(body.ok, false);
});

test('/api/tools/orchestrate returns 400 when projectId is missing', async () => {
  const artifactStub = new ArtifactQueryRepositoryStub();
  const { repositories, hasher, runtime } = buildRuntime(artifactStub);
  const cookie = await createAndLoginUser(runtime, repositories, hasher);

  const req = POST_ORCHESTRATE(cookie, {
    toolKey: 'funnel-pages',
    targetStep: 'vsl',
  });
  const res = new MockServerResponse();
  await runtime.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);

  assert.equal(res.statusCode, 400);
});

test('/api/tools/orchestrate returns 401 for unauthenticated request', async () => {
  const artifactStub = new ArtifactQueryRepositoryStub();
  const { runtime } = buildRuntime(artifactStub);

  const req = POST_ORCHESTRATE('invalid-cookie', {
    projectId: 'project-orch-001',
    toolKey: 'funnel-pages',
    targetStep: 'vsl',
  });
  const res = new MockServerResponse();
  await runtime.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);

  assert.equal(res.statusCode, 401);
});

test('/api/tools/orchestrate returns 405 for GET request', async () => {
  const artifactStub = new ArtifactQueryRepositoryStub();
  const { repositories, hasher, runtime } = buildRuntime(artifactStub);
  const cookie = await createAndLoginUser(runtime, repositories, hasher);

  const req = new MockIncomingMessage({
    method: 'GET',
    url: '/api/tools/orchestrate',
    headers: { cookie },
  });
  const res = new MockServerResponse();
  await runtime.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);

  assert.equal(res.statusCode, 405);
});

test('/api/tools/orchestrate resolves canonical youtube-lf-script dependencies', async () => {
  const artifactStub = new ArtifactQueryRepositoryStub();
  artifactStub.seed([YOUTUBE_PRE_SCRIPT_ANALYSIS_ARTIFACT, YOUTUBE_PACKAGING_ARTIFACT]);
  const { repositories, hasher, runtime } = buildRuntime(artifactStub);
  const cookie = await createAndLoginUser(runtime, repositories, hasher);

  const req = POST_ORCHESTRATE(cookie, {
    projectId: 'project-orch-001',
    toolKey: 'youtube-lf-script',
    targetStep: 'intro-structure',
  });
  const res = new MockServerResponse();
  await runtime.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);

  assert.equal(res.statusCode, 200);
  const orch = (res.jsonBody().data as { orchestration: Record<string, unknown> }).orchestration;
  assert.equal(orch.toolKey, 'youtube-lf-script');
  assert.deepEqual(orch.stepDependencyArtifactIds, [
    'art-youtube-pre-script-analysis-001',
    'art-youtube-packaging-001',
  ]);
  assert.deepEqual(orch.dependencyArtifactIdsByStep, {
    'pre-script-analysis': 'art-youtube-pre-script-analysis-001',
    packaging: 'art-youtube-packaging-001',
  });
});
