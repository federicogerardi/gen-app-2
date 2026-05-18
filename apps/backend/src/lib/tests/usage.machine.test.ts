import test from 'node:test';
import assert from 'node:assert/strict';
import { createActor, toPromise, waitFor } from 'xstate';

import { createInMemoryGenerationAdapters } from '../adapters';
import { usageMachine } from '../machines';
import type { UsageGrantedEvent, UsageRejectedEvent } from '../types/xstate';

const FIXED_NOW_ISO = '2026-04-24T10:05:00.000Z';
const fixedNow = () => new Date(FIXED_NOW_ISO);

test('usageMachine grants when quota available', async () => {
  const adapters = createInMemoryGenerationAdapters(5);
  const actor = createActor(usageMachine, {
    input: {
      requestId: 'req-usage-grant',
      userId: 'seed-user-001',
      artifactType: 'content',
      workflowType: null,
      registrySnapshotRef: 'snapshot:seed' as never,
      runtime: {
        now: fixedNow,
      },
      adapters: {
        usage: adapters.usage,
      },
    },
  });

  actor.start();
  const outputPromise = toPromise(actor) as Promise<UsageGrantedEvent>;
  await waitFor(actor, (s) => s.matches('granted'));
  const finalSnapshot = actor.getSnapshot();
  assert.equal(finalSnapshot.value, 'granted');
  const output = await outputPromise;
  assert.equal(output.type, 'USAGE_GRANTED');
  assert.equal(output.requestId, 'req-usage-grant');
  assert.equal(output.sourceActor, 'usageMachine');
  assert.equal(output.timestamp, FIXED_NOW_ISO);
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
      runtime: {
        now: fixedNow,
      },
      adapters: {
        usage: adapters.usage,
      },
    },
  });

  actor.start();
  const outputPromise = toPromise(actor) as Promise<UsageRejectedEvent>;
  await waitFor(actor, (s) => s.matches('rejected'));
  const finalSnapshot = actor.getSnapshot();
  assert.equal(finalSnapshot.value, 'rejected');
  const output = await outputPromise;
  assert.equal(output.type, 'USAGE_REJECTED');
  assert.equal(output.requestId, 'req-usage-reject');
  assert.equal(output.sourceActor, 'usageMachine');
  assert.equal(output.timestamp, FIXED_NOW_ISO);
  assert.equal(output.reason, 'quota_exhausted');
  actor.stop();
});

test('usageMachine rejects with usage_conflict when adapter reports conflict', async () => {
  const adapters = createInMemoryGenerationAdapters(5);
  adapters.usage.claimUsage = async () => ({ granted: false, reason: 'usage_conflict' });

  const actor = createActor(usageMachine, {
    input: {
      requestId: 'req-usage-conflict',
      userId: 'seed-user-001',
      artifactType: 'content',
      workflowType: null,
      registrySnapshotRef: 'snapshot:seed' as never,
      runtime: {
        now: fixedNow,
      },
      adapters: {
        usage: adapters.usage,
      },
    },
  });

  actor.start();
  const outputPromise = toPromise(actor) as Promise<UsageRejectedEvent>;
  await waitFor(actor, (s) => s.matches('rejected'));
  const output = await outputPromise;
  assert.equal(output.type, 'USAGE_REJECTED');
  assert.equal(output.reason, 'usage_conflict');
  actor.stop();
});

test('usageMachine parallel claims with shared quota are deterministic', async () => {
  const adapters = createInMemoryGenerationAdapters(1);

  const createUsageActor = (requestId: string) =>
    createActor(usageMachine, {
      input: {
        requestId,
        userId: 'seed-user-parallel-001',
        artifactType: 'content',
        workflowType: null,
        registrySnapshotRef: 'snapshot:seed' as never,
        runtime: {
          now: fixedNow,
        },
        adapters: {
          usage: adapters.usage,
        },
      },
    });

  const actorA = createUsageActor('req-usage-parallel-a');
  const actorB = createUsageActor('req-usage-parallel-b');

  actorA.start();
  actorB.start();

  const [resultA, resultB] = await Promise.all([
    toPromise(actorA) as Promise<UsageGrantedEvent | UsageRejectedEvent>,
    toPromise(actorB) as Promise<UsageGrantedEvent | UsageRejectedEvent>,
  ]);

  const results = [resultA, resultB];
  const grantedCount = results.filter((entry) => entry.type === 'USAGE_GRANTED').length;
  const rejected = results.filter((entry): entry is UsageRejectedEvent => entry.type === 'USAGE_REJECTED');

  assert.equal(grantedCount, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0]?.reason, 'quota_exhausted');

  actorA.stop();
  actorB.stop();
});
