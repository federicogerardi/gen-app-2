import test from 'node:test';
import assert from 'node:assert/strict';

import { createInMemoryGenerationAdapters } from '../adapters';
import {
  handleGenerationRequest,
  handleGenerationRequestAsSseStream,
} from '../runtime';

test('handleGenerationRequest streams SSE frames via callback before completion', async () => {
  const adapters = createInMemoryGenerationAdapters();

  let releaseSecondChunk: () => void = () => {};
  const secondChunkGate = new Promise<void>((resolve) => {
    releaseSecondChunk = resolve;
  });

  let resolveFirstChunkSeen: () => void = () => {};
  const firstChunkSeen = new Promise<void>((resolve) => {
    resolveFirstChunkSeen = resolve;
  });
  let hasResolvedFirstChunkSeen = false;

  adapters.llm.streamText = async function* () {
    yield { type: 'chunk', chunk: 'hello ' } as const;
    await secondChunkGate;
    yield { type: 'chunk', chunk: 'world' } as const;
    yield {
      type: 'completed',
      usage: {
        inputTokens: 3,
        outputTokens: 3,
        costUsd: 0.00001,
      },
    } as const;
  };

  const callbackFrames: string[] = [];
  const callbackEvents: Array<'start' | 'chunk' | 'terminal'> = [];

  const runPromise = handleGenerationRequest(
    {
      requestId: 'req-runtime-index-stream-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      input: { prompt: 'stream to callback' },
      workflowType: null,
      idempotencyKey: 'idem-runtime-index-stream-001',
      registrySnapshotRef: 'snapshot:runtime-index-stream',
    },
    adapters,
    {
      onSseEvent: (payload, event) => {
        callbackFrames.push(payload);
        callbackEvents.push(event.event);
        if (!hasResolvedFirstChunkSeen && event.event === 'chunk') {
          hasResolvedFirstChunkSeen = true;
          resolveFirstChunkSeen();
        }
      },
    },
  );

  await firstChunkSeen;

  assert.ok(callbackEvents.includes('chunk'));
  releaseSecondChunk();

  const result = await runPromise;
  assert.equal(result.status, 'completed');
  assert.equal(result.content, 'hello world');
  assert.equal(result.ssePayload, callbackFrames.join(''));
  assert.equal(callbackEvents[callbackEvents.length - 1], 'terminal');
});

test('handleGenerationRequestAsSseStream yields live SSE frames for direct piping', async () => {
  const adapters = createInMemoryGenerationAdapters();

  let releaseSecondChunk: () => void = () => {};
  const secondChunkGate = new Promise<void>((resolve) => {
    releaseSecondChunk = resolve;
  });

  adapters.llm.streamText = async function* () {
    yield { type: 'chunk', chunk: 'alpha ' } as const;
    await secondChunkGate;
    yield { type: 'chunk', chunk: 'beta' } as const;
    yield {
      type: 'completed',
      usage: {
        inputTokens: 2,
        outputTokens: 2,
        costUsd: 0.00001,
      },
    } as const;
  };

  const iterable = handleGenerationRequestAsSseStream(
    {
      requestId: 'req-runtime-index-iterable-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      input: { prompt: 'stream iterable' },
      workflowType: null,
      idempotencyKey: 'idem-runtime-index-iterable-001',
      registrySnapshotRef: 'snapshot:runtime-index-iterable',
    },
    adapters,
  );

  const frames: string[] = [];
  for await (const frame of iterable) {
    frames.push(frame);
    if (frame.includes('event: chunk') && frame.includes('"sequence":1')) {
      releaseSecondChunk();
    }
  }

  assert.ok(frames.some((frame) => frame.startsWith('event: start')));
  assert.ok(frames.some((frame) => frame.includes('event: chunk') && frame.includes('"sequence":1')));
  assert.ok(frames.some((frame) => frame.includes('event: chunk') && frame.includes('"sequence":2')));
  assert.ok(frames.some((frame) => frame.startsWith('event: terminal')));
});
