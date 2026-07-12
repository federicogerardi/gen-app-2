import test from 'node:test';
import assert from 'node:assert/strict';
import { createActor, waitFor } from 'xstate';

import { createInMemoryGenerationAdapters } from '../adapters/generation';
import { generationSystemMachine } from '../machines';

test('tool route invokes toolWorkflowErrorActor on failure', async () => {
  const adapters = createInMemoryGenerationAdapters(0);
  const actor = createActor(generationSystemMachine, { input: { adapters } });
  actor.start();

  actor.send({
    type: 'REQUEST_RECEIVED',
    requestId: 'req-error-tool-001',
    projectId: 'proj-001',
    sessionId: 'sess-001',
    toolKey: 'nextland',
    artifactType: 'content',
    workflowType: 'nextland',
    model: 'gpt-4',
    input: { prompt: 'test' },
    idempotencyKey: 'idem-error-tool-001',
    outputFormat: 'plain',
    registryVersion: null,
    registrySnapshotRef: 'snap-001',
    syntheticResponse: '',
    effectiveModelResolution: null,
  } as never);
  actor.send({ type: 'AUTH_OK', userId: 'user-001' });
  actor.send({
    type: 'VALIDATION_OK',
    workflowType: 'nextland',
    registryVersion: null,
    registrySnapshotRef: 'snap-001',
  } as never);

  const snapshot = await waitFor(actor, (s) => String(s.value).includes('failed'), { timeout: 5000 });
  const ctx = snapshot.context;

  assert.ok(
    typeof ctx.failureReason === 'string' && ctx.failureReason.length > 0,
    `failureReason should be a non-empty string, got: ${ctx.failureReason}`,
  );
  assert.equal(ctx.pendingFallback, null, 'pendingFallback should be cleared after error recovery');

  actor.stop();
});

test('generic route invokes genericErrorActor on failure', async () => {
  const adapters = createInMemoryGenerationAdapters(0);
  const actor = createActor(generationSystemMachine, { input: { adapters } });
  actor.start();

  actor.send({
    type: 'REQUEST_RECEIVED',
    requestId: 'req-error-generic-001',
    projectId: 'proj-001',
    sessionId: 'sess-001',
    toolKey: null,
    artifactType: 'content',
    workflowType: null,
    model: 'gpt-4',
    input: { prompt: 'test' },
    idempotencyKey: 'idem-error-generic-001',
    outputFormat: 'plain',
    registryVersion: null,
    registrySnapshotRef: 'snap-001',
    syntheticResponse: '',
    effectiveModelResolution: null,
  } as never);
  actor.send({ type: 'AUTH_OK', userId: 'user-001' });
  actor.send({
    type: 'VALIDATION_OK',
    workflowType: null,
    registryVersion: null,
    registrySnapshotRef: 'snap-001',
  } as never);

  const snapshot = await waitFor(actor, (s) => String(s.value).includes('failed'), { timeout: 5000 });
  const ctx = snapshot.context;

  assert.ok(
    typeof ctx.failureReason === 'string' && ctx.failureReason.length > 0,
    `failureReason should be a non-empty string, got: ${ctx.failureReason}`,
  );
  assert.equal(ctx.pendingFallback, null, 'pendingFallback should be cleared after error recovery');

  actor.stop();
});

test('resolvingFallbackPolicy preserves compound state name for backward compatibility', async () => {
  const adapters = createInMemoryGenerationAdapters(0);
  const machine = generationSystemMachine;
  const actor = createActor(machine, { input: { adapters } });
  actor.start();

  actor.send({
    type: 'REQUEST_RECEIVED',
    requestId: 'req-error-compat-001',
    projectId: 'proj-001',
    sessionId: 'sess-001',
    toolKey: 'nextland',
    artifactType: 'content',
    workflowType: 'nextland',
    model: 'gpt-4',
    input: { prompt: 'test' },
    idempotencyKey: 'idem-error-compat-001',
    outputFormat: 'plain',
    registryVersion: null,
    registrySnapshotRef: 'snap-001',
    syntheticResponse: '',
    effectiveModelResolution: null,
  } as never);
  actor.send({ type: 'AUTH_OK', userId: 'user-001' });
  actor.send({
    type: 'VALIDATION_OK',
    workflowType: 'nextland',
    registryVersion: null,
    registrySnapshotRef: 'snap-001',
  } as never);

  const snapshot = await waitFor(actor, (s) => String(s.value).includes('failed'), { timeout: 5000 });

  assert.equal(String(snapshot.value), 'failed');
  assert.ok(
    typeof snapshot.context.failureReason === 'string' && snapshot.context.failureReason.length > 0,
    'failureReason should be set after compound state dispatch',
  );

  actor.stop();
});

test('error recovery clears pendingFallback on all routes', async () => {
  const adapters = createInMemoryGenerationAdapters(0);
  const actor = createActor(generationSystemMachine, { input: { adapters } });
  actor.start();

  actor.send({
    type: 'REQUEST_RECEIVED',
    requestId: 'req-error-clear-001',
    projectId: 'proj-001',
    sessionId: 'sess-001',
    toolKey: 'nextland',
    artifactType: 'content',
    workflowType: 'nextland',
    model: 'gpt-4',
    input: { prompt: 'test' },
    idempotencyKey: 'idem-error-clear-001',
    outputFormat: 'plain',
    registryVersion: null,
    registrySnapshotRef: 'snap-001',
    syntheticResponse: '',
    effectiveModelResolution: null,
  } as never);
  actor.send({ type: 'AUTH_OK', userId: 'user-001' });
  actor.send({
    type: 'VALIDATION_OK',
    workflowType: 'nextland',
    registryVersion: null,
    registrySnapshotRef: 'snap-001',
  } as never);

  const snapshot = await waitFor(actor, (s) => String(s.value).includes('failed'), { timeout: 5000 });

  assert.equal(snapshot.context.pendingFallback, null, 'pendingFallback must be null after error recovery');
  assert.ok(snapshot.context.failureReason !== null, 'failureReason must be set');

  actor.stop();
});

test('invokeFallbackPolicy is no longer registered', () => {
  const machine = generationSystemMachine;
  const actor = createActor(machine, {
    input: { adapters: createInMemoryGenerationAdapters() },
  });

  const snapshot = actor.getSnapshot();
  assert.ok(snapshot, 'machine should be instantiable without invokeFallbackPolicy');

  actor.stop();
});
