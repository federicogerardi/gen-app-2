import test from 'node:test';
import assert from 'node:assert/strict';
import { createActor, waitFor } from 'xstate';

import { createInMemoryGenerationAdapters } from '../adapters';
import { usageMachine } from '../machines';

test('usageMachine grants when quota available', async () => {
  const adapters = createInMemoryGenerationAdapters(5);
  const actor = createActor(usageMachine, {
    input: {
      requestId: 'req-usage-grant',
      userId: 'seed-user-001',
      artifactType: 'content',
      workflowType: null,
      registrySnapshotRef: 'snapshot:seed' as never,
      adapters: {
        usage: adapters.usage,
      },
    },
  });

  actor.start();
  const snapshot = await waitFor(actor, (s) => s.matches('granted'));
  assert.equal(snapshot.value, 'granted');
  actor.stop();
});

test('usageMachine rejects when quota exhausted', async () => {
  const adapters = createInMemoryGenerationAdapters(0);
  const actor = createActor(usageMachine, {
    input: {
      requestId: 'req-usage-reject',
      userId: 'seed-user-001',
      artifactType: 'content',
      workflowType: null,
      registrySnapshotRef: 'snapshot:seed' as never,
      adapters: {
        usage: adapters.usage,
      },
    },
  });

  actor.start();
  const snapshot = await waitFor(actor, (s) => s.matches('rejected'));
  assert.equal(snapshot.value, 'rejected');
  actor.stop();
});
