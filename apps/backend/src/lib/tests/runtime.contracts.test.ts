import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { ServerResponse } from 'node:http';

import { mapFailureReasonToBackendError } from '../runtime/error-contract';
import { pipeSseStreamToNodeResponse } from '../runtime/http-sse';
import { serializeSseEvent } from '../runtime/stream-contract';

class MockServerResponse extends EventEmitter {
  headersSent = false;
  writableEnded = false;
  destroyed = false;
  statusCode = 200;
  readonly headers = new Map<string, string>();
  readonly chunks: string[] = [];

  setHeader(name: string, value: string) {
    this.headers.set(name.toLowerCase(), value);
  }

  flushHeaders() {
    this.headersSent = true;
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

test('mapFailureReasonToBackendError preserves canonical mappings', () => {
  const unknown = mapFailureReasonToBackendError(null);
  assert.deepEqual(unknown, {
    code: 'generation_failed',
    message: 'Generation failed with unknown reason',
    retryable: false,
  });

  assert.deepEqual(mapFailureReasonToBackendError('unauthorized'), {
    code: 'unauthorized',
    message: 'Unauthorized request',
    retryable: false,
  });

  assert.deepEqual(mapFailureReasonToBackendError('idempotency_conflict'), {
    code: 'idempotency_conflict',
    message: 'Another in-flight request holds the idempotency lock',
    retryable: true,
  });

  assert.deepEqual(mapFailureReasonToBackendError('rate_limited'), {
    code: 'rate_limited',
    message: 'Quota or rate-limit exhausted',
    retryable: true,
  });

  assert.deepEqual(mapFailureReasonToBackendError('quota_exhausted'), {
    code: 'rate_limited',
    message: 'Quota or rate-limit exhausted',
    retryable: true,
  });

  assert.deepEqual(mapFailureReasonToBackendError('extraction_context_insufficient'), {
    code: 'validation_failed',
    message: 'Extraction context is insufficient for the selected tool',
    retryable: true,
  });

  assert.deepEqual(mapFailureReasonToBackendError('missing_registry_selector'), {
    code: 'validation_failed',
    message: 'missing_registry_selector',
    retryable: false,
  });

  assert.deepEqual(mapFailureReasonToBackendError('stream_session_open_failed'), {
    code: 'generation_failed',
    message: 'stream_session_open_failed',
    retryable: false,
  });
});

test('serializeSseEvent keeps event/data wire format stable', () => {
  const payload = serializeSseEvent({
    event: 'terminal',
    data: {
      artifactId: 'artifact-001',
      status: 'completed',
      reason: null,
    },
  });

  assert.equal(
    payload,
    'event: terminal\ndata: {"artifactId":"artifact-001","status":"completed","reason":null}\n\n',
  );
});

test('pipeSseStreamToNodeResponse emits terminal frame on stream error by default', async () => {
  const response = new MockServerResponse();

  const failingStream = (async function* (): AsyncGenerator<string> {
    yield 'event: start\n\n';
    throw new Error('boom');
  })();

  await assert.rejects(
    pipeSseStreamToNodeResponse(response as unknown as ServerResponse, failingStream),
    /boom/,
  );

  const payload = response.chunks.join('');
  assert.ok(payload.includes('event: start'));
  assert.ok(payload.includes('event: terminal'));
  assert.ok(payload.includes('"status":"failed"'));
  assert.ok(payload.includes('"reason":"boom"'));
  assert.equal(response.writableEnded, true);
});

test('pipeSseStreamToNodeResponse keeps terminal emission disabled when configured', async () => {
  const response = new MockServerResponse();

  const failingStream = (async function* (): AsyncGenerator<string> {
    throw new Error('no-terminal');
  })();

  await assert.rejects(
    pipeSseStreamToNodeResponse(response as unknown as ServerResponse, failingStream, {
      emitTerminalOnError: false,
    }),
    /no-terminal/,
  );

  const payload = response.chunks.join('');
  assert.equal(payload.includes('event: terminal'), false);
  assert.equal(response.writableEnded, true);
});
