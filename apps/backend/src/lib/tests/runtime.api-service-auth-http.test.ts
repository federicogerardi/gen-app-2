import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  createAuthHttpRuntime,
  createDefaultPasswordHashRuntime,
  createDefaultSessionCookieRuntime,
} from '../runtime';
import { createAuthStubRepositories } from '../adapters';

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
  }) {
    super();
    this.method = options.method;
    this.url = options.url;
    this.headers = options.headers ?? {};
    this.socket = { remoteAddress: null };

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

class ApiServiceDbStub {
  async query<T = unknown>(sqlText: string): Promise<{ rows: T[] }> {
    if (sqlText.includes('FROM api_services') && sqlText.includes('ORDER BY created_at DESC')) {
      return {
        rows: [
          {
            id: 'svc_1',
            key: 'github-issues',
            label: 'GitHub Issues',
            base_url: 'https://api.github.com',
            resource_path: '/repos/acme/repo/issues',
            access_mode: 'token',
            timeout_ms: 5000,
            retry_count: 1,
            request_method: 'GET',
            request_template_json: {},
            request_mapping_rules_json: [],
            request_headers_template_json: {},
            response_mapping_rules_json: [],
            error_mapping_rules_json: [],
            contract_profile_version: 1,
            token_ref: 'vault://github/issues',
            status: 'active',
            created_at: new Date('2026-05-24T10:00:00.000Z'),
            updated_at: new Date('2026-05-24T10:01:00.000Z'),
          } as T,
        ],
      };
    }

    if (
      sqlText.includes('FROM api_services')
      && sqlText.includes('WHERE id = $1')
      && sqlText.includes("status = 'active'")
    ) {
      return {
        rows: [
          {
            id: 'svc_1',
            key: 'github-issues',
            label: 'GitHub Issues',
            base_url: 'https://api.github.com',
            resource_path: '/repos/acme/repo/issues',
            access_mode: 'token',
            timeout_ms: 5000,
            retry_count: 1,
            request_method: 'GET',
            request_template_json: {},
            request_mapping_rules_json: [],
            request_headers_template_json: {},
            response_mapping_rules_json: [],
            error_mapping_rules_json: [],
            contract_profile_version: 1,
            token_ref: 'vault://github/issues',
            token_ciphertext: 'ciphertext-value',
            status: 'active',
            created_at: new Date('2026-05-24T10:00:00.000Z'),
            updated_at: new Date('2026-05-24T10:01:00.000Z'),
          } as T,
        ],
      };
    }

    if (sqlText.includes('FROM api_service_tool_step_bindings') && sqlText.includes('ORDER BY created_at DESC')) {
      return {
        rows: [
          {
            id: 'bind_1',
            api_service_id: 'svc_1',
            tool_key: 'funnel-pages',
            step_key: 'optin',
            workflow_step_type: 'acquisition',
            binding_status: 'active',
            requiredness: 'required-by-tool-setting',
            created_at: new Date('2026-05-24T10:00:00.000Z'),
            updated_at: new Date('2026-05-24T10:01:00.000Z'),
          } as T,
        ],
      };
    }

    throw new Error(`Unsupported SQL in ApiServiceDbStub: ${sqlText}`);
  }

  async connect(): Promise<{ query: <T = unknown>(sqlText: string, values?: unknown[]) => Promise<{ rows: T[] }>; release: () => void }> {
    return {
      query: <T = unknown>(sqlText: string) => this.query<T>(sqlText),
      release: () => {},
    };
  }
}

const loginAndGetCookie = async (
  runtime: ReturnType<typeof createAuthHttpRuntime>,
  email: string,
  password: string,
): Promise<string> => {
  const request = new MockIncomingMessage({
    method: 'POST',
    url: '/auth/login',
    body: JSON.stringify({ email, password }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 200);

  const setCookie = response.getHeader('set-cookie');
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return (typeof raw === 'string' ? raw.split(';')[0] : '') ?? '';
};

test('admin api-services list enforces admin role', async () => {
  const repositories = createAuthStubRepositories();
  const hasher = createDefaultPasswordHashRuntime();
  const cookieRuntime = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });

  const memberHash = await hasher.hashPassword('Member-Pass-1!');
  await repositories.users.createUser({
    id: 'member-001',
    email: 'member@example.com',
    role: 'member',
    status: 'active',
    passwordHash: memberHash,
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const runtime = createAuthHttpRuntime({
    repositories,
    db: new ApiServiceDbStub() as any,
    passwordHashing: hasher,
    sessionCookies: cookieRuntime,
    now: () => new Date('2026-05-24T12:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'sess-member-001' },
  });

  const cookie = await loginAndGetCookie(runtime, 'member@example.com', 'Member-Pass-1!');

  const request = new MockIncomingMessage({
    method: 'GET',
    url: '/api/admin/api-services',
    headers: { cookie },
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 403);
});

test('admin api-services list returns redacted payload without tokenCiphertext', async () => {
  const repositories = createAuthStubRepositories();
  const hasher = createDefaultPasswordHashRuntime();
  const cookieRuntime = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });

  const adminHash = await hasher.hashPassword('Admin-Pass-1!');
  await repositories.users.createUser({
    id: 'admin-001',
    email: 'admin@example.com',
    role: 'admin',
    status: 'active',
    passwordHash: adminHash,
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const runtime = createAuthHttpRuntime({
    repositories,
    db: new ApiServiceDbStub() as any,
    passwordHashing: hasher,
    sessionCookies: cookieRuntime,
    now: () => new Date('2026-05-24T12:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'sess-admin-001' },
  });

  const cookie = await loginAndGetCookie(runtime, 'admin@example.com', 'Admin-Pass-1!');

  const request = new MockIncomingMessage({
    method: 'GET',
    url: '/api/admin/api-services',
    headers: { cookie },
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 200);

  const body = response.jsonBody();
  assert.equal(body.ok, true);

  const apiServices = ((body.data ?? {}) as { apiServices?: Array<Record<string, unknown>> }).apiServices ?? [];
  assert.equal(apiServices.length, 1);
  assert.equal(apiServices[0]?.tokenConfigured, true);
  assert.equal('tokenCiphertext' in (apiServices[0] ?? {}), false);
});

test('admin api-service bindings list returns deterministic binding payload', async () => {
  const repositories = createAuthStubRepositories();
  const hasher = createDefaultPasswordHashRuntime();
  const cookieRuntime = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });

  const adminHash = await hasher.hashPassword('Admin-Pass-1!');
  await repositories.users.createUser({
    id: 'admin-001',
    email: 'admin@example.com',
    role: 'admin',
    status: 'active',
    passwordHash: adminHash,
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const runtime = createAuthHttpRuntime({
    repositories,
    db: new ApiServiceDbStub() as any,
    passwordHashing: hasher,
    sessionCookies: cookieRuntime,
    now: () => new Date('2026-05-24T12:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'sess-admin-001' },
  });

  const cookie = await loginAndGetCookie(runtime, 'admin@example.com', 'Admin-Pass-1!');

  const request = new MockIncomingMessage({
    method: 'GET',
    url: '/api/admin/api-services/svc_1/bindings',
    headers: { cookie },
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 200);

  const body = response.jsonBody();
  const bindings = ((body.data ?? {}) as { bindings?: Array<Record<string, unknown>> }).bindings ?? [];
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0]?.workflowStepType, 'acquisition');
});

test('tools api-service resolve returns resolveContract metadata and redacted service', async () => {
  const repositories = createAuthStubRepositories();
  const hasher = createDefaultPasswordHashRuntime();
  const cookieRuntime = createDefaultSessionCookieRuntime({ cookieName: 'genapp_session' });

  const memberHash = await hasher.hashPassword('Member-Pass-1!');
  await repositories.users.createUser({
    id: 'member-001',
    email: 'member@example.com',
    role: 'member',
    status: 'active',
    passwordHash: memberHash,
    passwordAlgo: hasher.passwordAlgorithm,
  });

  const runtime = createAuthHttpRuntime({
    repositories,
    db: new ApiServiceDbStub() as any,
    passwordHashing: hasher,
    sessionCookies: cookieRuntime,
    now: () => new Date('2026-05-24T12:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'sess-member-001' },
  });

  const cookie = await loginAndGetCookie(runtime, 'member@example.com', 'Member-Pass-1!');

  const request = new MockIncomingMessage({
    method: 'GET',
    url: '/api/tools/api-services?apiServiceId=svc_1',
    headers: { cookie },
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 200);

  const body = response.jsonBody();
  const data = (body.data ?? {}) as Record<string, unknown>;
  const resolveContract = (data.resolveContract ?? {}) as Record<string, unknown>;
  const apiService = (data.apiService ?? {}) as Record<string, unknown>;

  assert.equal(resolveContract.apiServiceId, 'svc_1');
  assert.equal(resolveContract.contractProfileVersion, 1);
  assert.equal(Array.isArray(resolveContract.bindings), true);
  assert.equal('tokenCiphertext' in apiService, false);
});
