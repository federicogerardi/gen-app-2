import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';

import { createInMemoryGenerationAdapters } from '../adapters';
import {
  applySseHeaders,
  handleGenerationRequestAsNodeSse,
  pipeSseStreamToNodeResponse,
} from '../runtime';

class MockServerResponse extends EventEmitter {
  headersSent = false;
  writableEnded = false;
  destroyed = false;
  statusCode = 200;
  readonly headers = new Map<string, string>();
  readonly chunks: string[] = [];
  flushHeadersCalls = 0;

  setHeader(name: string, value: string) {
    this.headers.set(name.toLowerCase(), value);
  }

  flushHeaders() {
    this.headersSent = true;
    this.flushHeadersCalls += 1;
  }

  write(chunk: string, callback?: (error?: Error | null) => void): boolean {
    this.chunks.push(chunk);
    callback?.();
    return true;
  }

  end() {
    this.writableEnded = true;
  }
}

test('applySseHeaders sets standard SSE headers and flushes response', () => {
  const response = new MockServerResponse();

  applySseHeaders(response as unknown as ServerResponse);

  assert.equal(response.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'no-cache, no-transform');
  assert.equal(response.headers.get('connection'), 'keep-alive');
  assert.equal(response.headers.get('x-accel-buffering'), 'no');
  assert.equal(response.flushHeadersCalls, 1);
});

test('pipeSseStreamToNodeResponse writes frames and closes response', async () => {
  const response = new MockServerResponse();

  const stream = (async function* () {
    yield 'event: start\n\n';
    yield 'event: terminal\n\n';
  })();

  await pipeSseStreamToNodeResponse(response as unknown as ServerResponse, stream);

  assert.equal(response.chunks.length, 2);
  assert.equal(response.writableEnded, true);
});

test('handleGenerationRequestAsNodeSse pipes generation frames to response', async () => {
  const adapters = createInMemoryGenerationAdapters();
  adapters.llm.streamText = async function* () {
    yield { type: 'chunk', chunk: 'one ' } as const;
    yield { type: 'chunk', chunk: 'two' } as const;
    yield {
      type: 'completed',
      usage: {
        inputTokens: 2,
        outputTokens: 2,
        costUsd: 0.00001,
      },
    } as const;
  };

  const response = new MockServerResponse();

  await handleGenerationRequestAsNodeSse(
    response as unknown as ServerResponse,
    {
      requestId: 'req-runtime-http-sse-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      input: { prompt: 'http sse adapter' },
      workflowType: null,
      idempotencyKey: 'idem-runtime-http-sse-001',
      registrySnapshotRef: 'snapshot:runtime-http-sse',
    },
    adapters,
  );

  const payload = response.chunks.join('');
  assert.ok(payload.includes('event: start'));
  assert.ok(payload.includes('event: chunk'));
  assert.ok(payload.includes('"sequence":1'));
  assert.ok(payload.includes('"sequence":2'));
  assert.ok(payload.includes('event: terminal'));
  assert.equal(response.writableEnded, true);
});
