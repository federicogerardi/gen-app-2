import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createOpenRouterLlmStreamAdapter } from '../adapters/openrouter.adapter';

const makeSseDoneResponse = (): Response => {
  return new Response('data: [DONE]\n\n', {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
    },
  });
};

test('openrouter adapter normalizes legacy colon model ids', async () => {
  let capturedModel: string | null = null;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { model?: string };
    capturedModel = body.model ?? null;
    return makeSseDoneResponse();
  }) as typeof fetch;

  try {
    const adapter = createOpenRouterLlmStreamAdapter({
      apiKey: 'test-key',
      baseUrl: 'https://example.test',
    });

    const events = [] as Array<{ type: string }>;
    for await (const event of adapter.streamText({
      requestId: 'req-openrouter-normalize-001',
      model: 'openrouter:auto',
      outputFormat: 'json',
      requestInput: { prompt: 'Hello' },
    })) {
      events.push({ type: event.type });
    }

    assert.equal(capturedModel, 'openrouter/auto');
    assert.deepEqual(events, [{ type: 'completed' }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('openrouter adapter preserves provider/model format', async () => {
  let capturedModel: string | null = null;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { model?: string };
    capturedModel = body.model ?? null;
    return makeSseDoneResponse();
  }) as typeof fetch;

  try {
    const adapter = createOpenRouterLlmStreamAdapter({
      apiKey: 'test-key',
      baseUrl: 'https://example.test',
    });

    for await (const _event of adapter.streamText({
      requestId: 'req-openrouter-normalize-002',
      model: 'openai/gpt-5.4-mini',
      outputFormat: 'json',
      requestInput: { prompt: 'Hello' },
    })) {
      // Consume stream
    }

    assert.equal(capturedModel, 'openai/gpt-5.4-mini');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('openrouter adapter injects briefing context into messages when available', async () => {
  let capturedMessages: unknown[] | null = null;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { messages?: unknown[] };
    capturedMessages = body.messages ?? null;
    return makeSseDoneResponse();
  }) as typeof fetch;

  try {
    const adapter = createOpenRouterLlmStreamAdapter({
      apiKey: 'test-key',
      baseUrl: 'https://example.test',
    });

    for await (const _event of adapter.streamText({
      requestId: 'req-openrouter-brief-context-001',
      model: 'openrouter/auto',
      outputFormat: 'json',
      requestInput: {
        prompt: 'Processa il brief',
        briefingText: 'Prodotto SaaS B2B per PMI. Obiettivo prenotazione demo.',
        extractionPayload: {
          fields: {
            target: 'PMI',
            goal: 'demo',
          },
        },
        stepDependencyArtifactContentsByStep: {
          optin: 'Output step optin: headline e CTA.',
          quiz: 'Output step quiz: 5 domande qualificanti.',
        },
      },
    })) {
      // Consume stream
    }

    assert.ok(Array.isArray(capturedMessages));
    const first = (capturedMessages?.[0] ?? null) as { content?: unknown } | null;
    assert.equal(typeof first?.content, 'string');
    const content = String(first?.content ?? '');
    assert.match(content, /Briefing Source/);
    assert.match(content, /Prodotto SaaS B2B per PMI/);
    assert.match(content, /Extraction Payload/);
    assert.match(content, /"target": "PMI"/);
    assert.match(content, /Previous Step Outputs/);
    assert.match(content, /Output step optin: headline e CTA/);
    assert.match(content, /Output step quiz: 5 domande qualificanti/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
