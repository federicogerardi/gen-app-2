import test from 'node:test';
import assert from 'node:assert/strict';
import { createActor, waitFor } from 'xstate';

import { createInMemoryGenerationAdapters } from '../adapters';
import { persistenceBatchMachine } from '../machines';

test('persistenceBatchMachine finalizes success', async () => {
  const adapters = createInMemoryGenerationAdapters();
  const actor = createActor(persistenceBatchMachine, {
    input: {
      requestId: 'req-persist-ok',
      artifactId: 'artifact-persist-ok',
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
  actor.send({
    type: 'STREAM_TERMINATED_SUCCESS',
    requestId: 'req-persist-ok',
    sourceActor: 'streamTransportMachine',
    timestamp: new Date().toISOString(),
    artifactId: 'artifact-persist-ok',
  });

  const snapshot = await waitFor(actor, (s) => s.matches('finalizedSuccess'));
  assert.equal(snapshot.value, 'finalizedSuccess');
  actor.stop();
});

test('persistenceBatchMachine finalizes failure', async () => {
  const adapters = createInMemoryGenerationAdapters();
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
  actor.send({
    type: 'STREAM_TERMINATED_FAILURE',
    requestId: 'req-persist-fail',
    sourceActor: 'streamTransportMachine',
    timestamp: new Date().toISOString(),
    artifactId: 'artifact-persist-fail',
    reason: 'forced',
  });

  const snapshot = await waitFor(actor, (s) => s.matches('finalizedFailure'));
  assert.equal(snapshot.value, 'finalizedFailure');
  actor.stop();
});
