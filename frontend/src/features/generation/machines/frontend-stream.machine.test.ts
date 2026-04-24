import { createActor, fromCallback, waitFor } from 'xstate';
import { describe, expect, it } from 'vitest';
import { frontendStreamMachine } from './frontend-stream.machine';

const createRequest = (requestId: string) => ({
  requestId,
  userId: 'user-1',
  projectId: 'project-1',
  artifactType: 'content' as const,
  model: 'openrouter:auto',
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
      apiBaseUrl: 'http://localhost:3000',
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
