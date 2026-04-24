import test from 'node:test';
import assert from 'node:assert/strict';
import { createActor, waitFor } from 'xstate';

import { createInMemoryGenerationAdapters } from '../adapters';
import { streamTransportMachine } from '../machines';

test('streamTransportMachine reaches success terminal', async () => {
  const adapters = createInMemoryGenerationAdapters();
  const actor = createActor(streamTransportMachine, {
    input: {
      requestId: 'req-stream-ok',
      artifactId: 'artifact-stream-ok',
      model: 'gpt-5.3-codex',
      workflowType: null,
      outputFormat: 'plain',
      registrySnapshotRef: 'snapshot:seed' as never,
      adapters: {
        stream: adapters.stream,
      },
    },
  });

  actor.start();
  actor.send({ type: 'STREAM_READY' });
  actor.send({ type: 'STREAM_CHUNK', chunk: 'hello' });
  actor.send({ type: 'STREAM_COMPLETE' });

  const snapshot = await waitFor(actor, (s) => s.matches('closedSuccess'));
  assert.equal(snapshot.value, 'closedSuccess');
  actor.stop();
});

test('streamTransportMachine reaches failure terminal', async () => {
  const adapters = createInMemoryGenerationAdapters();
  const actor = createActor(streamTransportMachine, {
    input: {
      requestId: 'req-stream-fail',
      artifactId: 'artifact-stream-fail',
      model: 'gpt-5.3-codex',
      workflowType: null,
      outputFormat: 'plain',
      registrySnapshotRef: 'snapshot:seed' as never,
      adapters: {
        stream: adapters.stream,
      },
    },
  });

  actor.start();
  actor.send({ type: 'STREAM_FAIL', reason: 'forced' });

  const snapshot = await waitFor(actor, (s) => s.matches('closedFailure'));
  assert.equal(snapshot.value, 'closedFailure');
  actor.stop();
});
