import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { createAuthStubRepositories, createInMemoryGenerationAdapters } from '../adapters';
import {
  createAuthHttpRuntime,
  createDefaultPasswordHashRuntime,
  createDefaultSessionCookieRuntime,
  createNodeRuntimeRequestHandler,
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
  headersSent = false;
  writableEnded = false;
  destroyed = false;
  statusCode = 200;
  readonly headers = new Map<string, string | string[]>();
  readonly chunks: string[] = [];

  setHeader(name: string, value: string | string[]) {
    this.headers.set(name.toLowerCase(), value);
  }

  getHeader(name: string): string | string[] | undefined {
    return this.headers.get(name.toLowerCase());
  }

  flushHeaders() {
    this.headersSent = true;
  }

  write(chunk: string, callback?: (error?: Error | null) => void): boolean {
    this.chunks.push(chunk);
    callback?.();
    return true;
  }

  end(chunk?: string) {
    if (typeof chunk === 'string' && chunk.length > 0) {
      this.chunks.push(chunk);
    }

    this.writableEnded = true;
    this.emit('finish');
  }

  jsonBody(): Record<string, unknown> {
    const payload = this.chunks.join('');
    return payload.length > 0 ? JSON.parse(payload) as Record<string, unknown> : {};
  }
}

test('node runtime dispatcher routes auth request to auth runtime', async () => {
  const repositories = createAuthStubRepositories();
  const authRuntime = createAuthHttpRuntime({
    repositories,
    passwordHashing: createDefaultPasswordHashRuntime(),
    sessionCookies: createDefaultSessionCookieRuntime(),
  });

  const requestHandler = createNodeRuntimeRequestHandler({
    generationAdapters: createInMemoryGenerationAdapters(),
    authRuntime,
  });

  const request = new MockIncomingMessage({ method: 'GET', url: '/auth/session' });
  const response = new MockServerResponse();

  await requestHandler(
    request as unknown as IncomingMessage,
    response as unknown as ServerResponse,
  );

  assert.equal(response.statusCode, 401);
  const body = response.jsonBody();
  assert.equal(body.ok, false);
});

test('node runtime dispatcher routes generation stream to SSE runtime', async () => {
  const adapters = createInMemoryGenerationAdapters();
  adapters.llm.streamText = async function* () {
    yield { type: 'chunk', chunk: 'hello ' } as const;
    yield { type: 'chunk', chunk: 'world' } as const;
    yield {
      type: 'completed',
      usage: {
        inputTokens: 2,
        outputTokens: 2,
        costUsd: 0.00001,
      },
    } as const;
  };

  const requestHandler = createNodeRuntimeRequestHandler({
    generationAdapters: adapters,
    authRuntime: createAuthHttpRuntime({
      repositories: createAuthStubRepositories(),
      passwordHashing: createDefaultPasswordHashRuntime(),
      sessionCookies: createDefaultSessionCookieRuntime(),
    }),
  });

  const requestPayload = {
    requestId: 'req-node-server-001',
    userId: 'seed-user-001',
    projectId: 'seed-project-001',
    artifactType: 'content',
    model: 'gpt-5.3-codex',
    input: { prompt: 'node server runtime' },
    workflowType: null,
    idempotencyKey: 'idem-node-server-001',
    registrySnapshotRef: 'snapshot:node-server-runtime',
  };

  const request = new MockIncomingMessage({
    method: 'POST',
    url: '/generation/stream',
    body: JSON.stringify(requestPayload),
  });
  const response = new MockServerResponse();

  await requestHandler(
    request as unknown as IncomingMessage,
    response as unknown as ServerResponse,
  );

  const payload = response.chunks.join('');
  assert.equal(response.statusCode, 200);
  assert.equal(response.getHeader('content-type'), 'text/event-stream; charset=utf-8');
  assert.ok(payload.includes('event: start'));
  assert.ok(payload.includes('event: chunk'));
  assert.ok(payload.includes('event: terminal'));
  assert.equal(response.writableEnded, true);
});

test('node runtime dispatcher returns 404 for unknown route', async () => {
  const requestHandler = createNodeRuntimeRequestHandler({
    generationAdapters: createInMemoryGenerationAdapters(),
    authRuntime: createAuthHttpRuntime({
      repositories: createAuthStubRepositories(),
      passwordHashing: createDefaultPasswordHashRuntime(),
      sessionCookies: createDefaultSessionCookieRuntime(),
    }),
  });

  const request = new MockIncomingMessage({ method: 'GET', url: '/unknown' });
  const response = new MockServerResponse();

  await requestHandler(
    request as unknown as IncomingMessage,
    response as unknown as ServerResponse,
  );

  assert.equal(response.statusCode, 404);
  const body = response.jsonBody();
  assert.equal(body.ok, false);
});

test('node runtime dispatcher handles CORS preflight for allowed origin', async () => {
  const requestHandler = createNodeRuntimeRequestHandler({
    generationAdapters: createInMemoryGenerationAdapters(),
    authRuntime: createAuthHttpRuntime({
      repositories: createAuthStubRepositories(),
      passwordHashing: createDefaultPasswordHashRuntime(),
      sessionCookies: createDefaultSessionCookieRuntime(),
    }),
    cors: {
      allowedOrigins: ['https://frontend.codespaces.example.com'],
      allowCredentials: true,
    },
  });

  const request = new MockIncomingMessage({
    method: 'OPTIONS',
    url: '/generation/stream',
    headers: { origin: 'https://frontend.codespaces.example.com' },
  });
  const response = new MockServerResponse();

  await requestHandler(
    request as unknown as IncomingMessage,
    response as unknown as ServerResponse,
  );

  assert.equal(response.statusCode, 204);
  assert.equal(response.getHeader('access-control-allow-origin'), 'https://frontend.codespaces.example.com');
  assert.equal(response.getHeader('access-control-allow-credentials'), 'true');
});

test('node runtime dispatcher blocks CSRF for unsafe method with untrusted origin', async () => {
  const requestHandler = createNodeRuntimeRequestHandler({
    generationAdapters: createInMemoryGenerationAdapters(),
    authRuntime: createAuthHttpRuntime({
      repositories: createAuthStubRepositories(),
      passwordHashing: createDefaultPasswordHashRuntime(),
      sessionCookies: createDefaultSessionCookieRuntime(),
    }),
    cors: {
      allowedOrigins: ['https://frontend.codespaces.example.com'],
      allowCredentials: true,
    },
    csrf: {
      enabled: true,
      trustedOrigins: ['https://frontend.codespaces.example.com'],
      protectedMethods: ['POST', 'PATCH', 'PUT', 'DELETE'],
    },
  });

  const request = new MockIncomingMessage({
    method: 'POST',
    url: '/generation/stream',
    headers: { origin: 'https://evil.example.com' },
    body: JSON.stringify({
      requestId: 'req-csrf-block-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      input: { prompt: 'csrf check' },
      registrySnapshotRef: 'snapshot:csrf-check',
    }),
  });
  const response = new MockServerResponse();

  await requestHandler(
    request as unknown as IncomingMessage,
    response as unknown as ServerResponse,
  );

  assert.equal(response.statusCode, 403);
  const body = response.jsonBody();
  assert.equal(body.ok, false);
});
