import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  ArtifactQueryRepositoryStub,
  ProjectQueryRepositoryStub,
  createAuthStubRepositories,
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
    return serialized.length > 0 ? JSON.parse(serialized) as Record<string, unknown> : {};
  }
}

test('session endpoints return SessionArtifactGroup and step artifact from authenticated context', async () => {
  const hasher = createDefaultPasswordHashRuntime();
  const repositories = createAuthStubRepositories();
  const sessionCookies = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });
  const projectQueries = new ProjectQueryRepositoryStub();
  const artifactQueries = new ArtifactQueryRepositoryStub();

  await repositories.users.createUser({
    id: 'user-session-e2e-001',
    email: 'session-e2e@example.com',
    role: 'member',
    status: 'active',
    passwordHash: await hasher.hashPassword('Session-E2E-Pass-1'),
    passwordAlgo: hasher.passwordAlgorithm,
  });

  artifactQueries.seed([
    {
      artifactId: 'artifact-packaging-001',
      requestId: 'req-packaging-001',
      userId: 'user-session-e2e-001',
      projectId: 'project-session-e2e-001',
      artifactType: 'content',
      status: 'completed',
      model: 'openrouter:auto',
      workflowType: 'youtube-lf-script',
      sessionId: 'sess-e2e-001',
      stepKey: 'packaging',
      artifactRole: 'step',
      runMode: 'new',
      input: {
        toolWorkflow: {
          toolKey: 'youtube-lf-script',
          stepKey: 'packaging',
          artifactRole: 'step',
          runMode: 'new',
        },
      },
      content: 'packaging output',
      failureReason: null,
      createdAt: '2026-05-09T09:00:00.000Z',
      updatedAt: '2026-05-09T09:00:00.000Z',
    },
    {
      artifactId: 'artifact-outro-001',
      requestId: 'req-outro-001',
      userId: 'user-session-e2e-001',
      projectId: 'project-session-e2e-001',
      artifactType: 'content',
      status: 'completed',
      model: 'openrouter:auto',
      workflowType: 'youtube-lf-script',
      sessionId: 'sess-e2e-001',
      stepKey: 'outro-structure',
      artifactRole: 'final',
      runMode: 'new',
      input: {
        toolWorkflow: {
          toolKey: 'youtube-lf-script',
          stepKey: 'outro-structure',
          artifactRole: 'final',
          runMode: 'new',
        },
      },
      content: 'outro output',
      failureReason: null,
      createdAt: '2026-05-09T09:01:00.000Z',
      updatedAt: '2026-05-09T09:01:00.000Z',
    },
  ]);

  const runtime = createAuthHttpRuntime({
    repositories,
    queryRepositories: {
      projects: projectQueries,
      artifacts: artifactQueries,
    },
    passwordHashing: hasher,
    sessionCookies,
    now: () => new Date('2026-05-09T09:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'auth-session-e2e-001' },
  });

  const loginRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/auth/login',
    body: JSON.stringify({ email: 'session-e2e@example.com', password: 'Session-E2E-Pass-1' }),
  });
  const loginResponse = new MockServerResponse();

  await runtime.handleRequest(
    loginRequest as unknown as IncomingMessage,
    loginResponse as unknown as ServerResponse,
  );

  assert.equal(loginResponse.statusCode, 200);

  const setCookieHeader = loginResponse.getHeader('set-cookie');
  assert.ok(setCookieHeader);
  const setCookieValue = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
  const cookieHeader = typeof setCookieValue === 'string'
    ? (setCookieValue.split(';')[0] ?? '')
    : '';

  const sessionRequest = new MockIncomingMessage({
    method: 'GET',
    url: '/api/tools/sessions/sess-e2e-001',
    headers: { cookie: cookieHeader },
  });
  const sessionResponse = new MockServerResponse();

  await runtime.handleRequest(
    sessionRequest as unknown as IncomingMessage,
    sessionResponse as unknown as ServerResponse,
  );

  assert.equal(sessionResponse.statusCode, 200);
  const sessionBody = sessionResponse.jsonBody();
  assert.equal(sessionBody.ok, true);
  const sessionGroup = (sessionBody.data as {
    session: {
      sessionId: string;
      status: string;
      artifacts: Array<{ stepKey: string; artifactRole: string }>;
    };
  }).session;

  assert.equal(sessionGroup.sessionId, 'sess-e2e-001');
  assert.equal(sessionGroup.status, 'completed');
  assert.deepEqual(
    sessionGroup.artifacts.map((artifact) => artifact.stepKey),
    ['packaging', 'outro-structure'],
  );
  assert.deepEqual(
    sessionGroup.artifacts.map((artifact) => artifact.artifactRole),
    ['step', 'final'],
  );

  const stepRequest = new MockIncomingMessage({
    method: 'GET',
    url: '/api/tools/sessions/sess-e2e-001/step/packaging',
    headers: { cookie: cookieHeader },
  });
  const stepResponse = new MockServerResponse();

  await runtime.handleRequest(
    stepRequest as unknown as IncomingMessage,
    stepResponse as unknown as ServerResponse,
  );

  assert.equal(stepResponse.statusCode, 200);
  const stepBody = stepResponse.jsonBody();
  assert.equal(stepBody.ok, true);
  const stepArtifact = (stepBody.data as { artifact: { artifactId: string; stepKey: string } }).artifact;
  assert.equal(stepArtifact.artifactId, 'artifact-packaging-001');
  assert.equal(stepArtifact.stepKey, 'packaging');
});
