import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { IncomingMessage } from 'node:http';
import type { Pool } from 'pg';

import { createAdminGeometricHandlers } from '../runtime/auth-http/admin-geometric-handlers';
import { writeError, writeSuccess } from '../runtime/auth-http/support';
import { LocalScreenshotStorage } from '../runtime/integrations/screenshot-storage';

class MockResponse extends PassThrough {
  statusCode = 0;
  headers: Record<string, string> = {};
  setHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  writeHead(code: number, _hdrs?: Record<string, string>) {
    this.statusCode = code;
  }
}

const adminPrincipal: any = {
  user: { id: 'admin-001', email: 'admin@test.com', role: 'admin' },
  session: { id: 'sess-001' },
};

const createMockPool = () => {
  let rows: Array<{
    id: string;
    session_id: string;
    request_id: string;
    query: string;
    is_paa: boolean;
    stored_path: string;
    file_size_bytes: number | null;
    ai_overview_confidence: number | null;
    selector_used: string | null;
    created_at: Date;
    expires_at: Date;
  }> = [];

  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM geometric_screenshot_metadata') && sql.includes('WHERE session_id')) {
        return {
          rows: rows.filter((r) => r.session_id === params?.[0]),
          rowCount: 0,
        };
      }
      if (sql.includes('FROM geometric_screenshot_metadata') && sql.includes('WHERE id =')) {
        return {
          rows: rows.filter((r) => r.id === params?.[0]),
          rowCount: 0,
        };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Pool;

  return {
    pool,
    setRows: (newRows: typeof rows) => {
      rows = newRows;
    },
  };
};

const collectResponse = async (res: MockResponse): Promise<{ statusCode: number; headers: Record<string, string>; body: any }> => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));

  await new Promise<void>((resolve) => {
    if (res.readableEnded) {
      resolve();
      return;
    }
    res.on('end', resolve);
  });

  const body = Buffer.concat(chunks).toString();
  try {
    return { statusCode: res.statusCode, headers: res.headers, body: JSON.parse(body) };
  } catch {
    return { statusCode: res.statusCode, headers: res.headers, body };
  }
};

test('handleAdminListSessionScreenshots returns 200 with screenshots for known session', async () => {
  const { pool, setRows } = createMockPool();
  setRows([
    {
      id: 'ss-001',
      session_id: 'session-001',
      request_id: 'req-001',
      query: 'test query',
      is_paa: false,
      stored_path: 'session-001/ss-001.png',
      file_size_bytes: 12345,
      ai_overview_confidence: 0.95,
      selector_used: '[data-snf]',
      created_at: new Date(),
      expires_at: new Date(),
    },
  ]);

  const handlers = createAdminGeometricHandlers({
    requireAdminPrincipal: async () => adminPrincipal,
    requireDb: () => pool,
    writeError,
    writeSuccess,
    screenshotStorage: null,
  });

  const res = new MockResponse();
  await handlers.handleAdminListSessionScreenshots(
    { method: 'GET', url: '/api/admin/geometric/sessions/session-001/screenshots' } as IncomingMessage,
    res as unknown as import('node:http').ServerResponse,
    'session-001',
  );

  const { statusCode, body } = await collectResponse(res);
  assert.equal(statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.screenshots.length, 1);
  assert.equal(body.data.screenshots[0].id, 'ss-001');
});

test('handleAdminListSessionScreenshots returns empty list for session with no screenshots', async () => {
  const { pool, setRows } = createMockPool();
  setRows([]);

  const handlers = createAdminGeometricHandlers({
    requireAdminPrincipal: async () => adminPrincipal,
    requireDb: () => pool,
    writeError,
    writeSuccess,
    screenshotStorage: null,
  });

  const res = new MockResponse();
  await handlers.handleAdminListSessionScreenshots(
    { method: 'GET', url: '/api/admin/geometric/sessions/unknown/screenshots' } as IncomingMessage,
    res as unknown as import('node:http').ServerResponse,
    'unknown',
  );

  const { statusCode, body } = await collectResponse(res);
  assert.equal(statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.screenshots.length, 0);
});

test('handleAdminListSessionScreenshots returns 403 for non-admin user', async () => {
  const { pool } = createMockPool();

  const handlers = createAdminGeometricHandlers({
    requireAdminPrincipal: async (_req, res) => {
      writeError(res, 403, 'forbidden', 'Admin scope required');
      return null;
    },
    requireDb: () => pool,
    writeError,
    writeSuccess,
    screenshotStorage: null,
  });

  const res = new MockResponse();
  await handlers.handleAdminListSessionScreenshots(
    { method: 'GET', url: '/api/admin/geometric/sessions/session-001/screenshots' } as IncomingMessage,
    res as unknown as import('node:http').ServerResponse,
    'session-001',
  );

  const { statusCode, body } = await collectResponse(res);
  assert.equal(statusCode, 403);
  assert.equal(body.ok, false);
});

test('handleAdminGetScreenshot returns 404 for unknown screenshotId', async () => {
  const { pool, setRows } = createMockPool();
  setRows([]);

  const handlers = createAdminGeometricHandlers({
    requireAdminPrincipal: async () => adminPrincipal,
    requireDb: () => pool,
    writeError,
    writeSuccess,
    screenshotStorage: null,
  });

  const res = new MockResponse();
  await handlers.handleAdminGetScreenshot(
    { method: 'GET', url: '/api/admin/geometric/screenshots/00000000-0000-0000-0000-000000000000' } as IncomingMessage,
    res as unknown as import('node:http').ServerResponse,
    '00000000-0000-0000-0000-000000000000',
  );

  const { statusCode, body } = await collectResponse(res);
  assert.equal(statusCode, 404);
  assert.equal(body.ok, false);
});

test('handleAdminGetScreenshot returns 400 for invalid screenshotId format', async () => {
  const { pool } = createMockPool();

  const handlers = createAdminGeometricHandlers({
    requireAdminPrincipal: async () => adminPrincipal,
    requireDb: () => pool,
    writeError,
    writeSuccess,
    screenshotStorage: null,
  });

  const res = new MockResponse();
  await handlers.handleAdminGetScreenshot(
    { method: 'GET', url: '/api/admin/geometric/screenshots/invalid-id' } as IncomingMessage,
    res as unknown as import('node:http').ServerResponse,
    'invalid-id',
  );

  const { statusCode, body } = await collectResponse(res);
  assert.equal(statusCode, 400);
  assert.equal(body.ok, false);
});

test('handleAdminGetScreenshot serves PNG file for known screenshot', async () => {
  const tmpDir = '/tmp/test-geometric-admin-handlers';
  await mkdir(tmpDir, { recursive: true });
  const storage = new LocalScreenshotStorage(tmpDir);

  const { pool, setRows } = createMockPool();
    setRows([
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      session_id: 'session-001',
      request_id: 'req-001',
      query: 'test',
      is_paa: false,
      stored_path: 'screenshot-001.png',
      file_size_bytes: 9,
      ai_overview_confidence: 0.95,
      selector_used: '[data-snf]',
      created_at: new Date(),
      expires_at: new Date(),
    },
  ]);
  await writeFile(join(tmpDir, 'screenshot-001.png'), 'fake-png');

  const handlers = createAdminGeometricHandlers({
    requireAdminPrincipal: async () => adminPrincipal,
    requireDb: () => pool,
    writeError,
    writeSuccess,
    screenshotStorage: storage,
  });

  const res = new MockResponse();
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));

  await handlers.handleAdminGetScreenshot(
    { method: 'GET', url: '/api/admin/geometric/screenshots/550e8400-e29b-41d4-a716-446655440000' } as IncomingMessage,
    res as unknown as import('node:http').ServerResponse,
    '550e8400-e29b-41d4-a716-446655440000',
  );

  await new Promise<void>((resolve) => {
    if (res.readableEnded) {
      resolve();
      return;
    }
    res.on('end', resolve);
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'image/png');
  assert.equal(res.headers['Content-Length'], '8');
  assert.equal(Buffer.concat(chunks).toString(), 'fake-png');
});
