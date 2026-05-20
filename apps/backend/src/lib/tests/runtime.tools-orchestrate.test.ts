import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  ArtifactQueryRepositoryStub,
  createInMemoryGenerationAdapters,
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

const buildRuntime = (
  artifactStub: ArtifactQueryRepositoryStub,
  options: {
    toolsOrchestrateTimeoutMs?: number;
    toolsOrchestrateArtifactScanLimit?: number;
  } = {},
) => {
  const repositories = createAuthStubRepositories();
  const generationAdapters = createInMemoryGenerationAdapters();
  const hasher = createDefaultPasswordHashRuntime();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub({
    randomId: () => 'project-orch-001',
    now: () => FIXED_NOW,
  });

  return {
    repositories,
    generationAdapters,
    hasher,
    sessionCookies,
    projectQueries,
    runtime: createAuthHttpRuntime({
      repositories,
      queryRepositories: {
        projects: projectQueries,
        artifacts: artifactStub,
      },
      idempotency: generationAdapters.idempotency,
      ...(typeof options.toolsOrchestrateTimeoutMs === 'number'
        ? { toolsOrchestrateTimeoutMs: options.toolsOrchestrateTimeoutMs }
        : {}),
      ...(typeof options.toolsOrchestrateArtifactScanLimit === 'number'
        ? { toolsOrchestrateArtifactScanLimit: options.toolsOrchestrateArtifactScanLimit }
        : {}),
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

const ensureOwnedProject = async (
  projectQueries: ProjectQueryRepositoryStub,
  userId: string,
): Promise<string> => {
  const project = await projectQueries.createProjectForUser(userId, { name: 'Owned project' });
  return project.id;
};

const POST_ORCHESTRATE = (cookie: string, body: object) =>
  new MockIncomingMessage({
    method: 'POST',
    url: '/api/tools/orchestrate',
    headers: { cookie },
    body: JSON.stringify(body),
  });

const captureOrchestrateStartMeta = async (
  run: () => Promise<void>,
): Promise<Record<string, unknown> | null> => {
  const originalInfo = console.info;
  let startMeta: Record<string, unknown> | null = null;

  console.info = ((message: string, meta: Record<string, unknown>) => {
    if (
      message === '[gen-route][start]'
      && meta
      && typeof meta === 'object'
      && meta.route === '/api/tools/orchestrate'
    ) {
      startMeta = meta;
    }
    originalInfo(message, meta);
  }) as typeof console.info;

  try {
    await run();
    return startMeta;
  } finally {
    console.info = originalInfo;
  }
};

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
  workflowType: 'funnel_pages',
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
  workflowType: 'funnel_pages',
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
  workflowType: 'youtube_lf_script',
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
  workflowType: 'youtube_lf_script',
  input: { toolWorkflow: { stepKey: 'packaging' }, step: 'packaging' },
  content: '{"packaging":"ok"}',
  failureReason: null,
  createdAt: '2026-05-04T09:10:00.000Z',
  updatedAt: '2026-05-04T09:15:00.000Z',
};

const NEXTLAND_LANDING_ARTIFACT: StubArtifactQueryRecord = {
  artifactId: 'art-nextland-landing-001',
  requestId: 'req-nextland-landing-001',
  userId: 'user-orch-001',
  projectId: 'project-orch-001',
  artifactType: 'content',
  status: 'completed',
  model: 'gpt-4o',
  workflowType: 'nextland',
  input: { toolWorkflow: { stepKey: 'landing' }, step: 'landing' },
  content: '{"landing":"ok"}',
  failureReason: null,
  createdAt: '2026-05-04T09:00:00.000Z',
  updatedAt: '2026-05-04T09:05:00.000Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('/api/tools/orchestrate returns empty deps for first step (optin)', async () => {
  const artifactStub = new ArtifactQueryRepositoryStub();
  const { repositories, hasher, runtime, projectQueries } = buildRuntime(artifactStub);
  const cookie = await createAndLoginUser(runtime, repositories, hasher);
  const projectId = await ensureOwnedProject(projectQueries, 'user-orch-001');
  artifactStub.seed([{ ...OPTIN_ARTIFACT, projectId }]);

  const req = POST_ORCHESTRATE(cookie, {
    projectId,
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
  const { repositories, hasher, runtime, projectQueries } = buildRuntime(artifactStub);
  const cookie = await createAndLoginUser(runtime, repositories, hasher);
  const projectId = await ensureOwnedProject(projectQueries, 'user-orch-001');
  artifactStub.seed([{ ...OPTIN_ARTIFACT, projectId }]);

  const req = POST_ORCHESTRATE(cookie, {
    projectId,
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
  const { repositories, hasher, runtime, projectQueries } = buildRuntime(artifactStub);
  const cookie = await createAndLoginUser(runtime, repositories, hasher);
  const projectId = await ensureOwnedProject(projectQueries, 'user-orch-001');
  artifactStub.seed([
    { ...OPTIN_ARTIFACT, projectId },
    { ...QUIZ_ARTIFACT, projectId },
  ]);

  const req = POST_ORCHESTRATE(cookie, {
    projectId,
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
  const { repositories, hasher, runtime, projectQueries } = buildRuntime(artifactStub);
  const cookie = await createAndLoginUser(runtime, repositories, hasher);
  const projectId = await ensureOwnedProject(projectQueries, 'user-orch-001');

  const req = POST_ORCHESTRATE(cookie, {
    projectId,
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
  const { repositories, hasher, runtime, projectQueries } = buildRuntime(artifactStub);
  const cookie = await createAndLoginUser(runtime, repositories, hasher);
  const projectId = await ensureOwnedProject(projectQueries, 'user-orch-001');
  artifactStub.seed([
    { ...YOUTUBE_PRE_SCRIPT_ANALYSIS_ARTIFACT, projectId },
    { ...YOUTUBE_PACKAGING_ARTIFACT, projectId },
  ]);

  const req = POST_ORCHESTRATE(cookie, {
    projectId,
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

test('/api/tools/orchestrate resolves canonical nextland dependencies', async () => {
  const artifactStub = new ArtifactQueryRepositoryStub();
  const { repositories, hasher, runtime, projectQueries } = buildRuntime(artifactStub);
  const cookie = await createAndLoginUser(runtime, repositories, hasher);
  const projectId = await ensureOwnedProject(projectQueries, 'user-orch-001');
  artifactStub.seed([{ ...NEXTLAND_LANDING_ARTIFACT, projectId }]);

  const req = POST_ORCHESTRATE(cookie, {
    projectId,
    toolKey: 'nextland',
    targetStep: 'thank_you',
  });
  const res = new MockServerResponse();
  await runtime.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);

  assert.equal(res.statusCode, 200);
  const orch = (res.jsonBody().data as { orchestration: Record<string, unknown> }).orchestration;
  assert.equal(orch.toolKey, 'nextland');
  assert.deepEqual(orch.stepDependencyArtifactIds, ['art-nextland-landing-001']);
  assert.deepEqual(orch.dependencyArtifactIdsByStep, {
    landing: 'art-nextland-landing-001',
  });
});

test('/api/tools/orchestrate rejects foreign project ownership without quota side effects', async () => {
  const artifactStub = new ArtifactQueryRepositoryStub();
  const listCalls: string[] = [];
  const originalListArtifactsByUser = artifactStub.listArtifactsByUser.bind(artifactStub);
  artifactStub.listArtifactsByUser = async (userId, filters) => {
    listCalls.push('called');
    return originalListArtifactsByUser(userId, filters);
  };

  const { repositories, hasher, runtime, projectQueries } = buildRuntime(artifactStub);
  const cookie = await createAndLoginUser(runtime, repositories, hasher);

  const before = await repositories.users.findUserById('user-orch-001');
  assert.ok(before);

  const foreignProject = await projectQueries.createProjectForUser('another-user', {
    name: 'Foreign project',
  });

  const req = POST_ORCHESTRATE(cookie, {
    projectId: foreignProject.id,
    toolKey: 'funnel-pages',
    targetStep: 'optin',
  });
  const res = new MockServerResponse();
  await runtime.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);

  assert.equal(res.statusCode, 403);
  const after = await repositories.users.findUserById('user-orch-001');
  assert.ok(after);
  assert.equal(after?.monthlyUsed, before?.monthlyUsed);
  assert.equal(listCalls.length, 0);
});

test('/api/tools/orchestrate rejects missing project without quota side effects', async () => {
  const artifactStub = new ArtifactQueryRepositoryStub();
  const listCalls: string[] = [];
  const originalListArtifactsByUser = artifactStub.listArtifactsByUser.bind(artifactStub);
  artifactStub.listArtifactsByUser = async (userId, filters) => {
    listCalls.push('called');
    return originalListArtifactsByUser(userId, filters);
  };

  const { repositories, hasher, runtime } = buildRuntime(artifactStub);
  const cookie = await createAndLoginUser(runtime, repositories, hasher);

  const before = await repositories.users.findUserById('user-orch-001');
  assert.ok(before);

  const req = POST_ORCHESTRATE(cookie, {
    projectId: 'project-missing-001',
    toolKey: 'funnel-pages',
    targetStep: 'optin',
  });
  const res = new MockServerResponse();
  await runtime.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);

  assert.equal(res.statusCode, 403);
  const after = await repositories.users.findUserById('user-orch-001');
  assert.ok(after);
  assert.equal(after?.monthlyUsed, before?.monthlyUsed);
  assert.equal(listCalls.length, 0);
});

test('/api/tools/orchestrate replays cached orchestration response when idempotencyKey is reused', async () => {
  const artifactStub = new ArtifactQueryRepositoryStub();
  const { repositories, hasher, runtime, projectQueries } = buildRuntime(artifactStub);
  const cookie = await createAndLoginUser(runtime, repositories, hasher);
  const projectId = await ensureOwnedProject(projectQueries, 'user-orch-001');
  artifactStub.seed([{ ...OPTIN_ARTIFACT, projectId }]);

  const firstReq = POST_ORCHESTRATE(cookie, {
    requestId: 'req-orchestrate-replay-001',
    idempotencyKey: 'idem-orchestrate-replay-001',
    projectId,
    toolKey: 'funnel-pages',
    targetStep: 'quiz',
  });
  const firstRes = new MockServerResponse();
  await runtime.handleRequest(firstReq as unknown as IncomingMessage, firstRes as unknown as ServerResponse);

  assert.equal(firstRes.statusCode, 200);

  artifactStub.listArtifactsByUser = async () => {
    throw new Error('listArtifactsByUser should not run on replay response');
  };

  const replayReq = POST_ORCHESTRATE(cookie, {
    requestId: 'req-orchestrate-replay-001-retry',
    idempotencyKey: 'idem-orchestrate-replay-001',
    projectId,
    toolKey: 'funnel-pages',
    targetStep: 'quiz',
  });
  const replayRes = new MockServerResponse();
  await runtime.handleRequest(replayReq as unknown as IncomingMessage, replayRes as unknown as ServerResponse);

  assert.equal(replayRes.statusCode, 200);
  const replayBody = replayRes.jsonBody();
  const orchestration = (replayBody.data as { orchestration: Record<string, unknown> }).orchestration;
  assert.deepEqual(orchestration.stepDependencyArtifactIds, ['art-optin-001']);
  assert.deepEqual(orchestration.dependencyArtifactIdsByStep, { optin: 'art-optin-001' });
});

test('/api/tools/orchestrate returns 409 when idempotency slot is already claimed in progress', async () => {
  const artifactStub = new ArtifactQueryRepositoryStub();
  const { repositories, hasher, runtime, projectQueries, generationAdapters } = buildRuntime(artifactStub);
  const cookie = await createAndLoginUser(runtime, repositories, hasher);
  const projectId = await ensureOwnedProject(projectQueries, 'user-orch-001');

  await generationAdapters.idempotency.checkAndClaim({
    requestId: 'req-orchestrate-conflict-seed',
    userId: 'user-orch-001',
    projectId,
    workflowType: 'funnel_pages',
    idempotencyKey: 'idem-orchestrate-conflict-001',
    registrySnapshotRef: 'snapshot:default' as never,
  });

  const req = POST_ORCHESTRATE(cookie, {
    requestId: 'req-orchestrate-conflict-001',
    idempotencyKey: 'idem-orchestrate-conflict-001',
    projectId,
    toolKey: 'funnel-pages',
    targetStep: 'optin',
  });
  const res = new MockServerResponse();
  await runtime.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);

  assert.equal(res.statusCode, 409);
});

test('/api/tools/orchestrate uses default timeout config when env key is absent', async () => {
  const originalTimeoutEnv = process.env.TOOLS_ORCHESTRATE_TIMEOUT_MS;
  delete process.env.TOOLS_ORCHESTRATE_TIMEOUT_MS;

  try {
    const artifactStub = new ArtifactQueryRepositoryStub();
    const { repositories, hasher, runtime, projectQueries } = buildRuntime(artifactStub);
    const cookie = await createAndLoginUser(runtime, repositories, hasher);
    const projectId = await ensureOwnedProject(projectQueries, 'user-orch-001');
    artifactStub.seed([{ ...OPTIN_ARTIFACT, projectId }]);

    const startMeta = await captureOrchestrateStartMeta(async () => {
      const req = POST_ORCHESTRATE(cookie, {
        projectId,
        toolKey: 'funnel-pages',
        targetStep: 'quiz',
      });
      const res = new MockServerResponse();
      await runtime.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);
      assert.equal(res.statusCode, 200);
    });

    assert.ok(startMeta);
    assert.equal(startMeta.deadlineMs, 3000);
    assert.equal(startMeta.artifactSummaryCount, 0);
    assert.equal(startMeta.artifactDetailBatchCount, 0);
    assert.equal(typeof startMeta.elapsedMs, 'number');
  } finally {
    if (typeof originalTimeoutEnv === 'string') {
      process.env.TOOLS_ORCHESTRATE_TIMEOUT_MS = originalTimeoutEnv;
    } else {
      delete process.env.TOOLS_ORCHESTRATE_TIMEOUT_MS;
    }
  }
});

test('/api/tools/orchestrate uses custom timeout from env key when valid', async () => {
  const originalTimeoutEnv = process.env.TOOLS_ORCHESTRATE_TIMEOUT_MS;
  process.env.TOOLS_ORCHESTRATE_TIMEOUT_MS = '6500';

  try {
    const artifactStub = new ArtifactQueryRepositoryStub();
    const { repositories, hasher, runtime, projectQueries } = buildRuntime(artifactStub);
    const cookie = await createAndLoginUser(runtime, repositories, hasher);
    const projectId = await ensureOwnedProject(projectQueries, 'user-orch-001');
    artifactStub.seed([{ ...OPTIN_ARTIFACT, projectId }]);

    const startMeta = await captureOrchestrateStartMeta(async () => {
      const req = POST_ORCHESTRATE(cookie, {
        projectId,
        toolKey: 'funnel-pages',
        targetStep: 'quiz',
      });
      const res = new MockServerResponse();
      await runtime.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);
      assert.equal(res.statusCode, 200);
    });

    assert.ok(startMeta);
    assert.equal(startMeta.deadlineMs, 6500);
  } finally {
    if (typeof originalTimeoutEnv === 'string') {
      process.env.TOOLS_ORCHESTRATE_TIMEOUT_MS = originalTimeoutEnv;
    } else {
      delete process.env.TOOLS_ORCHESTRATE_TIMEOUT_MS;
    }
  }
});

test('/api/tools/orchestrate falls back to default timeout when env key is invalid', async () => {
  const originalTimeoutEnv = process.env.TOOLS_ORCHESTRATE_TIMEOUT_MS;
  process.env.TOOLS_ORCHESTRATE_TIMEOUT_MS = '0';

  try {
    const artifactStub = new ArtifactQueryRepositoryStub();
    const { repositories, hasher, runtime, projectQueries } = buildRuntime(artifactStub);
    const cookie = await createAndLoginUser(runtime, repositories, hasher);
    const projectId = await ensureOwnedProject(projectQueries, 'user-orch-001');
    artifactStub.seed([{ ...OPTIN_ARTIFACT, projectId }]);

    const startMeta = await captureOrchestrateStartMeta(async () => {
      const req = POST_ORCHESTRATE(cookie, {
        projectId,
        toolKey: 'funnel-pages',
        targetStep: 'quiz',
      });
      const res = new MockServerResponse();
      await runtime.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);
      assert.equal(res.statusCode, 200);
    });

    assert.ok(startMeta);
    assert.equal(startMeta.deadlineMs, 3000);
  } finally {
    if (typeof originalTimeoutEnv === 'string') {
      process.env.TOOLS_ORCHESTRATE_TIMEOUT_MS = originalTimeoutEnv;
    } else {
      delete process.env.TOOLS_ORCHESTRATE_TIMEOUT_MS;
    }
  }
});

test('/api/tools/orchestrate uses bounded completed lookup and does not call broad list endpoint', async () => {
  const artifactStub = new ArtifactQueryRepositoryStub();
  const boundedCalls: Array<{ projectId: string; workflowType: string; limit: number }> = [];
  const originalBounded = artifactStub.listRecentCompletedArtifactsForToolByUser.bind(artifactStub);
  artifactStub.listRecentCompletedArtifactsForToolByUser = async (userId, input) => {
    boundedCalls.push(input);
    return originalBounded(userId, input);
  };

  artifactStub.listArtifactsByUser = async () => {
    throw new Error('listArtifactsByUser must not be used by /api/tools/orchestrate');
  };

  const { repositories, hasher, runtime, projectQueries } = buildRuntime(artifactStub, {
    toolsOrchestrateArtifactScanLimit: 7,
  });
  const cookie = await createAndLoginUser(runtime, repositories, hasher);
  const projectId = await ensureOwnedProject(projectQueries, 'user-orch-001');
  artifactStub.seed([
    { ...OPTIN_ARTIFACT, projectId },
    { ...QUIZ_ARTIFACT, projectId },
  ]);

  const req = POST_ORCHESTRATE(cookie, {
    projectId,
    toolKey: 'funnel-pages',
    targetStep: 'vsl',
  });
  const res = new MockServerResponse();
  await runtime.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);

  assert.equal(res.statusCode, 200);
  assert.equal(boundedCalls.length, 1);
  assert.deepEqual(boundedCalls[0], {
    projectId,
    workflowType: 'funnel_pages',
    limit: 7,
  });
});

test('/api/tools/orchestrate applies bounded ordering deterministically on large history', async () => {
  const artifactStub = new ArtifactQueryRepositoryStub();
  const { repositories, hasher, runtime, projectQueries } = buildRuntime(artifactStub, {
    toolsOrchestrateArtifactScanLimit: 2,
  });
  const cookie = await createAndLoginUser(runtime, repositories, hasher);
  const projectId = await ensureOwnedProject(projectQueries, 'user-orch-001');

  const records: StubArtifactQueryRecord[] = [];
  for (let i = 0; i < 1200; i += 1) {
    records.push({
      artifactId: `art-noise-${String(i).padStart(4, '0')}`,
      requestId: `req-noise-${String(i).padStart(4, '0')}`,
      userId: 'user-orch-001',
      projectId,
      artifactType: 'content',
      status: i % 2 === 0 ? 'completed' : 'failed',
      model: 'gpt-4o',
      workflowType: 'nextland',
      input: { toolWorkflow: { stepKey: 'landing' }, step: 'landing' },
      content: '{"noise":true}',
      failureReason: i % 2 === 0 ? null : 'error',
      createdAt: `2026-05-03T08:${String(i % 60).padStart(2, '0')}:00.000Z`,
      updatedAt: `2026-05-03T08:${String(i % 60).padStart(2, '0')}:00.000Z`,
    });
  }

  records.push({
    ...OPTIN_ARTIFACT,
    artifactId: 'art-optin-newest',
    requestId: 'req-optin-newest',
    projectId,
    updatedAt: '2026-05-04T10:00:02.000Z',
  });
  records.push({
    ...QUIZ_ARTIFACT,
    artifactId: 'art-quiz-newest',
    requestId: 'req-quiz-newest',
    projectId,
    updatedAt: '2026-05-04T10:00:03.000Z',
  });
  records.push({
    ...OPTIN_ARTIFACT,
    artifactId: 'art-optin-older',
    requestId: 'req-optin-older',
    projectId,
    updatedAt: '2026-05-04T10:00:01.000Z',
  });

  artifactStub.seed(records);

  const req = POST_ORCHESTRATE(cookie, {
    projectId,
    toolKey: 'funnel-pages',
    targetStep: 'vsl',
  });
  const res = new MockServerResponse();
  await runtime.handleRequest(req as unknown as IncomingMessage, res as unknown as ServerResponse);

  assert.equal(res.statusCode, 200);
  const orch = (res.jsonBody().data as { orchestration: Record<string, unknown> }).orchestration;
  assert.deepEqual(orch.stepDependencyArtifactIds, ['art-optin-newest', 'art-quiz-newest']);
  assert.deepEqual(orch.dependencyArtifactIdsByStep, {
    optin: 'art-optin-newest',
    quiz: 'art-quiz-newest',
  });
});
