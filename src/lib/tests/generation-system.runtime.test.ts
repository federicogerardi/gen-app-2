import test from 'node:test';
import assert from 'node:assert/strict';
import { createActor, fromPromise, waitFor } from 'xstate';

import { createInMemoryGenerationAdapters } from '../adapters';
import { generationSystemMachine, persistenceBatchMachine } from '../machines';
import { runBackendGenerationSession } from '../runtime/backend-session';

const waitForTerminalState = async (
  actor: ReturnType<typeof createActor<typeof generationSystemMachine>>,
  timeoutMs = 2000,
) => {
  let timer: NodeJS.Timeout | undefined;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('timeout waiting for terminal state'));
      }, timeoutMs);
    });

    return await Promise.race([
      waitFor(actor, (s) => {
        const value = String(s.value);
        return value === 'completed' || value === 'failed';
      }),
      timeoutPromise,
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

test('generation root happy path completes', async () => {
  const adapters = createInMemoryGenerationAdapters();

  const result = await runBackendGenerationSession(
    {
      requestId: 'req-root-happy-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      input: { prompt: 'hello world' },
      workflowType: null,
      idempotencyKey: 'idem-root-happy-001',
      registrySnapshotRef: 'snapshot:root',
    },
    adapters,
  );

  assert.equal(result.status, 'completed');
  assert.ok(result.artifactId);
  assert.ok(result.content.length > 0);
  assert.equal(result.streamEvents[result.streamEvents.length - 1]?.event, 'terminal');
});

test('backend session emits incremental chunk events while streaming', async () => {
  const adapters = createInMemoryGenerationAdapters();
  adapters.llm.streamText = async function* () {
    yield { type: 'chunk', chunk: 'hello ' };
    yield { type: 'chunk', chunk: 'world' };
    yield {
      type: 'completed',
      usage: {
        inputTokens: 2,
        outputTokens: 3,
        costUsd: 0.00001,
      },
    };
  };

  const result = await runBackendGenerationSession(
    {
      requestId: 'req-root-incremental-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      input: { prompt: 'incremental stream' },
      workflowType: null,
      idempotencyKey: 'idem-root-incremental-001',
      registrySnapshotRef: 'snapshot:root-incremental',
    },
    adapters,
  );

  const chunkEvents = result.streamEvents.filter((event) => event.event === 'chunk');
  assert.equal(chunkEvents.length, 2);
  assert.equal(chunkEvents[0]?.data.sequence, 1);
  assert.equal(chunkEvents[0]?.data.chunk, 'hello ');
  assert.equal(chunkEvents[1]?.data.sequence, 2);
  assert.equal(chunkEvents[1]?.data.chunk, 'world');
  assert.equal(result.content, 'hello world');
});

test('generation root failure path fails on usage rejection', async () => {
  const adapters = createInMemoryGenerationAdapters();
  const actor = createActor(generationSystemMachine, { input: { adapters } });

  actor.start();
  actor.send({
    type: 'REQUEST_RECEIVED',
    requestId: 'req-root-failure-001',
    projectId: 'seed-project-001',
    toolKey: null,
    artifactType: 'content',
    model: 'gpt-5.3-codex',
    input: { prompt: 'failure case', outputFormat: 'plain' },
    workflowType: null,
    idempotencyKey: 'idem-root-failure-001',
    registrySnapshotRef: 'snapshot:root' as never,
  });
  actor.send({ type: 'AUTH_FAIL' });

  const snapshot = await waitFor(actor, (s) => String(s.value) === 'failed');
  assert.equal(String(snapshot.value), 'failed');
  assert.equal(snapshot.context.failureReason, 'unauthorized');
  actor.stop();
});

test('generation root extraction flow completes from invoke input bootstrap', async () => {
  const adapters = createInMemoryGenerationAdapters();

  const result = await runBackendGenerationSession(
    {
      requestId: 'req-root-extraction-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      input: { prompt: 'extract this' },
      workflowType: 'extraction',
      idempotencyKey: 'idem-root-extraction-001',
      registrySnapshotRef: 'snapshot:root-extraction',
    },
    adapters,
  );

  assert.equal(result.status, 'completed');
  assert.ok(result.artifactId);
  assert.match(result.content, /extract this/);
});

test('generation root tool flow completes from invoke input bootstrap', async () => {
  const adapters = createInMemoryGenerationAdapters();

  const result = await runBackendGenerationSession(
    {
      requestId: 'req-root-tool-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      input: { prompt: 'tool run' },
      toolKey: 'landing_page',
      workflowType: 'landing_page',
      idempotencyKey: 'idem-root-tool-001',
      registrySnapshotRef: 'snapshot:root-tool',
    },
    adapters,
  );

  assert.equal(result.status, 'completed');
  assert.ok(result.artifactId);
  assert.equal(result.streamEvents[result.streamEvents.length - 1]?.event, 'terminal');
});

test('generation root fails when registry selector is missing', async () => {
  const adapters = createInMemoryGenerationAdapters();
  const actor = createActor(generationSystemMachine, { input: { adapters } });

  actor.start();
  actor.send({
    type: 'REQUEST_RECEIVED',
    requestId: 'req-root-missing-selector-001',
    projectId: 'seed-project-001',
    toolKey: null,
    artifactType: 'content',
    model: 'gpt-5.3-codex',
    input: { prompt: 'missing selector', outputFormat: 'plain' },
    workflowType: null,
    idempotencyKey: 'idem-root-missing-selector-001',
  } as never);

  const snapshot = await waitFor(actor, (s) => String(s.value) === 'failed');
  assert.equal(String(snapshot.value), 'failed');
  assert.equal(snapshot.context.failureReason, 'missing_registry_selector');
  actor.stop();
});

test('generation root completes replay path on idempotency replay', async () => {
  const adapters = createInMemoryGenerationAdapters();
  adapters.idempotency.checkAndClaim = async () => ({
    status: 'replay',
    artifactId: 'artifact-replay-001',
    content: 'cached replay content',
  });

  const result = await runBackendGenerationSession(
    {
      requestId: 'req-root-replay-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      input: { prompt: 'replay me' },
      workflowType: null,
      idempotencyKey: 'idem-root-replay-001',
      registrySnapshotRef: 'snapshot:root-replay',
    },
    adapters,
  );

  assert.equal(result.status, 'completed');
  assert.equal(result.artifactId, 'artifact-replay-001');
  assert.equal(result.content, 'cached replay content');
});

test('generation root fails on idempotency conflict branch', async () => {
  const adapters = createInMemoryGenerationAdapters();
  adapters.idempotency.checkAndClaim = async () => ({
    status: 'conflict',
    reason: 'idempotency_conflict',
  });

  const result = await runBackendGenerationSession(
    {
      requestId: 'req-root-conflict-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      input: { prompt: 'conflict me' },
      workflowType: null,
      idempotencyKey: 'idem-root-conflict-001',
      registrySnapshotRef: 'snapshot:root-conflict',
    },
    adapters,
  );

  assert.equal(result.status, 'failed');
  assert.equal(result.error?.code, 'idempotency_conflict');
});

test('generation root fails on usage rejected branch', async () => {
  const adapters = createInMemoryGenerationAdapters(0);

  const result = await runBackendGenerationSession(
    {
      requestId: 'req-root-usage-rejected-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      input: { prompt: 'reject usage' },
      workflowType: null,
      idempotencyKey: 'idem-root-usage-rejected-001',
      registrySnapshotRef: 'snapshot:root-usage-rejected',
    },
    adapters,
  );

  assert.equal(result.status, 'failed');
  assert.equal(result.error?.code, 'rate_limited');
});

test('generation root fails on stream failure branch', async () => {
  const adapters = createInMemoryGenerationAdapters();
  adapters.stream.openSession = async () => {
    throw new Error('forced stream open failure');
  };

  const result = await runBackendGenerationSession(
    {
      requestId: 'req-root-stream-failure-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      input: { prompt: 'break stream' },
      workflowType: null,
      idempotencyKey: 'idem-root-stream-failure-001',
      registrySnapshotRef: 'snapshot:root-stream-failure',
    },
    adapters,
  );

  assert.equal(result.status, 'failed');
  assert.equal(result.error?.code, 'generation_failed');
});

test('generation root reaches terminal state on persistence finalize failure branch', async () => {
  const adapters = createInMemoryGenerationAdapters();
  const failingPersistenceMachine = persistenceBatchMachine.provide({
    actors: {
      finalizeSuccess: fromPromise(async (): Promise<{ ok: true }> => {
        throw new Error('forced persistence finalize failure');
      }),
    },
  });
  const machine = generationSystemMachine.provide({
    actors: {
      invokePersistence: failingPersistenceMachine,
    },
  });
  const actor = createActor(machine, { input: { adapters } });

  actor.start();
  actor.send({
    type: 'REQUEST_RECEIVED',
    requestId: 'req-root-persistence-failure-001',
    projectId: 'seed-project-001',
    toolKey: null,
    artifactType: 'content',
    model: 'gpt-5.3-codex',
    input: { prompt: 'force persistence failure', outputFormat: 'plain' },
    workflowType: null,
    idempotencyKey: 'idem-root-persistence-failure-001',
    registrySnapshotRef: 'snapshot:root-persistence-failure' as never,
  });
  actor.send({ type: 'AUTH_OK', userId: 'seed-user-001' });
  actor.send({
    type: 'VALIDATION_OK',
    workflowType: null,
    registryVersion: null as never,
    registrySnapshotRef: 'snapshot:root-persistence-failure' as never,
  });

  try {
    const snapshot = await waitForTerminalState(actor);
    const terminalValue = String(snapshot.value);
    assert.ok(terminalValue === 'failed' || terminalValue === 'completed');
    if (terminalValue === 'failed') {
      assert.equal(snapshot.context.failureReason, 'persistence_finalize_failed');
    }
  } finally {
    actor.stop();
  }
});
