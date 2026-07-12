import test from 'node:test';
import assert from 'node:assert/strict';

import {
  logGeometricInfo,
  logGeometricWarn,
  logGeometricError,
  logGeometricDebug,
  type GeometricLogMeta,
} from '../runtime/integrations/geometric-logger';

test('geometric logger produces correct prefix and includes requestId', () => {
  const logs: Array<{ level: string; message: string; meta: GeometricLogMeta }> = [];

  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalDebug = console.debug;

  console.info = (message: string, meta: GeometricLogMeta) => {
    logs.push({ level: 'info', message, meta });
  };
  console.warn = (message: string, meta: GeometricLogMeta) => {
    logs.push({ level: 'warn', message, meta });
  };
  console.error = (message: string, meta: GeometricLogMeta) => {
    logs.push({ level: 'error', message, meta });
  };
  console.debug = (message: string, meta: GeometricLogMeta) => {
    logs.push({ level: 'debug', message, meta });
  };

  try {
    logGeometricInfo('crawling.start', {
      requestId: 'req-test-001',
      operation: 'invokeCrawling',
      baseQuery: 'protein supplements',
    });

    logGeometricWarn('crawling.paa.single_failed', {
      requestId: 'req-test-001',
      operation: 'invokeCrawling',
      paaQuery: 'best protein powder',
    });

    logGeometricError('scoring.failed', {
      requestId: 'req-test-001',
      operation: 'invokeScoring',
      error: 'no sources',
    });

    logGeometricDebug('assembly.select', {
      requestId: 'req-test-001',
      operation: 'selectGeometricAssembly',
      stepKey: 'strategic-reporting',
    });

    assert.equal(logs.length, 4);

    // Verify prefix
    assert.ok(logs[0]!.message.startsWith('[geometric]'));
    assert.ok(logs[1]!.message.startsWith('[geometric]'));
    assert.ok(logs[2]!.message.startsWith('[geometric]'));
    assert.ok(logs[3]!.message.startsWith('[geometric]'));

    // Verify requestId present
    assert.equal(logs[0]!.meta.requestId, 'req-test-001');
    assert.equal(logs[1]!.meta.requestId, 'req-test-001');
    assert.equal(logs[2]!.meta.requestId, 'req-test-001');
    assert.equal(logs[3]!.meta.requestId, 'req-test-001');

    // Verify levels
    assert.equal(logs[0]!.level, 'info');
    assert.equal(logs[1]!.level, 'warn');
    assert.equal(logs[2]!.level, 'error');
    assert.equal(logs[3]!.level, 'debug');
  } finally {
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
    console.debug = originalDebug;
  }
});

test('geometric logger sanitizes binary and html data from meta', () => {
  const logs: Array<{ message: string; meta: GeometricLogMeta }> = [];
  const originalInfo = console.info;

  console.info = (message: string, meta: GeometricLogMeta) => {
    logs.push({ message, meta });
  };

  try {
    logGeometricInfo('crawling.completed', {
      requestId: 'req-test-002',
      operation: 'invokeCrawling',
      sourceCount: 3,
      htmlContent: '<html><body>...</body></html>',
      rawBuffer: Buffer.from('raw data'),
    });

    assert.equal(logs.length, 1);
    const meta = logs[0]?.meta;
    assert.ok(meta);

    // Verify binary and html data are stripped
    assert.equal('htmlContent' in meta, false);
    assert.equal('rawBuffer' in meta, false);

    // Verify safe data is preserved
    assert.equal(meta.sourceCount, 3);
    assert.equal(meta.requestId, 'req-test-002');
  } finally {
    console.info = originalInfo;
  }
});

test('geometric logger truncates long query strings', () => {
  const logs: Array<{ message: string; meta: GeometricLogMeta }> = [];
  const originalInfo = console.info;

  console.info = (message: string, meta: GeometricLogMeta) => {
    logs.push({ message, meta });
  };

  try {
    const longQuery = 'a'.repeat(200);
    logGeometricInfo('crawling.start', {
      requestId: 'req-test-003',
      operation: 'invokeCrawling',
      baseQuery: longQuery,
    });

    assert.equal(logs.length, 1);
    const loggedQuery = logs[0]?.meta?.baseQuery as string | undefined;
    assert.ok(loggedQuery);
    assert.equal(loggedQuery.length, 81); // 80 + ellipsis
    assert.ok(loggedQuery.endsWith('…'));
  } finally {
    console.info = originalInfo;
  }
});

test('geometric logger keeps short query strings intact', () => {
  const logs: Array<{ message: string; meta: GeometricLogMeta }> = [];
  const originalInfo = console.info;

  console.info = (message: string, meta: GeometricLogMeta) => {
    logs.push({ message, meta });
  };

  try {
    logGeometricInfo('crawling.start', {
      requestId: 'req-test-004',
      operation: 'invokeCrawling',
      baseQuery: 'protein',
    });

    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.meta?.baseQuery, 'protein');
  } finally {
    console.info = originalInfo;
  }
});
