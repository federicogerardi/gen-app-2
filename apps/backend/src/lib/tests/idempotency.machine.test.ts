import test from 'node:test';
import assert from 'node:assert/strict';
import { createActor, toPromise } from 'xstate';

import { createInMemoryGenerationAdapters } from '../adapters';
import { idempotencyCoordinatorMachine } from '../machines';
import type {
  IdempotencyClaimedEvent,
  IdempotencyConflictEvent,
  IdempotencyReplayReadyEvent,
} from '../types/xstate';

const FIXED_NOW_ISO = '2026-04-24T10:00:00.000Z';
const fixedNow = () => new Date(FIXED_NOW_ISO);

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
      runtime: {
        now: fixedNow,
      },
      adapters: {
        idempotency: adapters.idempotency,
      },
    },
  });

  actor.start();
  const outputPromise = toPromise(actor) as Promise<IdempotencyClaimedEvent>;
  const output = await outputPromise;
  assert.equal(output.type, 'IDEMPOTENCY_CLAIMED');
  assert.equal(output.requestId, 'req-idem-claimed');
  assert.equal(output.sourceActor, 'idempotencyCoordinatorMachine');
  assert.equal(output.timestamp, FIXED_NOW_ISO);
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
    runtime: {
      now: fixedNow,
    },
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
  const outputPromise = toPromise(actor) as Promise<IdempotencyReplayReadyEvent>;
  const output = await outputPromise;
  assert.equal(output.type, 'IDEMPOTENCY_REPLAY_READY');
  assert.equal(output.requestId, 'req-idem-replay');
  assert.equal(output.sourceActor, 'idempotencyCoordinatorMachine');
  assert.equal(output.timestamp, FIXED_NOW_ISO);
  assert.equal(output.artifactId, 'artifact-replay-001');
  assert.equal(output.metadata.content, 'cached-content');
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
    runtime: {
      now: fixedNow,
    },
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
  const outputPromise = toPromise(actor) as Promise<IdempotencyConflictEvent>;
  const output = await outputPromise;
  assert.equal(output.type, 'IDEMPOTENCY_CONFLICT');
  assert.equal(output.requestId, 'req-idem-conflict');
  assert.equal(output.sourceActor, 'idempotencyCoordinatorMachine');
  assert.equal(output.timestamp, FIXED_NOW_ISO);
  assert.equal(output.reason, 'idempotency_conflict');
  actor.stop();
});

test('idempotencyCoordinatorMachine dedups by idempotencyKey across different requestIds', async () => {
  const adapters = createInMemoryGenerationAdapters();
  const firstInput = {
    requestId: 'req-idem-dedup-first',
    userId: 'seed-user-001',
    projectId: 'seed-project-001',
    workflowType: null,
    idempotencyKey: 'idem-dedup-001',
    registrySnapshotRef: 'snapshot:seed' as never,
    runtime: {
      now: fixedNow,
    },
  };

  await adapters.idempotency.checkAndClaim(firstInput);
  await adapters.idempotency.markCompleted(firstInput, 'artifact-dedup-001', 'cached-dedup-content');

  const secondActor = createActor(idempotencyCoordinatorMachine, {
    input: {
      ...firstInput,
      requestId: 'req-idem-dedup-second',
      adapters: {
        idempotency: adapters.idempotency,
      },
    },
  });

  secondActor.start();
  const outputPromise = toPromise(secondActor) as Promise<IdempotencyReplayReadyEvent>;
  const output = await outputPromise;
  assert.equal(output.type, 'IDEMPOTENCY_REPLAY_READY');
  assert.equal(output.requestId, 'req-idem-dedup-second');
  assert.equal(output.artifactId, 'artifact-dedup-001');
  assert.equal(output.metadata.content, 'cached-dedup-content');
  secondActor.stop();
});
