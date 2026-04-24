import test from 'node:test';
import assert from 'node:assert/strict';
import { createActor, waitFor } from 'xstate';

import { createInMemoryGenerationAdapters } from '../adapters';
import { generationSystemMachine } from '../machines';
import { runBackendGenerationSession } from '../runtime/backend-session';

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
