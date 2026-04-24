import test from 'node:test';
import assert from 'node:assert/strict';
import { createActor, waitFor } from 'xstate';

import { createInMemoryGenerationAdapters } from '../adapters';
import { idempotencyCoordinatorMachine } from '../machines';

test('idempotencyCoordinatorMachine returns claimed on first claim', async () => {
  const adapters = createInMemoryGenerationAdapters();
  const actor = createActor(idempotencyCoordinatorMachine, {
    input: {
      requestId: 'req-idem-claimed',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      workflowType: null,
      idempotencyKey: 'idem-claimed-001',
      registrySnapshotRef: 'snapshot:seed' as never,
      adapters: {
        idempotency: adapters.idempotency,
      },
    },
  });

  actor.start();
  const snapshot = await waitFor(actor, (s) => s.matches('claimed'));
  assert.equal(snapshot.value, 'claimed');
  actor.stop();
});

test('idempotencyCoordinatorMachine returns replay after completed record', async () => {
  const adapters = createInMemoryGenerationAdapters();
  const input = {
    requestId: 'req-idem-replay',
    userId: 'seed-user-001',
    projectId: 'seed-project-001',
    workflowType: null,
    idempotencyKey: 'idem-replay-001',
    registrySnapshotRef: 'snapshot:seed' as never,
  };

  await adapters.idempotency.checkAndClaim(input);
  await adapters.idempotency.markCompleted(input, 'artifact-replay-001', 'cached-content');

  const actor = createActor(idempotencyCoordinatorMachine, {
    input: {
      ...input,
      adapters: {
        idempotency: adapters.idempotency,
      },
    },
  });

  actor.start();
  const snapshot = await waitFor(actor, (s) => s.matches('replayReady'));
  assert.equal(snapshot.value, 'replayReady');
  actor.stop();
});

test('idempotencyCoordinatorMachine returns conflict when already claimed', async () => {
  const adapters = createInMemoryGenerationAdapters();
  const input = {
    requestId: 'req-idem-conflict',
    userId: 'seed-user-001',
    projectId: 'seed-project-001',
    workflowType: null,
    idempotencyKey: 'idem-conflict-001',
    registrySnapshotRef: 'snapshot:seed' as never,
  };

  await adapters.idempotency.checkAndClaim(input);

  const actor = createActor(idempotencyCoordinatorMachine, {
    input: {
      ...input,
      adapters: {
        idempotency: adapters.idempotency,
      },
    },
  });

  actor.start();
  const snapshot = await waitFor(actor, (s) => s.matches('conflict'));
  assert.equal(snapshot.value, 'conflict');
  actor.stop();
});
