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

const primaryApiServiceId = '11111111-1111-1111-1111-111111111111';
const missingApiServiceId = '99999999-9999-9999-9999-999999999999';

const buildApiServiceId = (index: number): string => (
  `00000000-0000-0000-0000-${String(index).padStart(12, '0')}`
);

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

const parseJsonValue = (value: unknown, fallback: unknown): unknown => {
  if (typeof value === 'string') return JSON.parse(value);
  if (value !== undefined && value !== null) return value;
  return fallback;
};

class ApiServiceDbStub {
  private services: Array<Record<string, unknown>> = [
    {
      id: primaryApiServiceId,
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
      api_service_id: primaryApiServiceId,
      tool_key: 'funnel-pages',
      step_key: 'optin',
      workflow_step_type: 'acquisition',
      binding_status: 'active',
      requiredness: 'required-by-tool-setting',
      created_at: new Date('2026-05-24T10:00:00.000Z'),
      updated_at: new Date('2026-05-24T10:01:00.000Z'),
    },
  ];

  async query<T = unknown>(sqlText: string, values?: unknown[]): Promise<{ rows: T[]; rowCount?: number; command?: string }> {
    const s = sqlText.toLowerCase();

    if (s.includes('begin') || s.includes('commit') || s.includes('rollback')) {
      return { rows: [] };
    }

    if (sqlText.includes('from "api_services"') && sqlText.includes('order by "created_at" desc')) {
      const rows = [...this.services]
        .sort((a, b) => Number((b.created_at as Date).getTime()) - Number((a.created_at as Date).getTime()))
        .map((row) => ({ ...row })) as T[];
      return { rows };
    }

    if (
      sqlText.includes('from "api_services"')
      && sqlText.includes('where "id" =')
      && sqlText.includes('"status" =')
    ) {
      const id = String(values?.[0] ?? '');
      const service = this.services.find((item) => item.id === id && item.status === 'active');
      return { rows: service ? [{ ...service } as T] : [] };
    }

    if (sqlText.includes('from "api_services"') && sqlText.includes('where "id" =')) {
      const id = String(values?.[0] ?? '');
      const service = this.services.find((item) => item.id === id);
      return { rows: service ? [{ ...service } as T] : [] };
    }

    if (sqlText.includes('insert into "api_services"')) {
      const now = new Date('2026-05-24T12:00:00.000Z');
      const id = buildApiServiceId(this.services.length + 1);
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
        request_template_json: parseJsonValue(values?.[8], {}),
        request_mapping_rules_json: parseJsonValue(values?.[9], []),
        request_headers_template_json: parseJsonValue(values?.[10], {}),
        token_header_name: values?.[11] as string | null,
        response_mapping_rules_json: parseJsonValue(values?.[12], []),
        error_mapping_rules_json: parseJsonValue(values?.[13], []),
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
        rowCount: 1,
        command: 'INSERT',
      };
    }

    if (sqlText.includes('update "api_services"')) {
      const id = String(values?.[values.length - 1] ?? '');
      const current = this.services.find((item) => item.id === id);
      if (!current) {
        return { rows: [] };
      }

      const normalized = sqlText.replace(/"/g, '');

      const extract = (column: string): unknown => {
        const escaped = column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = normalized.match(new RegExp(`${escaped} = \\$(\\d+)`));
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
      return { rows: [{ ...updated } as T], rowCount: 1, command: 'UPDATE' };
    }

    if (sqlText.includes('from "api_service_tool_step_bindings"') && sqlText.includes('order by "created_at" desc')) {
      return { rows: this.bindings.map((row) => ({ ...row } as T)) };
    }

    if (sqlText.includes('insert into "api_service_tool_step_bindings"')) {
      const now = new Date('2026-05-24T12:10:00.000Z');
      const requestedId = values?.[0];
      const apiServiceId = String(values?.[1] ?? '');
      const toolKey = String(values?.[2] ?? '');
      const stepKey = String(values?.[3] ?? '');
      const workflowStepType = String(values?.[4] ?? 'acquisition');
      const bindingStatus = String(values?.[5] ?? 'active');
      const requiredness = String(values?.[6] ?? 'required-by-tool-setting');

      const existingIndex = this.bindings.findIndex(
        (binding) => binding.api_service_id === apiServiceId
          && binding.tool_key === toolKey
          && binding.step_key === stepKey,
      );

      if (existingIndex >= 0) {
        const current = this.bindings[existingIndex];
        if (!current) {
          throw new Error('Binding upsert invariant violated: missing existing row');
        }

        const updated = {
          ...current,
          workflow_step_type: workflowStepType,
          binding_status: bindingStatus,
          requiredness,
          updated_at: now,
        };
        this.bindings[existingIndex] = updated;
        return { rows: [{ ...updated } as T], rowCount: 1, command: 'INSERT' };
      }

      const created = {
        id: typeof requestedId === 'string' && requestedId.length > 0
          ? requestedId
          : `bind_${this.bindings.length + 1}`,
        api_service_id: apiServiceId,
        tool_key: toolKey,
        step_key: stepKey,
        workflow_step_type: workflowStepType,
        binding_status: bindingStatus,
        requiredness,
        created_at: now,
        updated_at: now,
      };

      this.bindings.push(created);
      return { rows: [{ ...created } as T], rowCount: 1, command: 'INSERT' };
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

const createAdminRuntimeWithCookie = async (): Promise<{
  runtime: ReturnType<typeof createAuthHttpRuntime>;
  cookie: string;
}> => {
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
  return { runtime, cookie };
};

const validAdminApiServiceCreatePayload = (): Record<string, unknown> => ({
  key: 'billing-api',
  label: 'Billing API',
  baseUrl: 'https://billing.example.com',
  resourcePath: '/v1/billing',
  accessMode: 'public',
  requestMethod: 'GET',
  requestTemplateJson: {},
  requestMappingRulesJson: [],
  requestHeadersTemplateJson: {},
  responseMappingRulesJson: [],
  errorMappingRulesJson: [],
  contractProfileVersion: 1,
});

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
    url: `/api/admin/api-services/${primaryApiServiceId}/bindings`,
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
    url: `/api/tools/api-services?apiServiceId=${primaryApiServiceId}`,
    headers: { cookie },
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 200);

  const body = response.jsonBody();
  const data = (body.data ?? {}) as Record<string, unknown>;
  const resolveContract = (data.resolveContract ?? {}) as Record<string, unknown>;
  const apiService = (data.apiService ?? {}) as Record<string, unknown>;

  assert.equal(resolveContract.apiServiceId, primaryApiServiceId);
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
    url: `/api/admin/api-services/${primaryApiServiceId}`,
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

test('admin api-services create rejects unsupported accessMode through bad_request envelope', async () => {
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
      accessMode: 'private',
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.match(String((body.error as { message?: string }).message), /accessMode/);
});

test('admin api-services create rejects non-object requestTemplateJson through bad_request envelope', async () => {
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
      accessMode: 'public',
      requestTemplateJson: [],
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.match(String((body.error as { message?: string }).message), /requestTemplateJson/);
});

test('admin api-services update rejects unsupported requestMethod through bad_request envelope', async () => {
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
    method: 'PUT',
    url: `/api/admin/api-services/${primaryApiServiceId}`,
    headers: { cookie },
    body: JSON.stringify({ requestMethod: 'TRACE' }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.match(String((body.error as { message?: string }).message), /requestMethod/);
});

test('admin api-services create rejects unsupported status through bad_request envelope', async () => {
  const { runtime, cookie } = await createAdminRuntimeWithCookie();

  const request = new MockIncomingMessage({
    method: 'POST',
    url: '/api/admin/api-services',
    headers: { cookie },
    body: JSON.stringify({
      ...validAdminApiServiceCreatePayload(),
      status: 'paused',
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.match(String((body.error as { message?: string }).message), /status/);
});

test('admin api-services create rejects non-array requestMappingRulesJson through bad_request envelope', async () => {
  const { runtime, cookie } = await createAdminRuntimeWithCookie();

  const request = new MockIncomingMessage({
    method: 'POST',
    url: '/api/admin/api-services',
    headers: { cookie },
    body: JSON.stringify({
      ...validAdminApiServiceCreatePayload(),
      requestMappingRulesJson: {},
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.match(String((body.error as { message?: string }).message), /requestMappingRulesJson/);
});

test('admin api-services create rejects non-object requestHeadersTemplateJson through bad_request envelope', async () => {
  const { runtime, cookie } = await createAdminRuntimeWithCookie();

  const request = new MockIncomingMessage({
    method: 'POST',
    url: '/api/admin/api-services',
    headers: { cookie },
    body: JSON.stringify({
      ...validAdminApiServiceCreatePayload(),
      requestHeadersTemplateJson: [],
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.match(String((body.error as { message?: string }).message), /requestHeadersTemplateJson/);
});

test('admin api-services create rejects non-array responseMappingRulesJson through bad_request envelope', async () => {
  const { runtime, cookie } = await createAdminRuntimeWithCookie();

  const request = new MockIncomingMessage({
    method: 'POST',
    url: '/api/admin/api-services',
    headers: { cookie },
    body: JSON.stringify({
      ...validAdminApiServiceCreatePayload(),
      responseMappingRulesJson: {},
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.match(String((body.error as { message?: string }).message), /responseMappingRulesJson/);
});

test('admin api-services create rejects non-array errorMappingRulesJson through bad_request envelope', async () => {
  const { runtime, cookie } = await createAdminRuntimeWithCookie();

  const request = new MockIncomingMessage({
    method: 'POST',
    url: '/api/admin/api-services',
    headers: { cookie },
    body: JSON.stringify({
      ...validAdminApiServiceCreatePayload(),
      errorMappingRulesJson: {},
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.match(String((body.error as { message?: string }).message), /errorMappingRulesJson/);
});

test('admin api-services create rejects invalid tokenHeaderName through bad_request envelope', async () => {
  const { runtime, cookie } = await createAdminRuntimeWithCookie();

  const request = new MockIncomingMessage({
    method: 'POST',
    url: '/api/admin/api-services',
    headers: { cookie },
    body: JSON.stringify({
      ...validAdminApiServiceCreatePayload(),
      accessMode: 'token',
      tokenRef: 'vault://billing/token',
      tokenHeaderName: 'X Header Invalid',
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.match(String((body.error as { message?: string }).message), /tokenHeaderName/);
});

test('admin api-services create rejects timeoutMs below minimum through bad_request envelope', async () => {
  const { runtime, cookie } = await createAdminRuntimeWithCookie();

  const request = new MockIncomingMessage({
    method: 'POST',
    url: '/api/admin/api-services',
    headers: { cookie },
    body: JSON.stringify({
      ...validAdminApiServiceCreatePayload(),
      timeoutMs: 99,
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.match(String((body.error as { message?: string }).message), /timeoutMs/);
});

test('admin api-services create rejects timeoutMs above maximum through bad_request envelope', async () => {
  const { runtime, cookie } = await createAdminRuntimeWithCookie();

  const request = new MockIncomingMessage({
    method: 'POST',
    url: '/api/admin/api-services',
    headers: { cookie },
    body: JSON.stringify({
      ...validAdminApiServiceCreatePayload(),
      timeoutMs: 120001,
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.match(String((body.error as { message?: string }).message), /timeoutMs/);
});

test('admin api-services create rejects retryCount below minimum through bad_request envelope', async () => {
  const { runtime, cookie } = await createAdminRuntimeWithCookie();

  const request = new MockIncomingMessage({
    method: 'POST',
    url: '/api/admin/api-services',
    headers: { cookie },
    body: JSON.stringify({
      ...validAdminApiServiceCreatePayload(),
      retryCount: -1,
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.match(String((body.error as { message?: string }).message), /retryCount/);
});

test('admin api-services create rejects retryCount above maximum through bad_request envelope', async () => {
  const { runtime, cookie } = await createAdminRuntimeWithCookie();

  const request = new MockIncomingMessage({
    method: 'POST',
    url: '/api/admin/api-services',
    headers: { cookie },
    body: JSON.stringify({
      ...validAdminApiServiceCreatePayload(),
      retryCount: 6,
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.match(String((body.error as { message?: string }).message), /retryCount/);
});

test('admin api-services create rejects contractProfileVersion below minimum through bad_request envelope', async () => {
  const { runtime, cookie } = await createAdminRuntimeWithCookie();

  const request = new MockIncomingMessage({
    method: 'POST',
    url: '/api/admin/api-services',
    headers: { cookie },
    body: JSON.stringify({
      ...validAdminApiServiceCreatePayload(),
      contractProfileVersion: 0,
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.match(String((body.error as { message?: string }).message), /contractProfileVersion/);
});

test('admin api-service bindings upsert returns 404 when api service is missing', async () => {
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
    method: 'PUT',
    url: `/api/admin/api-services/${missingApiServiceId}/bindings`,
    headers: { cookie },
    body: JSON.stringify({
      toolKey: 'funnel-pages',
      stepKey: 'optin',
      workflowStepType: 'acquisition',
      bindingStatus: 'active',
      requiredness: 'required-by-tool-setting',
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 404);
});

test('admin api-service bindings upsert maps unique DB conflict to 409', async () => {
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

  class ConflictApiServiceDbStub extends ApiServiceDbStub {
    override async query<T = unknown>(sqlText: string, values?: unknown[]): Promise<{ rows: T[] }> {
      if (sqlText.includes('insert into "api_service_tool_step_bindings"')) {
        const conflict = new Error('duplicate key') as Error & { code?: string };
        conflict.code = '23505';
        throw conflict;
      }

      return super.query<T>(sqlText, values);
    }
  }

  const runtime = createAuthHttpRuntime({
    repositories,
    db: new ConflictApiServiceDbStub() as any,
    passwordHashing: hasher,
    sessionCookies: cookieRuntime,
    now: () => new Date('2026-05-24T12:00:00.000Z'),
    idGenerator: { nextSessionId: () => 'sess-admin-001' },
  });

  const cookie = await loginAndGetCookie(runtime, 'admin@example.com', 'Admin-Pass-1!');

  const request = new MockIncomingMessage({
    method: 'PUT',
    url: `/api/admin/api-services/${primaryApiServiceId}/bindings`,
    headers: { cookie },
    body: JSON.stringify({
      toolKey: 'funnel-pages',
      stepKey: 'optin',
      workflowStepType: 'acquisition',
      bindingStatus: 'active',
      requiredness: 'required-by-tool-setting',
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 409);
});

test('admin api-service bindings upsert succeeds with valid payload and returns deterministic binding shape', async () => {
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
    method: 'PUT',
    url: `/api/admin/api-services/${primaryApiServiceId}/bindings`,
    headers: { cookie },
    body: JSON.stringify({
      toolKey: 'funnel-pages',
      stepKey: 'optin',
      workflowStepType: 'acquisition',
      bindingStatus: 'active',
      requiredness: 'required-by-tool-setting',
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 200);
  const body = response.jsonBody();
  const binding = (((body.data ?? {}) as Record<string, unknown>).binding ?? {}) as Record<string, unknown>;
  assert.equal(typeof binding.id, 'string');
  assert.equal(binding.apiServiceId, primaryApiServiceId);
  assert.equal(binding.toolKey, 'funnel-pages');
  assert.equal(binding.stepKey, 'optin');
  assert.equal(binding.workflowStepType, 'acquisition');
  assert.equal(binding.bindingStatus, 'active');
  assert.equal(binding.requiredness, 'required-by-tool-setting');
});

test('admin api-service bindings upsert rejects missing toolKey', async () => {
  const { runtime, cookie } = await createAdminRuntimeWithCookie();

  const request = new MockIncomingMessage({
    method: 'PUT',
    url: `/api/admin/api-services/${primaryApiServiceId}/bindings`,
    headers: { cookie },
    body: JSON.stringify({
      stepKey: 'optin',
      workflowStepType: 'acquisition',
      bindingStatus: 'active',
      requiredness: 'required-by-tool-setting',
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.match(String((body.error as { message?: string }).message), /toolKey/);
  assert.equal(Array.isArray((body.error as { issues?: unknown }).issues), false);
});

test('admin api-service bindings upsert rejects missing stepKey', async () => {
  const { runtime, cookie } = await createAdminRuntimeWithCookie();

  const request = new MockIncomingMessage({
    method: 'PUT',
    url: `/api/admin/api-services/${primaryApiServiceId}/bindings`,
    headers: { cookie },
    body: JSON.stringify({
      toolKey: 'funnel-pages',
      workflowStepType: 'acquisition',
      bindingStatus: 'active',
      requiredness: 'required-by-tool-setting',
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.match(String((body.error as { message?: string }).message), /stepKey/);
  assert.equal(Array.isArray((body.error as { issues?: unknown }).issues), false);
});

test('admin api-service bindings upsert rejects unsupported workflowStepType', async () => {
  const { runtime, cookie } = await createAdminRuntimeWithCookie();

  const request = new MockIncomingMessage({
    method: 'PUT',
    url: `/api/admin/api-services/${primaryApiServiceId}/bindings`,
    headers: { cookie },
    body: JSON.stringify({
      toolKey: 'funnel-pages',
      stepKey: 'optin',
      workflowStepType: 'delivery',
      bindingStatus: 'active',
      requiredness: 'required-by-tool-setting',
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.match(String((body.error as { message?: string }).message), /workflowStepType/);
  assert.equal(Array.isArray((body.error as { issues?: unknown }).issues), false);
});

test('admin api-service bindings upsert rejects unsupported bindingStatus', async () => {
  const { runtime, cookie } = await createAdminRuntimeWithCookie();

  const request = new MockIncomingMessage({
    method: 'PUT',
    url: `/api/admin/api-services/${primaryApiServiceId}/bindings`,
    headers: { cookie },
    body: JSON.stringify({
      toolKey: 'funnel-pages',
      stepKey: 'optin',
      workflowStepType: 'acquisition',
      bindingStatus: 'disabled',
      requiredness: 'required-by-tool-setting',
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.match(String((body.error as { message?: string }).message), /bindingStatus/);
  assert.equal(Array.isArray((body.error as { issues?: unknown }).issues), false);
});

test('admin api-service bindings upsert rejects unsupported requiredness', async () => {
  const { runtime, cookie } = await createAdminRuntimeWithCookie();

  const request = new MockIncomingMessage({
    method: 'PUT',
    url: `/api/admin/api-services/${primaryApiServiceId}/bindings`,
    headers: { cookie },
    body: JSON.stringify({
      toolKey: 'funnel-pages',
      stepKey: 'optin',
      workflowStepType: 'acquisition',
      bindingStatus: 'active',
      requiredness: 'required-when-available',
    }),
  });
  const response = new MockServerResponse();

  await runtime.handleRequest(request as unknown as IncomingMessage, response as unknown as ServerResponse);
  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.match(String((body.error as { message?: string }).message), /requiredness/);
  assert.equal(Array.isArray((body.error as { issues?: unknown }).issues), false);
});
