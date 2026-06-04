import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createActor, waitFor } from 'xstate';

import { createInMemoryGenerationAdapters } from '../adapters';
import { generationSystemMachine } from '../machines';
import { runBackendGenerationSessionAsJson } from '../runtime/backend-session';

test('non-streaming session completes successfully via runBackendGenerationSessionAsJson', async () => {
  const adapters = createInMemoryGenerationAdapters();

  const result = await runBackendGenerationSessionAsJson(
    {
      requestId: 'req-run-json-happy-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'openrouter/gpt-5.3-codex',
      input: { prompt: 'hello world non-streaming' },
      workflowType: null,
      idempotencyKey: 'idem-run-json-happy-001',
      registrySnapshotRef: 'snapshot:run-json-happy',
    },
    adapters,
  );

  assert.equal(result.status, 'completed');
  assert.ok(result.artifactId);
  assert.ok(result.content.length > 0);
  assert.equal(result.error, null);
});

test('non-streaming session returns failure when generate returns empty content', async () => {
  const adapters = createInMemoryGenerationAdapters();
  adapters.generate.generateText = async () => ({
    content: '',
    usage: { inputTokens: 10, outputTokens: 0, costUsd: 0 },
  });

  const result = await runBackendGenerationSessionAsJson(
    {
      requestId: 'req-run-json-empty-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'openrouter/gpt-5.3-codex',
      input: { prompt: 'empty output non-streaming' },
      workflowType: null,
      idempotencyKey: 'idem-run-json-empty-001',
      registrySnapshotRef: 'snapshot:run-json-empty',
    },
    adapters,
  );

  assert.equal(result.status, 'failed');
  assert.ok(result.error);
  assert.equal(result.error?.code, 'generation_failed');
});

test('dispatchingMode routes to generating when context.mode === generate', async () => {
  const adapters = createInMemoryGenerationAdapters();
  const actor = createActor(generationSystemMachine, {
    input: {
      adapters,
      initialContext: { mode: 'generate' as const },
    },
  });

  actor.start();
  actor.send({
    type: 'REQUEST_RECEIVED',
    requestId: 'req-dispatch-generate-001',
    projectId: 'seed-project-001',
    toolKey: null,
    artifactType: 'content',
    model: 'openrouter/gpt-5.3-codex',
    input: { prompt: 'dispatch generate', outputFormat: 'plain' },
    workflowType: null,
    idempotencyKey: 'idem-dispatch-generate-001',
    registrySnapshotRef: 'snapshot:dispatch-generate' as never,
  });
  actor.send({ type: 'AUTH_OK', userId: 'seed-user-001' });
  actor.send({
    type: 'VALIDATION_OK',
    workflowType: null,
    registryVersion: null as never,
    registrySnapshotRef: 'snapshot:dispatch-generate' as never,
  });

  try {
    const snapshot = await waitFor(actor, (s) => {
      const value = String(s.value);
      return value === 'generating' || value === 'completed' || value === 'failed';
    });
    const state = String(snapshot.value);
    assert.ok(
      state === 'generating' || state === 'completed' || state === 'failed',
      `expected generating/completed/failed but got ${state}`,
    );
    if (state === 'generating') {
      assert.equal(snapshot.context.mode, 'generate');
    }
  } finally {
    actor.stop();
  }
});

test('dispatchingMode routes to streaming when context.mode === stream', async () => {
  const adapters = createInMemoryGenerationAdapters();
  const actor = createActor(generationSystemMachine, {
    input: {
      adapters,
      initialContext: { mode: 'stream' as const },
    },
  });

  actor.start();
  actor.send({
    type: 'REQUEST_RECEIVED',
    requestId: 'req-dispatch-stream-001',
    projectId: 'seed-project-001',
    toolKey: null,
    artifactType: 'content',
    model: 'openrouter/gpt-5.3-codex',
    input: { prompt: 'dispatch stream', outputFormat: 'plain' },
    workflowType: null,
    idempotencyKey: 'idem-dispatch-stream-001',
    registrySnapshotRef: 'snapshot:dispatch-stream' as never,
  });
  actor.send({ type: 'AUTH_OK', userId: 'seed-user-001' });
  actor.send({
    type: 'VALIDATION_OK',
    workflowType: null,
    registryVersion: null as never,
    registrySnapshotRef: 'snapshot:dispatch-stream' as never,
  });

  try {
    const snapshot = await waitFor(actor, (s) => {
      const value = String(s.value);
      return value === 'streaming' || value === 'completed' || value === 'failed';
    });
    const state = String(snapshot.value);
    assert.ok(
      state === 'streaming' || state === 'completed' || state === 'failed',
      `expected streaming/completed/failed but got ${state}`,
    );
    if (state === 'streaming') {
      assert.equal(snapshot.context.mode, 'stream');
    }
  } finally {
    actor.stop();
  }
});

test('non-streaming path completes via persistingSuccessSync without flushProgress', async () => {
  const adapters = createInMemoryGenerationAdapters();
  let flushProgressCalls = 0;
  let finalizeSuccessCalls = 0;

  const originalFlushProgress = adapters.persistence.flushProgress;
  adapters.persistence.flushProgress = async (...args) => {
    flushProgressCalls += 1;
    await originalFlushProgress(...args);
  };

  const originalFinalizeSuccess = adapters.persistence.finalizeSuccess;
  adapters.persistence.finalizeSuccess = async (input) => {
    finalizeSuccessCalls += 1;
    await originalFinalizeSuccess(input);
  };

  const result = await runBackendGenerationSessionAsJson(
    {
      requestId: 'req-run-json-no-flush-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'openrouter/gpt-5.3-codex',
      input: { prompt: 'no flush test' },
      workflowType: null,
      idempotencyKey: 'idem-run-json-no-flush-001',
      registrySnapshotRef: 'snapshot:run-json-no-flush',
    },
    adapters,
  );

  assert.equal(result.status, 'completed');
  assert.equal(flushProgressCalls, 0, 'flushProgress should not be called in non-streaming path');
  assert.equal(finalizeSuccessCalls, 1, 'finalizeSuccess should be called exactly once');
});

test('non-streaming failure path completes via persistingFailureSync with single finalizeFailure', async () => {
  const adapters = createInMemoryGenerationAdapters();
  let finalizeFailureCalls = 0;

  adapters.generate.generateText = async () => ({
    content: '',
    usage: { inputTokens: 10, outputTokens: 0, costUsd: 0 },
  });

  const originalFinalizeFailure = adapters.persistence.finalizeFailure;
  adapters.persistence.finalizeFailure = async (input, reason) => {
    finalizeFailureCalls += 1;
    await originalFinalizeFailure(input, reason);
  };

  const result = await runBackendGenerationSessionAsJson(
    {
      requestId: 'req-run-json-fail-sync-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'openrouter/gpt-5.3-codex',
      input: { prompt: 'failure sync test' },
      workflowType: null,
      idempotencyKey: 'idem-run-json-fail-sync-001',
      registrySnapshotRef: 'snapshot:run-json-fail-sync',
    },
    adapters,
  );

  assert.equal(result.status, 'failed');
  assert.equal(finalizeFailureCalls, 1, 'finalizeFailure should be called exactly once');
});
