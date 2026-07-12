import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { createAuthStubRepositories } from '../adapters/auth';
import { createInMemoryGenerationAdapters } from '../adapters/generation';
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

const alwaysModelAvailable = async (): Promise<boolean> => true;

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
    checkModelAvailability: alwaysModelAvailable,
    csrf: { enabled: false },
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
    checkModelAvailability: alwaysModelAvailable,
    csrf: { enabled: false },
  });

  const requestPayload = {
    requestId: 'req-node-server-001',
    userId: 'seed-user-001',
    projectId: 'seed-project-001',
    artifactType: 'content',
    model: 'openrouter/gpt-5.3-codex',
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
    checkModelAvailability: alwaysModelAvailable,
    csrf: { enabled: false },
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
    checkModelAvailability: alwaysModelAvailable,
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

test('node runtime dispatcher supports wildcard CORS when credentials are disabled', async () => {
  const requestHandler = createNodeRuntimeRequestHandler({
    generationAdapters: createInMemoryGenerationAdapters(),
    authRuntime: createAuthHttpRuntime({
      repositories: createAuthStubRepositories(),
      passwordHashing: createDefaultPasswordHashRuntime(),
      sessionCookies: createDefaultSessionCookieRuntime(),
    }),
    checkModelAvailability: alwaysModelAvailable,
    cors: {
      allowedOrigins: ['*'],
      allowCredentials: false,
    },
    csrf: { enabled: false },
  });

  const request = new MockIncomingMessage({
    method: 'OPTIONS',
    url: '/generation/stream',
    headers: { origin: 'https://any.example.com' },
  });
  const response = new MockServerResponse();

  await requestHandler(
    request as unknown as IncomingMessage,
    response as unknown as ServerResponse,
  );

  assert.equal(response.statusCode, 204);
  assert.equal(response.getHeader('access-control-allow-origin'), '*');
  assert.equal(response.getHeader('access-control-allow-credentials'), undefined);
});

test('node runtime dispatcher blocks CSRF for unsafe method with untrusted origin', async () => {
  const requestHandler = createNodeRuntimeRequestHandler({
    generationAdapters: createInMemoryGenerationAdapters(),
    authRuntime: createAuthHttpRuntime({
      repositories: createAuthStubRepositories(),
      passwordHashing: createDefaultPasswordHashRuntime(),
      sessionCookies: createDefaultSessionCookieRuntime(),
    }),
    checkModelAvailability: alwaysModelAvailable,
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
      model: 'openrouter/gpt-5.3-codex',
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

test('node runtime request handler rejects wildcard origins when credentials are enabled', () => {
  assert.throws(() => {
    createNodeRuntimeRequestHandler({
      generationAdapters: createInMemoryGenerationAdapters(),
      authRuntime: createAuthHttpRuntime({
        repositories: createAuthStubRepositories(),
        passwordHashing: createDefaultPasswordHashRuntime(),
        sessionCookies: createDefaultSessionCookieRuntime(),
      }),
      checkModelAvailability: alwaysModelAvailable,
      cors: {
        allowedOrigins: ['*'],
        allowCredentials: true,
      },
    });
  }, /Invalid CORS configuration/);
});

test('node runtime dispatcher denies generation stream for forbidden ownership without usage side effects', async () => {
  const adapters = createInMemoryGenerationAdapters();
  let usageClaims = 0;
  const originalClaimUsage = adapters.usage.claimUsage;
  adapters.usage.claimUsage = async (input) => {
    usageClaims += 1;
    return originalClaimUsage(input);
  };

  const requestHandler = createNodeRuntimeRequestHandler({
    generationAdapters: adapters,
    authRuntime: createAuthHttpRuntime({
      repositories: createAuthStubRepositories(),
      passwordHashing: createDefaultPasswordHashRuntime(),
      sessionCookies: createDefaultSessionCookieRuntime(),
    }),
    checkModelAvailability: alwaysModelAvailable,
    checkProjectOwnership: async () => ({ owned: false, reason: 'ownership_forbidden' }),
    csrf: { enabled: false },
  });

  const request = new MockIncomingMessage({
    method: 'POST',
    url: '/generation/stream',
    body: JSON.stringify({
      requestId: 'req-node-server-ownership-forbidden-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'openrouter/gpt-5.3-codex',
      input: { prompt: 'ownership forbidden' },
      registrySnapshotRef: 'snapshot:ownership-forbidden',
    }),
  });
  const response = new MockServerResponse();

  await requestHandler(
    request as unknown as IncomingMessage,
    response as unknown as ServerResponse,
  );

  assert.equal(response.statusCode, 403);
  assert.equal(usageClaims, 0);
  const body = response.jsonBody();
  assert.equal(body.ok, false);
});

test('node runtime dispatcher returns not_found when project is missing without usage side effects', async () => {
  const adapters = createInMemoryGenerationAdapters();
  let usageClaims = 0;
  const originalClaimUsage = adapters.usage.claimUsage;
  adapters.usage.claimUsage = async (input) => {
    usageClaims += 1;
    return originalClaimUsage(input);
  };

  const requestHandler = createNodeRuntimeRequestHandler({
    generationAdapters: adapters,
    authRuntime: createAuthHttpRuntime({
      repositories: createAuthStubRepositories(),
      passwordHashing: createDefaultPasswordHashRuntime(),
      sessionCookies: createDefaultSessionCookieRuntime(),
    }),
    checkModelAvailability: alwaysModelAvailable,
    checkProjectOwnership: async () => ({ owned: false, reason: 'project_not_found' }),
    csrf: { enabled: false },
  });

  const request = new MockIncomingMessage({
    method: 'POST',
    url: '/generation/stream',
    body: JSON.stringify({
      requestId: 'req-node-server-project-not-found-001',
      userId: 'seed-user-001',
      projectId: 'missing-project-001',
      artifactType: 'content',
      model: 'openrouter/gpt-5.3-codex',
      input: { prompt: 'project not found' },
      registrySnapshotRef: 'snapshot:project-not-found',
    }),
  });
  const response = new MockServerResponse();

  await requestHandler(
    request as unknown as IncomingMessage,
    response as unknown as ServerResponse,
  );

  assert.equal(response.statusCode, 404);
  assert.equal(usageClaims, 0);
  const body = response.jsonBody();
  assert.equal(body.ok, false);
});

test('node runtime dispatcher rejects unavailable model with 422', async () => {
  const requestHandler = createNodeRuntimeRequestHandler({
    generationAdapters: createInMemoryGenerationAdapters(),
    authRuntime: createAuthHttpRuntime({
      repositories: createAuthStubRepositories(),
      passwordHashing: createDefaultPasswordHashRuntime(),
      sessionCookies: createDefaultSessionCookieRuntime(),
    }),
    checkModelAvailability: async () => false,
    csrf: { enabled: false },
  });

  const request = new MockIncomingMessage({
    method: 'POST',
    url: '/generation/stream',
    body: JSON.stringify({
      requestId: 'req-node-server-model-unavailable-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'unavailable-model',
      input: { prompt: 'model guard check' },
      registrySnapshotRef: 'snapshot:model-guard',
    }),
  });
  const response = new MockServerResponse();

  await requestHandler(
    request as unknown as IncomingMessage,
    response as unknown as ServerResponse,
  );

  assert.equal(response.statusCode, 422);
  const body = response.jsonBody();
  assert.equal(body.ok, false);
});

test('createNodeRuntimeRequestHandler throws when CSRF enabled and resolved trusted origins are empty', () => {
  assert.throws(() => {
    createNodeRuntimeRequestHandler({
      generationAdapters: createInMemoryGenerationAdapters(),
      authRuntime: createAuthHttpRuntime({
        repositories: createAuthStubRepositories(),
        passwordHashing: createDefaultPasswordHashRuntime(),
        sessionCookies: createDefaultSessionCookieRuntime(),
      }),
      checkModelAvailability: alwaysModelAvailable,
      // Neither csrf.trustedOrigins nor cors.allowedOrigins provided — resolves to empty.
      csrf: { enabled: true },
    });
  }, /Invalid CSRF configuration: trustedOrigins must be non-empty/);
});

test('createNodeRuntimeRequestHandler throws when CSRF enabled and trustedOrigins contains wildcard', () => {
  assert.throws(() => {
    createNodeRuntimeRequestHandler({
      generationAdapters: createInMemoryGenerationAdapters(),
      authRuntime: createAuthHttpRuntime({
        repositories: createAuthStubRepositories(),
        passwordHashing: createDefaultPasswordHashRuntime(),
        sessionCookies: createDefaultSessionCookieRuntime(),
      }),
      checkModelAvailability: alwaysModelAvailable,
      csrf: { enabled: true, trustedOrigins: ['*'] },
    });
  }, /Invalid CSRF configuration: trustedOrigins cannot include "\*"/);
});

test('node runtime dispatcher returns 403 when CSRF enabled and origin is missing', async () => {
  const requestHandler = createNodeRuntimeRequestHandler({
    generationAdapters: createInMemoryGenerationAdapters(),
    authRuntime: createAuthHttpRuntime({
      repositories: createAuthStubRepositories(),
      passwordHashing: createDefaultPasswordHashRuntime(),
      sessionCookies: createDefaultSessionCookieRuntime(),
    }),
    checkModelAvailability: alwaysModelAvailable,
    cors: {
      allowedOrigins: ['https://frontend.example.com'],
      allowCredentials: true,
    },
    csrf: {
      enabled: true,
      trustedOrigins: ['https://frontend.example.com'],
    },
  });

  const request = new MockIncomingMessage({
    method: 'POST',
    url: '/generation/stream',
    // No origin header — missing origin must be treated as untrusted.
    body: JSON.stringify({
      requestId: 'req-csrf-no-origin-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'openrouter/gpt-5.3-codex',
      input: { prompt: 'csrf missing origin' },
      registrySnapshotRef: 'snapshot:csrf-no-origin',
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
  assert.equal((body.error as Record<string, unknown>)?.code, 'forbidden');
});

test('node runtime dispatcher bypasses CSRF gate for excluded paths', async () => {
  const requestHandler = createNodeRuntimeRequestHandler({
    generationAdapters: createInMemoryGenerationAdapters(),
    authRuntime: createAuthHttpRuntime({
      repositories: createAuthStubRepositories(),
      passwordHashing: createDefaultPasswordHashRuntime(),
      sessionCookies: createDefaultSessionCookieRuntime(),
    }),
    checkModelAvailability: alwaysModelAvailable,
    csrf: {
      enabled: true,
      trustedOrigins: ['https://frontend.example.com'],
      excludePaths: ['/auth/login'],
    },
  });

  // POST to an excluded path with no origin — must not be blocked by CSRF gate.
  const request = new MockIncomingMessage({
    method: 'POST',
    url: '/auth/login',
    // No origin header.
  });
  const response = new MockServerResponse();

  await requestHandler(
    request as unknown as IncomingMessage,
    response as unknown as ServerResponse,
  );

  // Auth runtime handles this route; we only assert it was NOT rejected with 403 by CSRF.
  assert.notEqual(response.statusCode, 403);
});
