import { createActor, fromCallback, waitFor } from 'xstate';
import { describe, expect, it, vi } from 'vitest';
import { frontendStreamMachine } from './frontend-stream.machine';
import { createStreamLogger } from '../runtime/stream-logger';
import type { GenerationRequest } from '../contracts/backend-stream';
import { TEST_API_BASE_URL } from '../../../test/fixtures';

const createRequest = (requestId: string): GenerationRequest => ({
  requestId,
  userId: 'user-1',
  projectId: 'project-1',
  artifactType: 'content' as const,
  model: 'openrouter/auto',
  input: { prompt: 'test' },
  registrySnapshotRef: 'snapshot:default',
});

const createTestActor = (overrides?: {
  maxReconnectAttempts?: number;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
}) => {
  const machine = frontendStreamMachine.provide({
    actors: {
      streamTransport: fromCallback(() => {
        return () => undefined;
      }),
    },
  });

  const actor = createActor(machine, {
    input: {
      apiBaseUrl: TEST_API_BASE_URL,
      maxReconnectAttempts: overrides?.maxReconnectAttempts ?? 3,
      reconnectBaseDelayMs: overrides?.reconnectBaseDelayMs ?? 1,
      reconnectMaxDelayMs: overrides?.reconnectMaxDelayMs ?? 1,
    },
  });

  actor.start();
  return actor;
};

describe('frontendStreamMachine', () => {
  it('handles happy path start -> chunks -> completed', () => {
    const actor = createTestActor();

    actor.send({
      type: 'REQUEST_START',
      request: createRequest('req-1'),
    });

    expect(actor.getSnapshot().matches({ active: 'connecting' })).toBe(true);

    actor.send({ type: 'SSE_START', requestId: 'req-1', artifactId: 'art-1' });

    expect(actor.getSnapshot().matches({ active: 'streaming' })).toBe(true);

    actor.send({ type: 'SSE_CHUNK', artifactId: 'art-1', chunk: 'Ciao ', sequence: 1 });
    actor.send({ type: 'SSE_CHUNK', artifactId: 'art-1', chunk: 'mondo', sequence: 2 });
    actor.send({
      type: 'SSE_TERMINAL',
      artifactId: 'art-1',
      status: 'completed',
      reason: null,
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches('completed')).toBe(true);
    expect(snapshot.context.content).toBe('Ciao mondo');
  });

  it('fails when chunk sequence is not monotonic', () => {
    const actor = createTestActor();

    actor.send({
      type: 'REQUEST_START',
      request: createRequest('req-2'),
    });
    actor.send({ type: 'SSE_START', requestId: 'req-2', artifactId: 'art-2' });
    actor.send({ type: 'SSE_CHUNK', artifactId: 'art-2', chunk: 'A', sequence: 2 });
    actor.send({ type: 'SSE_CHUNK', artifactId: 'art-2', chunk: 'B', sequence: 1 });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches('failed')).toBe(true);
    expect(snapshot.context.errorCode).toBe('protocol_error');
  });

  it('fails when chunk artifactId does not match the active stream', () => {
    const actor = createTestActor();

    actor.send({
      type: 'REQUEST_START',
      request: createRequest('req-2b'),
    });
    actor.send({ type: 'SSE_START', requestId: 'req-2b', artifactId: 'art-2b' });
    actor.send({ type: 'SSE_CHUNK', artifactId: 'art-other', chunk: 'A', sequence: 1 });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches('failed')).toBe(true);
    expect(snapshot.context.errorCode).toBe('protocol_error');
  });

  it('cancels active streaming back to idle', () => {
    const actor = createTestActor();

    actor.send({
      type: 'REQUEST_START',
      request: createRequest('req-3'),
    });
    actor.send({ type: 'SSE_START', requestId: 'req-3', artifactId: 'art-3' });
    actor.send({ type: 'SSE_CHUNK', artifactId: 'art-3', chunk: 'A', sequence: 1 });
    actor.send({ type: 'CANCEL' });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches('idle')).toBe(true);
    expect(snapshot.context.content).toBe('');
    expect(snapshot.context.lastRequest).toBeNull();
  });

  it('retries only from failed and reconnects after retryable transport errors', async () => {
    const actor = createTestActor({
      reconnectBaseDelayMs: 20,
      reconnectMaxDelayMs: 20,
    });

    actor.send({
      type: 'REQUEST_START',
      request: createRequest('req-4'),
    });
    actor.send({
      type: 'STREAM_ERROR',
      code: 'transport_mid_stream',
      message: 'temporary network issue',
      retryable: true,
    });

    expect(actor.getSnapshot().matches({ active: 'reconnecting' })).toBe(true);
    expect(actor.getSnapshot().context.reconnectAttempts).toBe(1);

    await waitFor(actor, (snapshot) => snapshot.matches({ active: 'connecting' }));

    actor.send({
      type: 'STREAM_ERROR',
      code: 'protocol_error',
      message: 'bad frame',
      retryable: false,
    });

    expect(actor.getSnapshot().matches('failed')).toBe(true);

    actor.send({ type: 'RETRY' });

    expect(actor.getSnapshot().matches({ active: 'connecting' })).toBe(true);
    expect(actor.getSnapshot().context.errorCode).toBeNull();
    expect(actor.getSnapshot().context.reconnectAttempts).toBe(0);
  });

  it('ignores retry after completion', () => {
    const actor = createTestActor();

    actor.send({
      type: 'REQUEST_START',
      request: createRequest('req-5'),
    });
    actor.send({ type: 'SSE_START', requestId: 'req-5', artifactId: 'art-5' });
    actor.send({
      type: 'SSE_TERMINAL',
      artifactId: 'art-5',
      status: 'completed',
      reason: null,
    });
    actor.send({ type: 'RETRY' });

    expect(actor.getSnapshot().matches('completed')).toBe(true);
  });
});

// Multi-step success scenarios with logging
describe('Success Flow - Multi-Step Generation', () => {
  it('handles multi-step chunks with progression logging', () => {
    const logger = createStreamLogger();
    const actor = createTestActor();

    actor.send({
      type: 'REQUEST_START',
      request: createRequest('req-multi-1'),
    });

    logger.startTimer('stream-duration');
    logger.log('info', 'REQUEST_SENT', { requestId: 'req-multi-1', artifactId: null });

    actor.send({ type: 'SSE_START', requestId: 'req-multi-1', artifactId: 'art-multi-1' });
    logger.log('info', 'STREAM_STARTED', { requestId: 'req-multi-1', artifactId: 'art-multi-1' });

    // Simulate multi-step content generation
    const steps = [
      { text: '# Title\n', seq: 1, step: 'header' },
      { text: 'Introduction paragraph.\n', seq: 2, step: 'intro' },
      { text: 'Main section content.\n', seq: 3, step: 'main' },
      { text: 'Conclusion paragraph.', seq: 4, step: 'conclusion' },
    ];

    let totalLength = 0;
    for (const step of steps) {
      actor.send({
        type: 'SSE_CHUNK',
        artifactId: 'art-multi-1',
        chunk: step.text,
        sequence: step.seq,
      });
      totalLength += step.text.length;
      logger.log('debug', `CHUNK_${step.step.toUpperCase()}`, {
        requestId: 'req-multi-1',
        artifactId: 'art-multi-1',
        sequence: step.seq,
        data: { step: step.step, chunkLength: step.text.length, totalLength },
      });
    }

    actor.send({
      type: 'SSE_TERMINAL',
      artifactId: 'art-multi-1',
      status: 'completed',
      reason: null,
    });
    logger.endTimer('stream-duration', 'STREAM_COMPLETED', {
      requestId: 'req-multi-1',
      artifactId: 'art-multi-1',
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches('completed')).toBe(true);
    expect(snapshot.context.lastSequence).toBe(4);
    expect(snapshot.context.content.includes('# Title')).toBe(true);
    expect(snapshot.context.content.includes('Introduction')).toBe(true);

    // Verify log trace
    const logs = logger.getLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some(l => l.event === 'REQUEST_SENT')).toBe(true);
    expect(logs.some(l => l.event === 'STREAM_STARTED')).toBe(true);
    expect(logs.some(l => l.event.includes('CHUNK_'))).toBe(true);
    expect(logs.some(l => l.event === 'STREAM_COMPLETED')).toBe(true);
  });
});

// Terminal failure scenarios
describe('Failure Scenarios - Terminal & Transport Errors', () => {
  it('fails on terminal_failed with reason message', () => {
    const logger = createStreamLogger();
    const actor = createTestActor();

    actor.send({
      type: 'REQUEST_START',
      request: createRequest('req-terminal-fail-1'),
    });
    actor.send({ type: 'SSE_START', requestId: 'req-terminal-fail-1', artifactId: 'art-terminal-fail-1' });

    actor.send({
      type: 'SSE_CHUNK',
      artifactId: 'art-terminal-fail-1',
      chunk: 'Partial content before failure',
      sequence: 1,
    });

    logger.log('warn', 'TERMINAL_FAILURE_INCOMING', {
      requestId: 'req-terminal-fail-1',
      artifactId: 'art-terminal-fail-1',
    });

    actor.send({
      type: 'SSE_TERMINAL',
      artifactId: 'art-terminal-fail-1',
      status: 'failed',
      reason: 'LLM rate limit exceeded',
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches('failed')).toBe(true);
    expect(snapshot.context.errorCode).toBe('terminal_failed');
    expect(snapshot.context.errorMessage).toContain('LLM rate limit exceeded');
    expect(snapshot.context.content).toContain('Partial content');
  });

  it('handles non-retryable protocol errors', () => {
    const logger = createStreamLogger();
    const actor = createTestActor();

    actor.send({
      type: 'REQUEST_START',
      request: createRequest('req-protocol-error-1'),
    });

    logger.log('error', 'NON_RETRYABLE_ERROR', {
      requestId: 'req-protocol-error-1',
      artifactId: null,
      data: { code: 'protocol_error' },
    });

    actor.send({
      type: 'STREAM_ERROR',
      code: 'protocol_error',
      message: 'Invalid SSE frame format',
      retryable: false,
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches('failed')).toBe(true);
    expect(snapshot.context.errorCode).toBe('protocol_error');
  });

  it('exhausts reconnection attempts and fails permanently', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const logger = createStreamLogger();
      const actor = createTestActor({
        maxReconnectAttempts: 2,
        reconnectBaseDelayMs: 10,
        reconnectMaxDelayMs: 10,
      });

      actor.send({
        type: 'REQUEST_START',
        request: createRequest('req-reconnect-exhaust-1'),
      });

      // Attempt 1: fail with retryable error
      actor.send({
        type: 'STREAM_ERROR',
        code: 'transport_mid_stream',
        message: 'Network timeout',
        retryable: true,
      });
      logger.log('warn', 'RECONNECT_ATTEMPT_1', {
        requestId: 'req-reconnect-exhaust-1',
        artifactId: null,
      });

      expect(actor.getSnapshot().context.reconnectAttempts).toBe(1);

      await waitFor(actor, snapshot => snapshot.matches({ active: 'connecting' }), {
        timeout: 400,
      });

      // Attempt 2: fail again
      actor.send({
        type: 'STREAM_ERROR',
        code: 'transport_mid_stream',
        message: 'Network timeout',
        retryable: true,
      });
      logger.log('warn', 'RECONNECT_ATTEMPT_2', {
        requestId: 'req-reconnect-exhaust-1',
        artifactId: null,
      });

      expect(actor.getSnapshot().context.reconnectAttempts).toBe(2);

      await waitFor(actor, snapshot => snapshot.matches({ active: 'connecting' }), {
        timeout: 400,
      });

      // Attempt 3: fail once more to trigger exhaustion
      actor.send({
        type: 'STREAM_ERROR',
        code: 'transport_mid_stream',
        message: 'Network timeout',
        retryable: true,
      });
      logger.log('error', 'RECONNECT_EXHAUSTED', {
        requestId: 'req-reconnect-exhaust-1',
        artifactId: null,
        data: { attempts: 3 },
      });

      const snapshot = actor.getSnapshot();
      expect(snapshot.matches('failed')).toBe(true);
      expect(snapshot.context.errorCode).toBe('reconnect_exhausted');
      expect(snapshot.context.reconnectAttempts).toBeGreaterThan(2);
    } finally {
      randomSpy.mockRestore();
    }
  });
});

// Edge cases
describe('Edge Cases', () => {
  it('handles unicode and emoji in streaming content', () => {
    const actor = createTestActor();

    actor.send({
      type: 'REQUEST_START',
      request: createRequest('req-unicode-1'),
    });
    actor.send({ type: 'SSE_START', requestId: 'req-unicode-1', artifactId: 'art-unicode-1' });

    const chunks = [
      { text: '🎉 ', seq: 1 },
      { text: 'Buongiorno! ', seq: 2 },
      { text: '你好 ', seq: 3 },
      { text: 'مرحبا', seq: 4 },
    ];

    for (const chunk of chunks) {
      actor.send({
        type: 'SSE_CHUNK',
        artifactId: 'art-unicode-1',
        chunk: chunk.text,
        sequence: chunk.seq,
      });
    }

    actor.send({
      type: 'SSE_TERMINAL',
      artifactId: 'art-unicode-1',
      status: 'completed',
      reason: null,
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.content).toContain('🎉');
    expect(snapshot.context.content).toContain('Buongiorno');
    expect(snapshot.context.content).toContain('你好');
    expect(snapshot.context.content).toContain('مرحبا');
  });

  it('handles large chunks (> 100KB)', () => {
    const actor = createTestActor();

    actor.send({
      type: 'REQUEST_START',
      request: createRequest('req-large-payload-1'),
    });
    actor.send({ type: 'SSE_START', requestId: 'req-large-payload-1', artifactId: 'art-large-1' });

    const largeChunk = 'x'.repeat(100 * 1024); // 100KB
    actor.send({
      type: 'SSE_CHUNK',
      artifactId: 'art-large-1',
      chunk: largeChunk,
      sequence: 1,
    });

    actor.send({
      type: 'SSE_TERMINAL',
      artifactId: 'art-large-1',
      status: 'completed',
      reason: null,
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.context.content.length).toBe(100 * 1024);
    expect(snapshot.matches('completed')).toBe(true);
  });

  it('terminal with null artifactId matches active stream', () => {
    const actor = createTestActor();

    actor.send({
      type: 'REQUEST_START',
      request: createRequest('req-null-artifact-1'),
    });
    actor.send({
      type: 'SSE_START',
      requestId: 'req-null-artifact-1',
      artifactId: 'art-null-artifact-1',
    });
    actor.send({
      type: 'SSE_CHUNK',
      artifactId: 'art-null-artifact-1',
      chunk: 'content',
      sequence: 1,
    });

    // Terminal without specific artifactId (null) should match active stream
    actor.send({
      type: 'SSE_TERMINAL',
      artifactId: null,
      status: 'completed',
      reason: null,
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches('completed')).toBe(true);
    expect(snapshot.context.artifactId).toBe('art-null-artifact-1');
  });

  it('preserves context across reset from completed state', () => {
    const actor = createTestActor();

    actor.send({
      type: 'REQUEST_START',
      request: createRequest('req-reset-test-1'),
    });
    actor.send({ type: 'SSE_START', requestId: 'req-reset-test-1', artifactId: 'art-reset-1' });
    actor.send({
      type: 'SSE_CHUNK',
      artifactId: 'art-reset-1',
      chunk: 'content',
      sequence: 1,
    });
    actor.send({
      type: 'SSE_TERMINAL',
      artifactId: 'art-reset-1',
      status: 'completed',
      reason: null,
    });

    const snapshotBefore = actor.getSnapshot();
    expect(snapshotBefore.matches('completed')).toBe(true);
    expect(snapshotBefore.context.content).toBe('content');
    expect(snapshotBefore.context.requestId).toBe('req-reset-test-1');

    actor.send({ type: 'RESET' });

    const snapshotAfter = actor.getSnapshot();
    expect(snapshotAfter.matches('idle')).toBe(true);
    expect(snapshotAfter.context.content).toBe('');
    expect(snapshotAfter.context.requestId).toBeNull();
    expect(snapshotAfter.context.artifactId).toBeNull();
    expect(snapshotAfter.context.lastRequest).toBeNull();
  });
});

// Snapshot tests for context state integrity
describe('Context State Snapshots', () => {
  it('idle state snapshot', () => {
    const actor = createTestActor();
    const snapshot = actor.getSnapshot();

    expect(snapshot.matches('idle')).toBe(true);
    expect(snapshot.context).toMatchObject({
      requestId: null,
      artifactId: null,
      content: '',
      lastSequence: 0,
      errorCode: null,
      errorMessage: null,
      reconnectAttempts: 0,
      hasTerminal: false,
      lastRequest: null,
    });
  });

  it('completed state snapshot preserves content', () => {
    const actor = createTestActor();

    actor.send({
      type: 'REQUEST_START',
      request: createRequest('req-snapshot-complete-1'),
    });
    actor.send({ type: 'SSE_START', requestId: 'req-snapshot-complete-1', artifactId: 'art-1' });
    actor.send({ type: 'SSE_CHUNK', artifactId: 'art-1', chunk: 'Final content', sequence: 1 });
    actor.send({
      type: 'SSE_TERMINAL',
      artifactId: 'art-1',
      status: 'completed',
      reason: null,
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches('completed')).toBe(true);
    expect(snapshot.context).toMatchObject({
      requestId: 'req-snapshot-complete-1',
      artifactId: 'art-1',
      content: 'Final content',
      lastSequence: 1,
      errorCode: null,
      errorMessage: null,
      hasTerminal: true,
    });
  });

  it('failed state snapshot preserves error details', () => {
    const actor = createTestActor();

    actor.send({
      type: 'REQUEST_START',
      request: createRequest('req-snapshot-failed-1'),
    });
    actor.send({ type: 'SSE_START', requestId: 'req-snapshot-failed-1', artifactId: 'art-fail-1' });
    actor.send({
      type: 'SSE_TERMINAL',
      artifactId: 'art-fail-1',
      status: 'failed',
      reason: 'Generation timeout',
    });

    const snapshot = actor.getSnapshot();
    expect(snapshot.matches('failed')).toBe(true);
    expect(snapshot.context).toMatchObject({
      requestId: 'req-snapshot-failed-1',
      artifactId: 'art-fail-1',
      errorCode: 'terminal_failed',
      errorMessage: 'Generation timeout',
      hasTerminal: true,
    });
  });
});

// ── Checkpoint & Extraction context ───────────────────────────────────────────

import type { ToolCheckpoint } from '../ui/tool-checkpoints';
import type { ExtractionContext } from './frontend-stream.machine';

describe('CHECKPOINT_UPSERTED and EXTRACTION_UPSERTED events', () => {
  it('CHECKPOINT_UPSERTED upserts and replaces checkpoints in context', () => {
    const actor = createTestActor();

    const cp1: ToolCheckpoint = {
      artifactId: 'art-cp-1',
      projectId: 'proj-1',
      status: 'generating',
      extractionContextAvailable: false,
      model: 'openrouter/auto',
      workflowType: null,
      toolKey: null,
      contentPreview: 'Hello',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    actor.send({ type: 'CHECKPOINT_UPSERTED', checkpoint: cp1 });
    expect(actor.getSnapshot().context.checkpoints).toHaveLength(1);
    expect(actor.getSnapshot().context.checkpoints[0]?.artifactId).toBe('art-cp-1');

    // Upsert (replace) same artifactId
    const cp1Updated: ToolCheckpoint = { ...cp1, status: 'completed', contentPreview: 'Hello world' };
    actor.send({ type: 'CHECKPOINT_UPSERTED', checkpoint: cp1Updated });
    expect(actor.getSnapshot().context.checkpoints).toHaveLength(1);
    expect(actor.getSnapshot().context.checkpoints[0]?.status).toBe('completed');

    // RESET clears checkpoints
    actor.send({ type: 'RESET' });
    expect(actor.getSnapshot().context.checkpoints).toHaveLength(0);

    actor.stop();
  });

  it('EXTRACTION_UPSERTED stores extraction context keyed by projectId', () => {
    const actor = createTestActor();

    const extraction: ExtractionContext = {
      projectId: 'proj-1',
      briefingId: 'brief-1',
      extractionArtifactId: 'ext-art-1',
      extractionPayload: { foo: 'bar' },
      normalizedText: 'text',
      parsedFormat: 'txt',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    actor.send({ type: 'EXTRACTION_UPSERTED', context: extraction });
    expect(actor.getSnapshot().context.extractionByProject['proj-1']).toEqual(extraction);

    // Overwrite same project
    const updated: ExtractionContext = { ...extraction, briefingId: 'brief-2' };
    actor.send({ type: 'EXTRACTION_UPSERTED', context: updated });
    expect(actor.getSnapshot().context.extractionByProject['proj-1']?.briefingId).toBe('brief-2');

    // RESET clears
    actor.send({ type: 'RESET' });
    expect(actor.getSnapshot().context.extractionByProject).toEqual({});

    actor.stop();
  });
});
