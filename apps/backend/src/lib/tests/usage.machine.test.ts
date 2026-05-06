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
