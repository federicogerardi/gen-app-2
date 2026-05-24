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
  private services: Array<Record<string, unknown>> = [
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
      token_header_name: null,
      response_mapping_rules_json: [],
      error_mapping_rules_json: [],
      contract_profile_version: 1,
      token_ref: 'vault://github/issues',
      token_ciphertext: 'ciphertext-value',
      status: 'active',
      created_at: new Date('2026-05-24T10:00:00.000Z'),
      updated_at: new Date('2026-05-24T10:01:00.000Z'),
    },
  ];

  private bindings: Array<Record<string, unknown>> = [
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
    },
  ];

  async query<T = unknown>(sqlText: string, values?: unknown[]): Promise<{ rows: T[] }> {
    if (sqlText.includes('FROM api_services') && sqlText.includes('ORDER BY created_at DESC')) {
      const rows = [...this.services]
        .sort((a, b) => Number((b.created_at as Date).getTime()) - Number((a.created_at as Date).getTime()))
        .map((row) => ({ ...row })) as T[];
      return { rows };
    }

    if (
      sqlText.includes('FROM api_services')
      && sqlText.includes('WHERE id = $1')
      && sqlText.includes("status = 'active'")
    ) {
      const id = String(values?.[0] ?? '');
      const service = this.services.find((item) => item.id === id && item.status === 'active');
      return { rows: service ? [{ ...service } as T] : [] };
    }

    if (sqlText.includes('FROM api_services') && sqlText.includes('WHERE id = $1')) {
      const id = String(values?.[0] ?? '');
      const service = this.services.find((item) => item.id === id);
      return { rows: service ? [{ ...service } as T] : [] };
    }

    if (sqlText.includes('INSERT INTO api_services')) {
      const now = new Date('2026-05-24T12:00:00.000Z');
      const id = `svc_${this.services.length + 1}`;
      const row = {
        id,
        key: values?.[0] as string,
        label: values?.[1] as string,
        base_url: values?.[2] as string,
        resource_path: values?.[3] as string,
        access_mode: values?.[4] as string,
        timeout_ms: values?.[5] as number,
        retry_count: values?.[6] as number,
        request_method: values?.[7] as string,
        request_template_json: JSON.parse(String(values?.[8] ?? '{}')),
        request_mapping_rules_json: JSON.parse(String(values?.[9] ?? '[]')),
        request_headers_template_json: JSON.parse(String(values?.[10] ?? '{}')),
        token_header_name: values?.[11] as string | null,
        response_mapping_rules_json: JSON.parse(String(values?.[12] ?? '[]')),
        error_mapping_rules_json: JSON.parse(String(values?.[13] ?? '[]')),
        contract_profile_version: values?.[14] as number,
        token_ref: values?.[15] as string | null,
        token_ciphertext: values?.[16] as string | null,
        status: values?.[17] as string,
        created_at: now,
        updated_at: now,
      };
      this.services.push(row);
      return {
        rows: [{ ...row } as T],
      };
    }

    if (sqlText.includes('UPDATE api_services')) {
      const id = String(values?.[values.length - 1] ?? '');
      const current = this.services.find((item) => item.id === id);
      if (!current) {
        return { rows: [] };
      }

      const extract = (column: string): unknown => {
        const escaped = column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = sqlText.match(new RegExp(`${escaped} = \\$(\\d+)`));
        if (!match) {
          return undefined;
        }
        const index = Number(match[1]) - 1;
        return values?.[index];
      };

      const parsedJson = (column: string): unknown => {
        const raw = extract(column);
        if (typeof raw !== 'string') {
          return undefined;
        }
        return JSON.parse(raw);
      };

      const updated = {
        ...current,
        ...(extract('key') !== undefined ? { key: extract('key') } : {}),
        ...(extract('label') !== undefined ? { label: extract('label') } : {}),
        ...(extract('base_url') !== undefined ? { base_url: extract('base_url') } : {}),
        ...(extract('resource_path') !== undefined ? { resource_path: extract('resource_path') } : {}),
        ...(extract('access_mode') !== undefined ? { access_mode: extract('access_mode') } : {}),
        ...(extract('timeout_ms') !== undefined ? { timeout_ms: extract('timeout_ms') } : {}),
        ...(extract('retry_count') !== undefined ? { retry_count: extract('retry_count') } : {}),
        ...(extract('request_method') !== undefined ? { request_method: extract('request_method') } : {}),
        ...(parsedJson('request_template_json') !== undefined ? { request_template_json: parsedJson('request_template_json') } : {}),
        ...(parsedJson('request_mapping_rules_json') !== undefined ? { request_mapping_rules_json: parsedJson('request_mapping_rules_json') } : {}),
        ...(parsedJson('request_headers_template_json') !== undefined ? { request_headers_template_json: parsedJson('request_headers_template_json') } : {}),
        ...(extract('token_header_name') !== undefined ? { token_header_name: extract('token_header_name') } : {}),
        ...(parsedJson('response_mapping_rules_json') !== undefined ? { response_mapping_rules_json: parsedJson('response_mapping_rules_json') } : {}),
        ...(parsedJson('error_mapping_rules_json') !== undefined ? { error_mapping_rules_json: parsedJson('error_mapping_rules_json') } : {}),
        ...(extract('contract_profile_version') !== undefined ? { contract_profile_version: extract('contract_profile_version') } : {}),
        ...(extract('token_ref') !== undefined ? { token_ref: extract('token_ref') } : {}),
        ...(extract('token_ciphertext') !== undefined ? { token_ciphertext: extract('token_ciphertext') } : {}),
        ...(extract('status') !== undefined ? { status: extract('status') } : {}),
        updated_at: new Date('2026-05-24T12:10:00.000Z'),
      };

      this.services = this.services.map((item) => (item.id === id ? updated : item));
      return { rows: [{ ...updated } as T] };
    }

    if (sqlText.includes('FROM api_service_tool_step_bindings') && sqlText.includes('ORDER BY created_at DESC')) {
      return { rows: this.bindings.map((row) => ({ ...row } as T)) };
    }

    throw new Error(`Unsupported SQL in ApiServiceDbStub: ${sqlText}`);
  }

  async connect(): Promise<{ query: <T = unknown>(sqlText: string, values?: unknown[]) => Promise<{ rows: T[] }>; release: () => void }> {
    return {
      query: <T = unknown>(sqlText: string, values?: unknown[]) => this.query<T>(sqlText, values),
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
  assert.equal(
    ((resolveContract.requestContractProfile ?? {}) as Record<string, unknown>).tokenHeaderName,
    null,
  );
  assert.equal(Array.isArray(resolveContract.bindings), true);
  assert.equal('tokenCiphertext' in apiService, false);
});

test('admin api-services create accepts tokenHeaderName and returns redacted payload', async () => {
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
    method: 'POST',
    url: '/api/admin/api-services',
    headers: { cookie },
    body: JSON.stringify({
      key: 'billing-api',
      label: 'Billing API',
      baseUrl: 'https://billing.example.com',
      resourcePath: '/v1/billing',
      accessMode: 'token',
      tokenRef: 'vault://billing/token',
      tokenHeaderName: 'X-API-Key',
      requestMethod: 'GET',
      requestTemplateJson: {},
      requestMappingRulesJson: [],
      requestHeadersTemplateJson: {},
      responseMappingRulesJson: [],
      errorMappingRulesJson: [],
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 201);

  const body = response.jsonBody();
  const apiService = (((body.data ?? {}) as Record<string, unknown>).apiService ?? {}) as Record<string, unknown>;
  assert.equal(apiService.tokenHeaderName, 'X-API-Key');
  assert.equal('tokenCiphertext' in apiService, false);
});

test('admin api-services update roundtrip persists tokenHeaderName', async () => {
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

  const updateRequest = new MockIncomingMessage({
    method: 'PUT',
    url: '/api/admin/api-services/svc_1',
    headers: { cookie },
    body: JSON.stringify({ tokenHeaderName: 'X-Service-Token' }),
  });
  const updateResponse = new MockServerResponse();

  await runtime.handleRequest(updateRequest as unknown as IncomingMessage, updateResponse as unknown as ServerResponse);
  assert.equal(updateResponse.statusCode, 200);

  const updateBody = updateResponse.jsonBody();
  const updatedService = (((updateBody.data ?? {}) as Record<string, unknown>).apiService ?? {}) as Record<string, unknown>;
  assert.equal(updatedService.tokenHeaderName, 'X-Service-Token');

  const listRequest = new MockIncomingMessage({
    method: 'GET',
    url: '/api/admin/api-services',
    headers: { cookie },
  });
  const listResponse = new MockServerResponse();

  await runtime.handleRequest(listRequest as unknown as IncomingMessage, listResponse as unknown as ServerResponse);
  assert.equal(listResponse.statusCode, 200);
  const listBody = listResponse.jsonBody();
  const services = (((listBody.data ?? {}) as Record<string, unknown>).apiServices ?? []) as Array<Record<string, unknown>>;
  assert.equal(services[0]?.tokenHeaderName, 'X-Service-Token');
});
