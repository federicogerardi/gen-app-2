import test from 'node:test';
import assert from 'node:assert/strict';
import { createActor, toPromise, waitFor } from 'xstate';

import { createInMemoryGenerationAdapters } from '../adapters';
import { streamTransportMachine } from '../machines';
import type { StreamTerminatedFailureEvent, StreamTerminatedSuccessEvent } from '../types/xstate';

const FIXED_NOW_ISO = '2026-04-24T10:10:00.000Z';
const fixedNow = () => new Date(FIXED_NOW_ISO);

test('streamTransportMachine reaches success terminal', async () => {
  const adapters = createInMemoryGenerationAdapters();
  const visitedStates: string[] = [];
  const actor = createActor(streamTransportMachine, {
    input: {
      requestId: 'req-stream-ok',
      artifactId: 'artifact-stream-ok',
      model: 'gpt-5.3-codex',
      requestInput: { prompt: 'hello' },
      workflowType: null,
      outputFormat: 'plain',
      registrySnapshotRef: 'snapshot:seed' as never,
      runtime: {
        now: fixedNow,
      },
      adapters: {
        stream: adapters.stream,
        llm: adapters.llm,
      },
    },
  });

  actor.subscribe((snapshot) => {
    visitedStates.push(String(snapshot.value));
  });

  actor.start();
  const outputPromise = toPromise(actor) as Promise<StreamTerminatedSuccessEvent>;

  await waitFor(actor, (s) => s.matches('closedSuccess'));
  const finalSnapshot = actor.getSnapshot();
  assert.equal(finalSnapshot.value, 'closedSuccess');
  const output = await outputPromise;
  assert.equal(output.type, 'STREAM_TERMINATED_SUCCESS');
  assert.equal(output.requestId, 'req-stream-ok');
  assert.equal(output.sourceActor, 'streamTransportMachine');
  assert.equal(output.timestamp, FIXED_NOW_ISO);
  assert.equal(output.artifactId, 'artifact-stream-ok');
  assert.match(output.content ?? '', /Generated output for prompt: hello/);

  const firstStreamingIndex = visitedStates.indexOf('streamingTokens');
  const firstClosedIndex = visitedStates.indexOf('closedSuccess');
  assert.ok(firstStreamingIndex >= 0);
  assert.ok(firstClosedIndex > firstStreamingIndex);
  assert.equal(visitedStates.filter((value) => value === 'closedSuccess').length, 1);

  actor.stop();
});

test('streamTransportMachine reaches failure terminal', async () => {
  const adapters = createInMemoryGenerationAdapters();
  adapters.llm.streamText = async function* () {
    throw new Error('forced');
  };

  const actor = createActor(streamTransportMachine, {
    input: {
      requestId: 'req-stream-fail',
      artifactId: 'artifact-stream-fail',
      model: 'gpt-5.3-codex',
      requestInput: { prompt: 'hello fail' },
      workflowType: null,
      outputFormat: 'plain',
      registrySnapshotRef: 'snapshot:seed' as never,
      runtime: {
        now: fixedNow,
      },
      adapters: {
        stream: adapters.stream,
        llm: adapters.llm,
      },
    },
  });

  actor.start();
  const outputPromise = toPromise(actor) as Promise<StreamTerminatedFailureEvent>;

  await waitFor(actor, (s) => s.matches('closedFailure'));
  const finalSnapshot = actor.getSnapshot();
  assert.equal(finalSnapshot.value, 'closedFailure');
  const output = await outputPromise;
  assert.equal(output.type, 'STREAM_TERMINATED_FAILURE');
  assert.equal(output.requestId, 'req-stream-fail');
  assert.equal(output.sourceActor, 'streamTransportMachine');
  assert.equal(output.timestamp, FIXED_NOW_ISO);
  assert.equal(output.artifactId, 'artifact-stream-fail');
  assert.equal(output.reason, 'forced');
  actor.stop();
});
