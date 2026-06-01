import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Pool } from 'pg';

import { createAdminLlmModelHandlers } from '../runtime/auth-http/admin-llm-model-handlers';
import { parseJsonBody, writeError, writeSuccess } from '../runtime/auth-http/support';
import type { AuthSessionPrincipal } from '../types/auth';
import type { LlmModelRow } from '../types/llm-model';

class MockIncomingMessage extends EventEmitter {
  method: string;
  url: string;
  headers: Record<string, string>;

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

class LlmModelDbStub {
  private rows: LlmModelRow[] = [
    {
      id: 'model-001',
      key: 'openrouter/auto',
      label: 'OpenRouter Auto',
      status: 'enabled',
      is_default: true,
      sort_order: 1,
      created_at: new Date('2026-06-02T10:00:00.000Z'),
      updated_at: new Date('2026-06-02T10:00:00.000Z'),
    },
  ];

  async query<T = unknown>(sqlText: string, values?: unknown[]): Promise<{ rows: T[]; rowCount?: number }> {
    if (sqlText.includes('INSERT INTO llm_models')) {
      const row = {
        id: `model-${String(this.rows.length + 1).padStart(3, '0')}`,
        key: String(values?.[0] ?? ''),
        label: String(values?.[1] ?? ''),
        status: String(values?.[2] ?? 'enabled'),
        is_default: Boolean(values?.[3] ?? false),
        sort_order: values?.[4] as number | null ?? null,
        created_at: new Date('2026-06-02T10:10:00.000Z'),
        updated_at: new Date('2026-06-02T10:10:00.000Z'),
      };
      this.rows.push(row);
      return { rows: [{ ...row } as T], rowCount: 1 };
    }

    if (sqlText.includes('SELECT id, key, label, status, is_default, sort_order, created_at, updated_at FROM llm_models WHERE id = $1')) {
      const id = String(values?.[0] ?? '');
      const row = this.rows.find((item) => item.id === id);
      return { rows: row ? [{ ...row } as T] : [], rowCount: row ? 1 : 0 };
    }

    if (sqlText.includes('UPDATE llm_models SET')) {
      const id = String(values?.[values.length - 1] ?? '');
      const current = this.rows.find((item) => item.id === id);
      if (!current) {
        return { rows: [], rowCount: 0 };
      }

      const extract = (column: string): unknown => {
        const escaped = column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const match = sqlText.match(new RegExp(`${escaped} = \\$(\\d+)`));
        if (!match) {
          return undefined;
        }
        return values?.[Number(match[1]) - 1];
      };

      const updated = {
        ...current,
        ...(extract('key') !== undefined ? { key: String(extract('key')) } : {}),
        ...(extract('label') !== undefined ? { label: String(extract('label')) } : {}),
        ...(extract('status') !== undefined ? { status: String(extract('status')) } : {}),
        ...(extract('sort_order') !== undefined ? { sort_order: Number(extract('sort_order')) } : {}),
        ...(extract('is_default') !== undefined ? { is_default: Boolean(extract('is_default')) } : {}),
        updated_at: new Date('2026-06-02T10:20:00.000Z'),
      } satisfies LlmModelRow;

      this.rows = this.rows.map((item) => item.id === id ? updated : item);
      return { rows: [{ ...updated } as T], rowCount: 1 };
    }

    throw new Error(`Unhandled SQL in LlmModelDbStub: ${sqlText}`);
  }

  async connect() {
    return {
      query: this.query.bind(this),
      release() {},
    };
  }
}

const buildHandlers = () => {
  const touchedSessions: string[] = [];
  const db = new LlmModelDbStub();
  const adminPrincipal: AuthSessionPrincipal = {
    session: {
      id: 'session-admin-001',
      userId: 'admin-001',
      sessionTokenHash: 'hash',
      authMethod: 'native',
      ipAddress: null,
      userAgent: null,
      expiresAt: '2026-06-09T10:00:00.000Z',
      lastSeenAt: '2026-06-02T10:00:00.000Z',
      revokedAt: null,
      createdAt: '2026-06-02T10:00:00.000Z',
    },
    user: {
      id: 'admin-001',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
    },
  };

  const handlers = createAdminLlmModelHandlers({
    repositories: {
      sessions: {
        async touchSession(sessionId: string) {
          touchedSessions.push(sessionId);
        },
      },
    } as never,
    now: () => new Date('2026-06-02T10:00:00.000Z'),
    requireAdminPrincipal: async () => adminPrincipal,
    requireDb: () => db as unknown as Pool,
    parseJsonBody,
    writeError,
    writeSuccess,
  });

  return { handlers, touchedSessions };
};

test('admin llm-model handlers create accepts valid payload through Zod boundary', async () => {
  const { handlers, touchedSessions } = buildHandlers();
  const response = new MockServerResponse();

  await handlers.handleAdminModelsCreate(
    new MockIncomingMessage({
      method: 'POST',
      url: '/api/admin/models',
      body: JSON.stringify({
        key: ' openrouter/gpt-4.1-mini ',
        label: ' GPT 4.1 Mini ',
        status: 'disabled',
        isDefault: true,
        sortOrder: 9,
      }),
    }) as unknown as IncomingMessage,
    response as unknown as ServerResponse,
  );

  assert.equal(response.statusCode, 201);
  const body = response.jsonBody();
  const model = (body.data as { model: { key: string; label: string; status: string; isDefault: boolean; sortOrder: number } }).model;
  assert.equal(model.key, 'openrouter/gpt-4.1-mini');
  assert.equal(model.label, 'GPT 4.1 Mini');
  assert.equal(model.status, 'disabled');
  assert.equal(model.isDefault, true);
  assert.equal(model.sortOrder, 9);
  assert.deepEqual(touchedSessions, ['session-admin-001']);
});

test('admin llm-model handlers create rejects invalid status through bad_request envelope', async () => {
  const { handlers } = buildHandlers();
  const response = new MockServerResponse();

  await handlers.handleAdminModelsCreate(
    new MockIncomingMessage({
      method: 'POST',
      url: '/api/admin/models',
      body: JSON.stringify({
        key: 'openrouter/auto',
        label: 'OpenRouter Auto',
        status: 'archived',
      }),
    }) as unknown as IncomingMessage,
    response as unknown as ServerResponse,
  );

  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.equal((body.error as { message?: string }).message, 'status: status must be enabled or disabled');
});

test('admin llm-model handlers create rejects invalid key through bad_request envelope', async () => {
  const { handlers } = buildHandlers();
  const response = new MockServerResponse();

  await handlers.handleAdminModelsCreate(
    new MockIncomingMessage({
      method: 'POST',
      url: '/api/admin/models',
      body: JSON.stringify({
        key: 'invalid key with spaces',
        label: 'OpenRouter Auto',
      }),
    }) as unknown as IncomingMessage,
    response as unknown as ServerResponse,
  );

  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.equal((body.error as { message?: string }).message, 'key: key must be 1-128 chars matching [a-zA-Z0-9/_-.]');
});

test('admin llm-model handlers create rejects blank label through bad_request envelope', async () => {
  const { handlers } = buildHandlers();
  const response = new MockServerResponse();

  await handlers.handleAdminModelsCreate(
    new MockIncomingMessage({
      method: 'POST',
      url: '/api/admin/models',
      body: JSON.stringify({
        key: 'openrouter/auto',
        label: '   ',
      }),
    }) as unknown as IncomingMessage,
    response as unknown as ServerResponse,
  );

  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.equal((body.error as { message?: string }).message, 'label: label must be 1-256 chars');
});

test('admin llm-model handlers create rejects malformed JSON body', async () => {
  const { handlers } = buildHandlers();
  const response = new MockServerResponse();

  await handlers.handleAdminModelsCreate(
    new MockIncomingMessage({
      method: 'POST',
      url: '/api/admin/models',
      body: '{',
    }) as unknown as IncomingMessage,
    response as unknown as ServerResponse,
  );

  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.equal((body.error as { message?: string }).message, 'Invalid JSON body');
});

test('admin llm-model handlers update accepts valid payload through Zod boundary', async () => {
  const { handlers, touchedSessions } = buildHandlers();
  const response = new MockServerResponse();

  await handlers.handleAdminModelsUpdate(
    new MockIncomingMessage({
      method: 'PUT',
      url: '/api/admin/models/model-001',
      body: JSON.stringify({
        key: ' openrouter/gpt-4.1 ',
        label: ' GPT 4.1 ',
        status: 'disabled',
        isDefault: false,
        sortOrder: 5,
      }),
    }) as unknown as IncomingMessage,
    response as unknown as ServerResponse,
    'model-001',
  );

  assert.equal(response.statusCode, 200);
  const body = response.jsonBody();
  const model = (body.data as { model: { key: string; label: string; status: string; isDefault: boolean; sortOrder: number | null } }).model;
  assert.equal(model.key, 'openrouter/gpt-4.1');
  assert.equal(model.label, 'GPT 4.1');
  assert.equal(model.status, 'disabled');
  assert.equal(model.isDefault, false);
  assert.equal(model.sortOrder, 5);
  assert.deepEqual(touchedSessions, ['session-admin-001']);
});

test('admin llm-model handlers update rejects invalid key through bad_request envelope', async () => {
  const { handlers } = buildHandlers();
  const response = new MockServerResponse();

  await handlers.handleAdminModelsUpdate(
    new MockIncomingMessage({
      method: 'PUT',
      url: '/api/admin/models/model-001',
      body: JSON.stringify({
        key: 'invalid key with spaces',
      }),
    }) as unknown as IncomingMessage,
    response as unknown as ServerResponse,
    'model-001',
  );

  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.equal((body.error as { message?: string }).message, 'key: key must be 1-128 chars matching [a-zA-Z0-9/_-.]');
});

test('admin llm-model handlers update rejects blank label through bad_request envelope', async () => {
  const { handlers } = buildHandlers();
  const response = new MockServerResponse();

  await handlers.handleAdminModelsUpdate(
    new MockIncomingMessage({
      method: 'PUT',
      url: '/api/admin/models/model-001',
      body: JSON.stringify({
        label: '   ',
      }),
    }) as unknown as IncomingMessage,
    response as unknown as ServerResponse,
    'model-001',
  );

  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.equal((body.error as { message?: string }).message, 'label: label must be 1-256 chars');
});

test('admin llm-model handlers update rejects invalid status through bad_request envelope', async () => {
  const { handlers } = buildHandlers();
  const response = new MockServerResponse();

  await handlers.handleAdminModelsUpdate(
    new MockIncomingMessage({
      method: 'PUT',
      url: '/api/admin/models/model-001',
      body: JSON.stringify({
        status: 'archived',
      }),
    }) as unknown as IncomingMessage,
    response as unknown as ServerResponse,
    'model-001',
  );

  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.equal((body.error as { message?: string }).message, 'status: status must be enabled or disabled');
});

test('admin llm-model handlers update rejects non-boolean isDefault through bad_request envelope', async () => {
  const { handlers } = buildHandlers();
  const response = new MockServerResponse();

  await handlers.handleAdminModelsUpdate(
    new MockIncomingMessage({
      method: 'PUT',
      url: '/api/admin/models/model-001',
      body: JSON.stringify({
        isDefault: 'yes',
      }),
    }) as unknown as IncomingMessage,
    response as unknown as ServerResponse,
    'model-001',
  );

  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.equal((body.error as { message?: string }).message, 'isDefault: isDefault must be a boolean');
});

test('admin llm-model handlers update rejects non-number sortOrder through bad_request envelope', async () => {
  const { handlers } = buildHandlers();
  const response = new MockServerResponse();

  await handlers.handleAdminModelsUpdate(
    new MockIncomingMessage({
      method: 'PUT',
      url: '/api/admin/models/model-001',
      body: JSON.stringify({
        sortOrder: '5',
      }),
    }) as unknown as IncomingMessage,
    response as unknown as ServerResponse,
    'model-001',
  );

  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.equal((body.error as { message?: string }).message, 'sortOrder: sortOrder must be a number');
});

test('admin llm-model handlers update rejects malformed JSON body', async () => {
  const { handlers } = buildHandlers();
  const response = new MockServerResponse();

  await handlers.handleAdminModelsUpdate(
    new MockIncomingMessage({
      method: 'PUT',
      url: '/api/admin/models/model-001',
      body: '{',
    }) as unknown as IncomingMessage,
    response as unknown as ServerResponse,
    'model-001',
  );

  assert.equal(response.statusCode, 400);
  const body = response.jsonBody();
  assert.equal((body.error as { code?: string }).code, 'bad_request');
  assert.equal((body.error as { message?: string }).message, 'Invalid JSON body');
});