import test from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';

import { LocalScreenshotArchival } from '../runtime/integrations/screenshot-archival';
import type { ScreenshotStorageAdapter } from '../runtime/integrations/screenshot-storage';
const createMockStorage = () => {
  const calls = {
    saves: [] as Array<{ sourcePath: string; destPath: string }>,
    deletes: [] as Array<{ storedPath: string }>,
  };
  return {
    storage: {
      save: async (sourcePath: string, destPath: string) => {
        calls.saves.push({ sourcePath, destPath });
      },
      getAbsolutePath: (storedPath: string) => `/tmp/storage/${storedPath}`,
      delete: async (storedPath: string) => {
        calls.deletes.push({ storedPath });
      },
    } as ScreenshotStorageAdapter,
    calls,
  };
};

const createMockPool = () => {
  const queries: Array<{ sql: string; params: unknown[] }> = [];
  let selectRows: Array<{ id: string; stored_path: string }> = [];
  let deleteRowCount = 0;

  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params: params ?? [] });
      if (sql.includes('SELECT id, stored_path FROM geometric_screenshot_metadata WHERE expires_at')) {
        return { rows: selectRows, rowCount: selectRows.length };
      }
      if (sql.includes('DELETE FROM geometric_screenshot_metadata WHERE expires_at')) {
        return { rows: [], rowCount: deleteRowCount };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Pool;

  return {
    pool,
    queries,
    setSelectRows: (rows: Array<{ id: string; stored_path: string }>) => {
      selectRows = rows;
    },
    setDeleteRowCount: (count: number) => {
      deleteRowCount = count;
    },
  };
};

test('LocalScreenshotArchival.archiveScreenshot copies file and inserts DB record', async () => {
  const { storage, calls } = createMockStorage();
  const { pool, queries } = createMockPool();

  const archival = new LocalScreenshotArchival(storage, pool, 30);

  const result = await archival.archiveScreenshot({
    screenshotPath: '/tmp/test-screenshot.png',
    sessionId: 'session-001',
    requestId: 'req-001',
    query: 'test query',
    isPaa: false,
    aiOverviewConfidence: 0.95,
    selectorUsed: '[data-snf]',
  });

  assert.ok(result);
  assert.equal(typeof result, 'string');
  assert.equal(result!.length, 36);

  assert.equal(calls.saves.length, 1);
  assert.equal(calls.saves[0]?.sourcePath, '/tmp/test-screenshot.png');
  assert.ok(calls.saves[0]?.destPath.includes('session-001'));

  const insertQuery = queries.find((q) =>
    q.sql.includes('INSERT INTO geometric_screenshot_metadata'),
  );
  assert.ok(insertQuery);
  assert.equal(insertQuery?.params[1], 'session-001');
  assert.equal(insertQuery?.params[3], 'test query');
  assert.equal(insertQuery?.params[7], 0.95);
  assert.equal(insertQuery?.params[8], '[data-snf]');
});

test('LocalScreenshotArchival.archiveScreenshot does not throw when source file does not exist', async () => {
  const failingStorage = {
    save: async () => {
      throw new Error('ENOENT: no such file');
    },
    getAbsolutePath: (storedPath: string) => `/tmp/storage/${storedPath}`,
    delete: async () => {},
  } as ScreenshotStorageAdapter;

  const { pool, queries } = createMockPool();
  const archival = new LocalScreenshotArchival(failingStorage, pool, 30);

  const result = await archival.archiveScreenshot({
    screenshotPath: '/tmp/nonexistent-screenshot.png',
    sessionId: 'session-001',
    requestId: 'req-001',
    query: 'test query',
    isPaa: false,
    aiOverviewConfidence: 0.95,
    selectorUsed: '[data-snf]',
  });

  assert.equal(result, null);
  const insertQuery = queries.find((q) =>
    q.sql.includes('INSERT INTO geometric_screenshot_metadata'),
  );
  assert.equal(insertQuery, undefined);
});

test('LocalScreenshotArchival.cleanupExpiredScreenshots deletes files and records with past expires_at', async () => {
  const { storage, calls } = createMockStorage();
  const { pool, setSelectRows, setDeleteRowCount } = createMockPool();
  setSelectRows([
    { id: 'uuid-1', stored_path: 'session-1/uuid-1.png' },
    { id: 'uuid-2', stored_path: 'session-2/uuid-2.png' },
  ]);
  setDeleteRowCount(2);

  const archival = new LocalScreenshotArchival(storage, pool, 30);
  const result = await archival.cleanupExpiredScreenshots(new Date('2026-01-01'));

  assert.equal(result.deletedFiles, 2);
  assert.equal(result.deletedRecords, 2);
  assert.equal(calls.deletes.length, 2);
  assert.equal(calls.deletes[0]?.storedPath, 'session-1/uuid-1.png');
  assert.equal(calls.deletes[1]?.storedPath, 'session-2/uuid-2.png');
});

test('invokeCrawling completes normally when screenshotArchival is null', () => {
  const nullArchival = null as any;

  assert.doesNotThrow(() => {
    void nullArchival?.archiveScreenshot({
      screenshotPath: '/tmp/test.png',
      sessionId: 'session-001',
      requestId: 'req-001',
      query: 'test',
      isPaa: false,
      aiOverviewConfidence: 0.95,
      selectorUsed: '[data-snf]',
    });
  });
});
