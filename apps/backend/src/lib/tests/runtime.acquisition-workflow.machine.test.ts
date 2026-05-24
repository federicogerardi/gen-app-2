import test from 'node:test';
import assert from 'node:assert/strict';
import { createActor } from 'xstate';

import { toolWorkflowMachine } from '../machines/tool-workflow.machine';

test('toolWorkflowMachine merges acquisition payload before downstream completion', async () => {
  const actor = createActor(toolWorkflowMachine, {
    input: {
      registryVersion: 'test-registry',
      requestId: 'req-acq-001',
      toolKey: 'funnel-pages',
      workflowType: 'funnel_pages',
      runMode: 'new',
      steps: [
        { key: 'acquire-context', dependencies: [], type: 'acquisition' },
        { key: 'optin', dependencies: ['acquire-context'], type: 'generation' },
      ],
      dependencyGraph: {
        'acquire-context': [],
        optin: ['acquire-context'],
      },
    },
  });

  actor.start();
  actor.send({ type: 'STEP_START', stepKey: 'acquire-context' });
  actor.send({
    type: 'STEP_SUCCESS',
    stepKey: 'acquire-context',
    output: JSON.stringify({ source: 'api', campaign: 'spring-launch' }),
    artifactId: 'artifact-acq-001',
  });

  const snapshotAfterAcquisition = actor.getSnapshot();
  assert.deepEqual(snapshotAfterAcquisition.context.assembledGenerationInput, {
    acquisition: {
      source: 'api',
      campaign: 'spring-launch',
    },
  });

  actor.send({ type: 'STEP_START', stepKey: 'optin' });
  actor.send({
    type: 'STEP_SUCCESS',
    stepKey: 'optin',
    output: 'generated-content',
    artifactId: 'artifact-optin-001',
  });

  const doneSnapshot = actor.getSnapshot();
  assert.equal(doneSnapshot.status, 'done');
});

test('toolWorkflowMachine ignores invalid acquisition json output', async () => {
  const actor = createActor(toolWorkflowMachine, {
    input: {
      registryVersion: 'test-registry',
      requestId: 'req-acq-002',
      toolKey: 'funnel-pages',
      workflowType: 'funnel_pages',
      runMode: 'new',
      steps: [
        { key: 'acquire-context', dependencies: [], type: 'acquisition' },
      ],
      dependencyGraph: {
        'acquire-context': [],
      },
    },
  });

  actor.start();
  actor.send({ type: 'STEP_START', stepKey: 'acquire-context' });
  actor.send({
    type: 'STEP_SUCCESS',
    stepKey: 'acquire-context',
    output: 'NOT_JSON',
    artifactId: 'artifact-acq-002',
  });

  const snapshot = actor.getSnapshot();
  assert.deepEqual(snapshot.context.assembledGenerationInput, {});
});

test('toolWorkflowMachine keeps mapped acquisition payload merge-compatible across chained acquisition steps', async () => {
  const actor = createActor(toolWorkflowMachine, {
    input: {
      registryVersion: 'test-registry',
      requestId: 'req-acq-003',
      toolKey: 'angle-generator',
      workflowType: 'angle_generator',
      runMode: 'new',
      steps: [
        { key: 'market-context', dependencies: [], type: 'acquisition' },
        { key: 'audience-context', dependencies: ['market-context'], type: 'acquisition' },
        { key: 'context-and-angle-matrix', dependencies: ['audience-context'], type: 'generation' },
      ],
      dependencyGraph: {
        'market-context': [],
        'audience-context': ['market-context'],
        'context-and-angle-matrix': ['audience-context'],
      },
    },
  });

  actor.start();
  actor.send({ type: 'STEP_START', stepKey: 'market-context' });
  actor.send({
    type: 'STEP_SUCCESS',
    stepKey: 'market-context',
    output: JSON.stringify({ marketSignals: { trend: 'ugc' } }),
    artifactId: 'artifact-market-context-001',
  });

  actor.send({ type: 'STEP_START', stepKey: 'audience-context' });
  actor.send({
    type: 'STEP_SUCCESS',
    stepKey: 'audience-context',
    output: JSON.stringify({ audienceSignals: { intent: 'high' }, confidence: 0.87 }),
    artifactId: 'artifact-audience-context-001',
  });

  const snapshotAfterAcquisition = actor.getSnapshot();
  assert.deepEqual(snapshotAfterAcquisition.context.assembledGenerationInput, {
    acquisition: {
      marketSignals: { trend: 'ugc' },
      audienceSignals: { intent: 'high' },
      confidence: 0.87,
    },
  });
});

test('toolWorkflowMachine parses typed acquisition envelope with legacy-compatible merge', async () => {
  const actor = createActor(toolWorkflowMachine, {
    input: {
      registryVersion: 'test-registry',
      requestId: 'req-acq-004',
      toolKey: 'funnel-pages',
      workflowType: 'funnel_pages',
      runMode: 'new',
      steps: [{ key: 'acquire-context', dependencies: [], type: 'acquisition' }],
      dependencyGraph: { 'acquire-context': [] },
    },
  });

  actor.start();
  actor.send({ type: 'STEP_START', stepKey: 'acquire-context' });
  actor.send({
    type: 'STEP_SUCCESS',
    stepKey: 'acquire-context',
    output: {
      type: 'ACQUISITION_COMPLETED',
      payload: {
        marketSignals: { trend: 'short-form' },
        confidence: 0.91,
      },
    },
    artifactId: 'artifact-acq-004',
  });

  const snapshot = actor.getSnapshot();
  assert.deepEqual(snapshot.context.assembledGenerationInput, {
    acquisition: {
      marketSignals: { trend: 'short-form' },
      confidence: 0.91,
    },
  });
});

test('toolWorkflowMachine preserves deterministic retry path after acquisition failure', async () => {
  const actor = createActor(toolWorkflowMachine, {
    input: {
      registryVersion: 'test-registry',
      requestId: 'req-acq-005',
      toolKey: 'funnel-pages',
      workflowType: 'funnel_pages',
      runMode: 'new',
      steps: [{ key: 'acquire-context', dependencies: [], type: 'acquisition' }],
      dependencyGraph: { 'acquire-context': [] },
    },
  });

  actor.start();
  actor.send({ type: 'STEP_START', stepKey: 'acquire-context' });
  actor.send({
    type: 'STEP_FAILURE',
    stepKey: 'acquire-context',
    reason: 'upstream timeout',
  });

  const failedSnapshot = actor.getSnapshot();
  assert.equal(String(failedSnapshot.value), 'error');

  actor.send({ type: 'STEP_RETRY', stepKey: 'acquire-context' });
  actor.send({ type: 'STEP_START', stepKey: 'acquire-context' });
  actor.send({
    type: 'STEP_SUCCESS',
    stepKey: 'acquire-context',
    output: JSON.stringify({ marketSignals: { trend: 'ugc' } }),
    artifactId: 'artifact-acq-005',
  });

  const finalSnapshot = actor.getSnapshot();
  assert.equal(finalSnapshot.status, 'done');
  assert.deepEqual(finalSnapshot.context.assembledGenerationInput, {
    acquisition: {
      marketSignals: { trend: 'ugc' },
    },
  });
});
