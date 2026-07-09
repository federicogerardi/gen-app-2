import test from 'node:test';
import assert from 'node:assert/strict';
import { createActor, toPromise, waitFor } from 'xstate';

import { createInMemoryGenerationAdapters } from '../adapters/generation';
import { persistenceBatchMachine } from '../machines';
import type {
  PersistenceBatchInput,
  PersistenceFinalizeFailedEvent,
  PersistenceFinalizeSucceededEvent,
} from '../types/xstate';

test('persistenceBatchMachine finalizes success', async () => {
  const baseAdapters = createInMemoryGenerationAdapters();
  const flushCalls: Array<{ input: PersistenceBatchInput; sequence: number }> = [];
  const finalizeSuccessCalls: PersistenceBatchInput[] = [];

  const adapters = {
    persistence: {
      flushProgress: async (input: PersistenceBatchInput, sequence: number) => {
        flushCalls.push({ input, sequence });
        await baseAdapters.persistence.flushProgress(input, sequence);
      },
      finalizeSuccess: async (input: PersistenceBatchInput) => {
        finalizeSuccessCalls.push(input);
        await baseAdapters.persistence.finalizeSuccess(input);
      },
      finalizeFailure: async (input: PersistenceBatchInput, reason: string) => {
        await baseAdapters.persistence.finalizeFailure(input, reason);
      },
    },
  };

  const actor = createActor(persistenceBatchMachine, {
    input: {
      requestId: 'req-persist-ok',
      artifactId: 'artifact-persist-ok',
      artifactType: 'content',
      workflowType: null,
      contentBuffer: 'payload',
      inputTokens: 12,
      outputTokens: 34,
      costUsd: 0.0025,
      registrySnapshotRef: 'snapshot:seed' as never,
      adapters: {
        persistence: adapters.persistence,
      },
    },
  });

  actor.start();
  const outputPromise = toPromise(actor) as Promise<PersistenceFinalizeSucceededEvent>;
  actor.send({
    type: 'STREAM_CHUNK_RECEIVED',
    requestId: 'req-persist-ok',
    sourceActor: 'streamTransportMachine',
    timestamp: new Date().toISOString(),
    artifactId: 'artifact-persist-ok',
    metadata: {
      chunk: 'chunk-10',
      sequence: 10,
    },
  });

  await waitFor(actor, (s) => s.matches('flushing'));
  await waitFor(actor, (s) => s.matches('idle') && s.context.lastSequence === 10);

  actor.send({
    type: 'STREAM_TERMINATED_SUCCESS',
    requestId: 'req-persist-ok',
    sourceActor: 'streamTransportMachine',
    timestamp: new Date().toISOString(),
    artifactId: 'artifact-persist-ok',
  });

  await waitFor(actor, (s) => s.matches('finalizedSuccess'));
  const finalSnapshot = actor.getSnapshot();
  assert.equal(finalSnapshot.value, 'finalizedSuccess');
  const output = await outputPromise;
  assert.equal(output.type, 'PERSISTENCE_FINALIZE_SUCCEEDED');
  assert.equal(output.requestId, 'req-persist-ok');
  assert.equal(output.sourceActor, 'persistenceBatchMachine');
  assert.equal(output.artifactId, 'artifact-persist-ok');

  assert.equal(flushCalls.length, 1);
  assert.equal(flushCalls[0]?.sequence, 10);
  assert.equal(flushCalls[0]?.input.artifactId, 'artifact-persist-ok');
  assert.equal(finalizeSuccessCalls.length, 1);
  assert.equal(finalizeSuccessCalls[0]?.inputTokens, 12);
  assert.equal(finalizeSuccessCalls[0]?.outputTokens, 34);
  assert.equal(finalizeSuccessCalls[0]?.costUsd, 0.0025);

  actor.stop();
});

test('persistenceBatchMachine finalizes failure', async () => {
  const baseAdapters = createInMemoryGenerationAdapters();
  const finalizeFailureCalls: Array<{ input: PersistenceBatchInput; reason: string }> = [];

  const adapters = {
    persistence: {
      flushProgress: async (input: PersistenceBatchInput, sequence: number) => {
        await baseAdapters.persistence.flushProgress(input, sequence);
      },
      finalizeSuccess: async (input: PersistenceBatchInput) => {
        await baseAdapters.persistence.finalizeSuccess(input);
      },
      finalizeFailure: async (input: PersistenceBatchInput, reason: string) => {
        finalizeFailureCalls.push({ input, reason });
        await baseAdapters.persistence.finalizeFailure(input, reason);
      },
    },
  };

  const actor = createActor(persistenceBatchMachine, {
    input: {
      requestId: 'req-persist-fail',
      artifactId: 'artifact-persist-fail',
      artifactType: 'content',
      workflowType: null,
      contentBuffer: 'payload',
      registrySnapshotRef: 'snapshot:seed' as never,
      adapters: {
        persistence: adapters.persistence,
      },
    },
  });

  actor.start();
  const outputPromise = toPromise(actor) as Promise<PersistenceFinalizeFailedEvent>;
  actor.send({
    type: 'STREAM_TERMINATED_FAILURE',
    requestId: 'req-persist-fail',
    sourceActor: 'streamTransportMachine',
    timestamp: new Date().toISOString(),
    artifactId: 'artifact-persist-fail',
    reason: 'forced',
  });

  await waitFor(actor, (s) => s.matches('finalizedFailure'));
  const finalSnapshot = actor.getSnapshot();
  assert.equal(finalSnapshot.value, 'finalizedFailure');
  const output = await outputPromise;
  assert.equal(output.type, 'PERSISTENCE_FINALIZE_FAILED');
  assert.equal(output.requestId, 'req-persist-fail');
  assert.equal(output.sourceActor, 'persistenceBatchMachine');
  assert.equal(output.artifactId, 'artifact-persist-fail');
  assert.equal(output.reason, 'forced');

  assert.equal(finalizeFailureCalls.length, 1);
  assert.equal(finalizeFailureCalls[0]?.input.artifactId, 'artifact-persist-fail');
  assert.equal(finalizeFailureCalls[0]?.reason, 'forced');

  actor.stop();
});
