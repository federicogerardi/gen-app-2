import test from 'node:test';
import assert from 'node:assert/strict';

import { executeApiAcquisition } from '../runtime/integrations/api-acquisition.adapter';

const buildService = () => ({
  id: 'svc_1',
  key: 'github-issues',
  label: 'GitHub Issues',
  baseUrl: 'https://api.github.com',
  resourcePath: '/repos/acme/repo/issues',
  accessMode: 'public' as const,
  timeoutMs: 3000,
  retryCount: 0,
  requestMethod: 'GET' as const,
  requestTemplateJson: {},
  requestMappingRulesJson: [],
  requestHeadersTemplateJson: {},
  tokenHeaderName: null,
  responseMappingRulesJson: [],
  errorMappingRulesJson: [],
  contractProfileVersion: 1,
  tokenRef: null,
  tokenCiphertext: null,
  status: 'active' as const,
  createdAt: new Date('2026-05-24T08:00:00.000Z'),
  updatedAt: new Date('2026-05-24T08:00:00.000Z'),
});

test('executeApiAcquisition builds GET call and normalizes json payload', async () => {
  const originalFetch = global.fetch;

  global.fetch = (async () => {
    return {
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({ ok: true, source: 'api' }),
      text: async () => '',
    } as unknown as Response;
  }) as typeof fetch;

  try {
    const result = await executeApiAcquisition({
      service: buildService(),
    });

    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.payload, { ok: true, source: 'api' });
  } finally {
    global.fetch = originalFetch;
  }
});

test('executeApiAcquisition injects Authorization bearer by default for token mode', async () => {
  const originalFetch = global.fetch;
  const observed: { headers: Record<string, string> | undefined } = {
    headers: undefined,
  };

  global.fetch = (async (_, init) => {
    observed.headers = init?.headers as Record<string, string>;

    return {
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({ ok: true }),
      text: async () => '',
    } as unknown as Response;
  }) as typeof fetch;

  try {
    const service = {
      ...buildService(),
      accessMode: 'token' as const,
      tokenCiphertext: 'secret-token',
      tokenHeaderName: null,
    };

    await executeApiAcquisition({ service });

    assert.equal(observed.headers?.Authorization, 'Bearer secret-token');
  } finally {
    global.fetch = originalFetch;
  }
});

test('executeApiAcquisition injects custom token header and overrides template collisions', async () => {
  const originalFetch = global.fetch;
  const observed: { headers: Record<string, string> | undefined } = {
    headers: undefined,
  };

  global.fetch = (async (_, init) => {
    observed.headers = init?.headers as Record<string, string>;

    return {
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({ ok: true }),
      text: async () => '',
    } as unknown as Response;
  }) as typeof fetch;

  try {
    const service = {
      ...buildService(),
      accessMode: 'token' as const,
      tokenCiphertext: 'override-token',
      tokenHeaderName: 'X-API-Key',
      requestHeadersTemplateJson: {
        'x-api-key': 'template-value',
        'x-correlation-id': 'corr-1',
      },
    };

    await executeApiAcquisition({ service });

    assert.equal(observed.headers?.['X-API-Key'], 'override-token');
    assert.equal(observed.headers?.['x-api-key'], undefined);
    assert.equal(observed.headers?.['x-correlation-id'], 'corr-1');
    assert.equal(observed.headers?.Authorization, undefined);
  } finally {
    global.fetch = originalFetch;
  }
});

test('executeApiAcquisition assembles profile-driven request and maps response payload', async () => {
  const originalFetch = global.fetch;
  const observed: {
    url: string | null;
    method: string | undefined;
    headers: Record<string, string> | undefined;
    body: Record<string, unknown> | undefined;
  } = {
    url: null,
    method: undefined,
    headers: undefined,
    body: undefined,
  };

  global.fetch = (async (url, init) => {
    observed.url = String(url);
    observed.method = init?.method;
    observed.headers = init?.headers as Record<string, string>;
    observed.body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;

    return {
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({
        data: { items: ['issue-1', 'issue-2'] },
        meta: { total: 2 },
      }),
      text: async () => '',
    } as unknown as Response;
  }) as typeof fetch;

  try {
    const service = {
      ...buildService(),
      requestMethod: 'POST' as const,
      requestTemplateJson: {
        query: { lang: 'en' },
        body: { staticFlag: true },
      },
      requestMappingRulesJson: [
        {
          sourcePath: 'query.search',
          targetPath: 'query.q',
          required: true,
        },
        {
          sourcePath: 'body.prompt',
          targetPath: 'body.prompt',
          required: true,
        },
      ],
      requestHeadersTemplateJson: {
        'x-api-profile': 'contract-v1',
      },
      responseMappingRulesJson: [
        {
          sourcePath: 'data.items',
          targetPath: 'items',
          required: true,
        },
        {
          sourcePath: 'meta.total',
          targetPath: 'total',
          required: true,
        },
      ],
    };

    const result = await executeApiAcquisition({
      service,
      query: { search: 'copilot' },
      body: { prompt: 'find issues' },
    });

    assert.equal(result.statusCode, 200);
    assert.equal(observed.method, 'POST');
    assert.equal(observed.url, 'https://api.github.com/repos/acme/repo/issues?lang=en&q=copilot');
    assert.equal(observed.headers?.['x-api-profile'], 'contract-v1');
    assert.deepEqual(observed.body, {
      staticFlag: true,
      prompt: 'find issues',
    });
    assert.deepEqual(result.payload, {
      items: ['issue-1', 'issue-2'],
      total: 2,
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('executeApiAcquisition projects deterministic mapped error on upstream failure', async () => {
  const originalFetch = global.fetch;

  global.fetch = (async () => {
    return {
      ok: false,
      status: 404,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({
        error: {
          message: 'resource missing',
        },
      }),
      text: async () => '',
    } as unknown as Response;
  }) as typeof fetch;

  try {
    const service = {
      ...buildService(),
      errorMappingRulesJson: [
        {
          statusCode: 404,
          sourcePath: 'error.message',
          errorCode: 'api_not_found',
          message: 'Upstream resource not found',
        },
      ],
    };

    await assert.rejects(
      () => executeApiAcquisition({ service }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Acquisition HTTP 404/);
        assert.match(error.message, /api_not_found/);
        assert.match(error.message, /Upstream resource not found/);
        return true;
      },
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('executeApiAcquisition retries on transient transport failure and succeeds within retry budget', async () => {
  const originalFetch = global.fetch;
  let attempts = 0;

  global.fetch = (async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error('temporary upstream network error');
    }

    return {
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
      json: async () => ({ ok: true, attempt: attempts }),
      text: async () => '',
    } as unknown as Response;
  }) as typeof fetch;

  try {
    const result = await executeApiAcquisition({
      service: {
        ...buildService(),
        retryCount: 1,
      },
    });

    assert.equal(attempts, 2);
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.payload, { ok: true, attempt: 2 });
  } finally {
    global.fetch = originalFetch;
  }
});

test('executeApiAcquisition fails deterministically on timeout with bounded attempts', async () => {
  const originalFetch = global.fetch;
  let attempts = 0;

  global.fetch = ((_, init) => {
    attempts += 1;

    return new Promise<Response>((_, reject) => {
      const signal = init?.signal as AbortSignal | undefined;
      if (!signal) {
        reject(new Error('missing abort signal'));
        return;
      }

      if (signal.aborted) {
        const aborted = new Error('aborted');
        aborted.name = 'AbortError';
        reject(aborted);
        return;
      }

      signal.addEventListener(
        'abort',
        () => {
          const aborted = new Error('aborted');
          aborted.name = 'AbortError';
          reject(aborted);
        },
        { once: true },
      );
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => executeApiAcquisition({
        service: {
          ...buildService(),
          timeoutMs: 5,
          retryCount: 1,
        },
      }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Api acquisition failed after 2 attempts/);
        assert.match(error.message, /AbortError|aborted/);
        return true;
      },
    );

    assert.equal(attempts, 2);
  } finally {
    global.fetch = originalFetch;
  }
});
