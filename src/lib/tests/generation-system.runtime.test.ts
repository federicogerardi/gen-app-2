import test from 'node:test';
import assert from 'node:assert/strict';
import { createActor, fromPromise, waitFor } from 'xstate';

import { createInMemoryGenerationAdapters } from '../adapters';
import {
  generationSystemMachine,
  persistenceBatchMachine,
  toolWorkflowMachine,
} from '../machines';
import { runBackendGenerationSession } from '../runtime/backend-session';

const createCountingToolWorkflowMachine = (counter: { count: number }) =>
  toolWorkflowMachine.provide({
    guards: {
      allRequiredStepsCompleted: ({ context }) => {
        counter.count += 1;
        return context.stepStates.every((step) =>
          step.status === 'done'
            || step.status === 'skipped'
            || context.input.steps.find((candidate) => candidate.key === step.key)?.optional,
        );
      },
    },
  });

const waitForTerminalState = async (
  actor: ReturnType<typeof createActor<typeof generationSystemMachine>>,
  timeoutMs = 2000,
) => {
  let timer: NodeJS.Timeout | undefined;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('timeout waiting for terminal state'));
      }, timeoutMs);
    });

    return await Promise.race([
      waitFor(actor, (s) => {
        const value = String(s.value);
        return value === 'completed' || value === 'failed';
      }),
      timeoutPromise,
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

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

test('backend session emits incremental chunk events while streaming', async () => {
  const adapters = createInMemoryGenerationAdapters();
  adapters.llm.streamText = async function* () {
    yield { type: 'chunk', chunk: 'hello ' };
    yield { type: 'chunk', chunk: 'world' };
    yield {
      type: 'completed',
      usage: {
        inputTokens: 2,
        outputTokens: 3,
        costUsd: 0.00001,
      },
    };
  };

  const result = await runBackendGenerationSession(
    {
      requestId: 'req-root-incremental-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      input: { prompt: 'incremental stream' },
      workflowType: null,
      idempotencyKey: 'idem-root-incremental-001',
      registrySnapshotRef: 'snapshot:root-incremental',
    },
    adapters,
  );

  const chunkEvents = result.streamEvents.filter((event) => event.event === 'chunk');
  assert.equal(chunkEvents.length, 2);
  assert.equal(chunkEvents[0]?.data.sequence, 1);
  assert.equal(chunkEvents[0]?.data.chunk, 'hello ');
  assert.equal(chunkEvents[1]?.data.sequence, 2);
  assert.equal(chunkEvents[1]?.data.chunk, 'world');
  assert.equal(result.content, 'hello world');
});

test('generation fails when stream completes with empty output', async () => {
  const adapters = createInMemoryGenerationAdapters();
  adapters.llm.streamText = async function* () {
    yield {
      type: 'completed',
      usage: {
        inputTokens: 10,
        outputTokens: 0,
        costUsd: 0.000001,
      },
    };
  };

  const result = await runBackendGenerationSession(
    {
      requestId: 'req-root-empty-output-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      input: { prompt: 'empty output case' },
      workflowType: null,
      idempotencyKey: 'idem-root-empty-output-001',
      registrySnapshotRef: 'snapshot:root-empty-output',
    },
    adapters,
  );

  assert.equal(result.status, 'failed');
  assert.equal(result.error?.code, 'generation_failed');
  assert.equal(result.error?.message, 'stream_empty_output');
  assert.equal(result.content, '');
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

test('generation root extraction flow completes from invoke input bootstrap', async () => {
  const adapters = createInMemoryGenerationAdapters();

  const result = await runBackendGenerationSession(
    {
      requestId: 'req-root-extraction-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'extraction',
      model: 'gpt-5.3-codex',
      briefingId: 'briefing-root-001',
      extractionArtifactId: 'artifact-extraction-root-001',
      stepDependencyArtifactIds: ['artifact-dep-root-001'],
      input: {
        prompt: 'extract this',
        briefingText: 'Business B2B con offerta audit e call strategica.',
        tone: 'analitico',
      },
      workflowType: 'extraction',
      idempotencyKey: 'idem-root-extraction-001',
      registrySnapshotRef: 'snapshot:root-extraction',
    },
    adapters,
  );

  assert.equal(result.status, 'completed');
  assert.ok(result.artifactId);
  const payload = JSON.parse(result.content) as Record<string, unknown>;
  assert.equal(payload.schemaVersion, 'extraction.v1');
  assert.equal(payload.briefingId, 'briefing-root-001');
  assert.equal(payload.extractionArtifactId, 'artifact-extraction-root-001');
  assert.deepEqual(payload.stepDependencyArtifactIds, ['artifact-dep-root-001']);
});

test('generation root extraction flow persists as extraction artifact with structured input_json', async () => {
  const adapters = createInMemoryGenerationAdapters();
  let persistedArtifactType: string | null = null;
  let persistedWorkflowType: string | null = null;
  let persistedInputJson: Record<string, unknown> | null = null;

  const originalFinalizeSuccess = adapters.persistence.finalizeSuccess;
  adapters.persistence.finalizeSuccess = async (input) => {
    persistedArtifactType = input.artifactType;
    persistedWorkflowType = input.workflowType;
    persistedInputJson = (input.inputJson ?? null) as Record<string, unknown> | null;
    await originalFinalizeSuccess(input);
  };

  const result = await runBackendGenerationSession(
    {
      requestId: 'req-root-extraction-persistence-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      briefingId: 'briefing-persistence-001',
      input: {
        prompt: 'extract this',
        briefingText: 'Target PMI, promessa: audit in 7 giorni.',
      },
      workflowType: 'extraction',
      idempotencyKey: 'idem-root-extraction-persistence-001',
      registrySnapshotRef: 'snapshot:root-extraction-persistence',
    },
    adapters,
  );

  assert.equal(result.status, 'completed');
  assert.equal(persistedArtifactType, 'extraction');
  assert.equal(persistedWorkflowType, 'extraction');
  assert.ok(persistedInputJson);

  const extraction = (persistedInputJson as { extraction?: Record<string, unknown> }).extraction;
  assert.ok(extraction);
  assert.equal(extraction?.briefingId, 'briefing-persistence-001');
  assert.equal(typeof extraction?.payload, 'object');
});

test('generation root tool flow completes from invoke input bootstrap', async () => {
  const adapters = createInMemoryGenerationAdapters();

  const result = await runBackendGenerationSession(
    {
      requestId: 'req-root-tool-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      input: { prompt: 'tool run' },
      toolKey: 'landing_page',
      workflowType: 'landing_page',
      idempotencyKey: 'idem-root-tool-001',
      registrySnapshotRef: 'snapshot:root-tool',
    },
    adapters,
  );

  assert.equal(result.status, 'completed');
  assert.ok(result.artifactId);
  assert.equal(result.streamEvents[result.streamEvents.length - 1]?.event, 'terminal');
});

test('generation root fails when registry selector is missing', async () => {
  const adapters = createInMemoryGenerationAdapters();
  const actor = createActor(generationSystemMachine, { input: { adapters } });

  actor.start();
  actor.send({
    type: 'REQUEST_RECEIVED',
    requestId: 'req-root-missing-selector-001',
    projectId: 'seed-project-001',
    toolKey: null,
    artifactType: 'content',
    model: 'gpt-5.3-codex',
    input: { prompt: 'missing selector', outputFormat: 'plain' },
    workflowType: null,
    idempotencyKey: 'idem-root-missing-selector-001',
  } as never);

  const snapshot = await waitFor(actor, (s) => String(s.value) === 'failed');
  assert.equal(String(snapshot.value), 'failed');
  assert.equal(snapshot.context.failureReason, 'missing_registry_selector');
  actor.stop();
});

test('generation root completes replay path on idempotency replay', async () => {
  const adapters = createInMemoryGenerationAdapters();
  adapters.idempotency.checkAndClaim = async () => ({
    status: 'replay',
    artifactId: 'artifact-replay-001',
    content: 'cached replay content',
  });

  const result = await runBackendGenerationSession(
    {
      requestId: 'req-root-replay-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      input: { prompt: 'replay me' },
      workflowType: null,
      idempotencyKey: 'idem-root-replay-001',
      registrySnapshotRef: 'snapshot:root-replay',
    },
    adapters,
  );

  assert.equal(result.status, 'completed');
  assert.equal(result.artifactId, 'artifact-replay-001');
  assert.equal(result.content, 'cached replay content');
});

test('generation root does not invoke tool workflow when idempotency replays', async () => {
  const adapters = createInMemoryGenerationAdapters();
  adapters.idempotency.checkAndClaim = async () => ({
    status: 'replay',
    artifactId: 'artifact-replay-tool-001',
    content: 'cached replay content',
  });

  const toolWorkflowCounter = { count: 0 };
  const machine = generationSystemMachine.provide({
    actors: {
      invokeToolWorkflow: createCountingToolWorkflowMachine(toolWorkflowCounter),
    },
  });

  const actor = createActor(machine, { input: { adapters } });
  actor.start();
  actor.send({
    type: 'REQUEST_RECEIVED',
    requestId: 'req-root-tool-replay-001',
    projectId: 'seed-project-001',
    toolKey: 'landing_page',
    artifactType: 'content',
    model: 'gpt-5.3-codex',
    input: { prompt: 'tool run', outputFormat: 'plain' },
    workflowType: 'landing_page',
    idempotencyKey: 'idem-root-tool-replay-001',
    registrySnapshotRef: 'snapshot:root-tool-replay' as never,
  });
  actor.send({ type: 'AUTH_OK', userId: 'seed-user-001' });
  actor.send({
    type: 'VALIDATION_OK',
    workflowType: 'landing_page',
    registryVersion: null as never,
    registrySnapshotRef: 'snapshot:root-tool-replay' as never,
  });

  try {
    const snapshot = await waitFor(actor, (s) => String(s.value) === 'completed');
    assert.equal(String(snapshot.value), 'completed');
    assert.equal(snapshot.context.artifactId, 'artifact-replay-tool-001');
    assert.equal(snapshot.context.contentBuffer, 'cached replay content');
    assert.equal(toolWorkflowCounter.count, 0);
  } finally {
    actor.stop();
  }
});

test('generation root does not invoke tool workflow when usage is rejected', async () => {
  const adapters = createInMemoryGenerationAdapters(0);
  const toolWorkflowCounter = { count: 0 };
  const machine = generationSystemMachine.provide({
    actors: {
      invokeToolWorkflow: createCountingToolWorkflowMachine(toolWorkflowCounter),
    },
  });

  const actor = createActor(machine, { input: { adapters } });
  actor.start();
  actor.send({
    type: 'REQUEST_RECEIVED',
    requestId: 'req-root-tool-usage-rejected-001',
    projectId: 'seed-project-001',
    toolKey: 'landing_page',
    artifactType: 'content',
    model: 'gpt-5.3-codex',
    input: { prompt: 'tool run', outputFormat: 'plain' },
    workflowType: 'landing_page',
    idempotencyKey: 'idem-root-tool-usage-rejected-001',
    registrySnapshotRef: 'snapshot:root-tool-usage-rejected' as never,
  });
  actor.send({ type: 'AUTH_OK', userId: 'seed-user-001' });
  actor.send({
    type: 'VALIDATION_OK',
    workflowType: 'landing_page',
    registryVersion: null as never,
    registrySnapshotRef: 'snapshot:root-tool-usage-rejected' as never,
  });

  try {
    const snapshot = await waitFor(actor, (s) => String(s.value) === 'failed');
    assert.equal(String(snapshot.value), 'failed');
    assert.equal(snapshot.context.failureReason, 'quota_exhausted');
    assert.equal(toolWorkflowCounter.count, 0);
  } finally {
    actor.stop();
  }
});

test('generation root fails on idempotency conflict branch', async () => {
  const adapters = createInMemoryGenerationAdapters();
  adapters.idempotency.checkAndClaim = async () => ({
    status: 'conflict',
    reason: 'idempotency_conflict',
  });

  const result = await runBackendGenerationSession(
    {
      requestId: 'req-root-conflict-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      input: { prompt: 'conflict me' },
      workflowType: null,
      idempotencyKey: 'idem-root-conflict-001',
      registrySnapshotRef: 'snapshot:root-conflict',
    },
    adapters,
  );

  assert.equal(result.status, 'failed');
  assert.equal(result.error?.code, 'idempotency_conflict');
});

test('generation root fails on usage rejected branch', async () => {
  const adapters = createInMemoryGenerationAdapters(0);

  const result = await runBackendGenerationSession(
    {
      requestId: 'req-root-usage-rejected-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      input: { prompt: 'reject usage' },
      workflowType: null,
      idempotencyKey: 'idem-root-usage-rejected-001',
      registrySnapshotRef: 'snapshot:root-usage-rejected',
    },
    adapters,
  );

  assert.equal(result.status, 'failed');
  assert.equal(result.error?.code, 'rate_limited');
});

test('generation root fails on stream failure branch', async () => {
  const adapters = createInMemoryGenerationAdapters();
  adapters.stream.openSession = async () => {
    throw new Error('forced stream open failure');
  };

  const result = await runBackendGenerationSession(
    {
      requestId: 'req-root-stream-failure-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      input: { prompt: 'break stream' },
      workflowType: null,
      idempotencyKey: 'idem-root-stream-failure-001',
      registrySnapshotRef: 'snapshot:root-stream-failure',
    },
    adapters,
  );

  assert.equal(result.status, 'failed');
  assert.equal(result.error?.code, 'generation_failed');
});

test('generation root reaches terminal state on persistence finalize failure branch', async () => {
  const adapters = createInMemoryGenerationAdapters();
  const failingPersistenceMachine = persistenceBatchMachine.provide({
    actors: {
      finalizeSuccess: fromPromise(async (): Promise<{ ok: true }> => {
        throw new Error('forced persistence finalize failure');
      }),
    },
  });
  const machine = generationSystemMachine.provide({
    actors: {
      invokePersistence: failingPersistenceMachine,
    },
  });
  const actor = createActor(machine, { input: { adapters } });

  actor.start();
  actor.send({
    type: 'REQUEST_RECEIVED',
    requestId: 'req-root-persistence-failure-001',
    projectId: 'seed-project-001',
    toolKey: null,
    artifactType: 'content',
    model: 'gpt-5.3-codex',
    input: { prompt: 'force persistence failure', outputFormat: 'plain' },
    workflowType: null,
    idempotencyKey: 'idem-root-persistence-failure-001',
    registrySnapshotRef: 'snapshot:root-persistence-failure' as never,
  });
  actor.send({ type: 'AUTH_OK', userId: 'seed-user-001' });
  actor.send({
    type: 'VALIDATION_OK',
    workflowType: null,
    registryVersion: null as never,
    registrySnapshotRef: 'snapshot:root-persistence-failure' as never,
  });

  try {
    const snapshot = await waitForTerminalState(actor);
    const terminalValue = String(snapshot.value);
    assert.ok(terminalValue === 'failed' || terminalValue === 'completed');
    if (terminalValue === 'failed') {
      assert.equal(snapshot.context.failureReason, 'persistence_finalize_failed');
    }
  } finally {
    actor.stop();
  }
});

test('generation root executes Funnel step chain with dependency metadata and final artifact role', async () => {
  const adapters = createInMemoryGenerationAdapters();
  const persistedInputsByRequestId = new Map<string, Record<string, unknown>>();

  const originalFinalizeSuccess = adapters.persistence.finalizeSuccess;
  adapters.persistence.finalizeSuccess = async (input) => {
    persistedInputsByRequestId.set(input.requestId, (input.inputJson ?? {}) as Record<string, unknown>);
    await originalFinalizeSuccess(input);
  };

  const optin = await runBackendGenerationSession(
    {
      requestId: 'req-root-funnel-optin-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      toolKey: 'funnel-pages',
      workflowType: 'funnel-pages',
      briefingId: 'briefing-funnel-001',
      extractionArtifactId: 'artifact-extraction-funnel-001',
      input: { step: 'optin', intent: 'new' },
      idempotencyKey: 'idem-root-funnel-optin-001',
      registrySnapshotRef: 'snapshot:root-funnel',
    },
    adapters,
  );

  const quiz = await runBackendGenerationSession(
    {
      requestId: 'req-root-funnel-quiz-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      toolKey: 'funnel-pages',
      workflowType: 'funnel-pages',
      briefingId: 'briefing-funnel-001',
      extractionArtifactId: 'artifact-extraction-funnel-001',
      stepDependencyArtifactIds: [optin.artifactId ?? ''],
      input: { step: 'quiz', intent: 'new' },
      idempotencyKey: 'idem-root-funnel-quiz-001',
      registrySnapshotRef: 'snapshot:root-funnel',
    },
    adapters,
  );

  const vsl = await runBackendGenerationSession(
    {
      requestId: 'req-root-funnel-vsl-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      toolKey: 'funnel-pages',
      workflowType: 'funnel-pages',
      briefingId: 'briefing-funnel-001',
      extractionArtifactId: 'artifact-extraction-funnel-001',
      stepDependencyArtifactIds: [optin.artifactId ?? '', quiz.artifactId ?? ''],
      input: { step: 'vsl', intent: 'new' },
      idempotencyKey: 'idem-root-funnel-vsl-001',
      registrySnapshotRef: 'snapshot:root-funnel',
    },
    adapters,
  );

  assert.equal(optin.status, 'completed');
  assert.equal(quiz.status, 'completed');
  assert.equal(vsl.status, 'completed');

  const optinInputJson = persistedInputsByRequestId.get('req-root-funnel-optin-001') ?? {};
  const quizInputJson = persistedInputsByRequestId.get('req-root-funnel-quiz-001') ?? {};
  const vslInputJson = persistedInputsByRequestId.get('req-root-funnel-vsl-001') ?? {};

  const optinWorkflow = (optinInputJson.toolWorkflow ?? {}) as Record<string, unknown>;
  const quizWorkflow = (quizInputJson.toolWorkflow ?? {}) as Record<string, unknown>;
  const vslWorkflow = (vslInputJson.toolWorkflow ?? {}) as Record<string, unknown>;

  assert.equal(optinWorkflow.stepKey, 'optin');
  assert.equal(optinWorkflow.artifactRole, 'step');
  assert.equal(quizWorkflow.stepKey, 'quiz');
  assert.equal(vslWorkflow.stepKey, 'vsl');
  assert.equal(vslWorkflow.artifactRole, 'final');

  assert.deepEqual(quizWorkflow.dependsOnSteps, ['optin']);
  assert.deepEqual(quizWorkflow.dependencyArtifactIds, [optin.artifactId]);
  assert.deepEqual(vslWorkflow.dependsOnSteps, ['optin', 'quiz']);
  assert.deepEqual(vslWorkflow.dependencyArtifactIds, [optin.artifactId, quiz.artifactId]);
});

test('generation root executes Nextland step chain with dependency metadata and final artifact role', async () => {
  const adapters = createInMemoryGenerationAdapters();
  const persistedInputsByRequestId = new Map<string, Record<string, unknown>>();

  const originalFinalizeSuccess = adapters.persistence.finalizeSuccess;
  adapters.persistence.finalizeSuccess = async (input) => {
    persistedInputsByRequestId.set(input.requestId, (input.inputJson ?? {}) as Record<string, unknown>);
    await originalFinalizeSuccess(input);
  };

  const landing = await runBackendGenerationSession(
    {
      requestId: 'req-root-nextland-landing-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      toolKey: 'nextland',
      workflowType: 'nextland',
      briefingId: 'briefing-nextland-001',
      extractionArtifactId: 'artifact-extraction-nextland-001',
      input: { step: 'landing', intent: 'new' },
      idempotencyKey: 'idem-root-nextland-landing-001',
      registrySnapshotRef: 'snapshot:root-nextland',
    },
    adapters,
  );

  const thankYou = await runBackendGenerationSession(
    {
      requestId: 'req-root-nextland-thank-you-001',
      userId: 'seed-user-001',
      projectId: 'seed-project-001',
      artifactType: 'content',
      model: 'gpt-5.3-codex',
      toolKey: 'nextland',
      workflowType: 'nextland',
      briefingId: 'briefing-nextland-001',
      extractionArtifactId: 'artifact-extraction-nextland-001',
      stepDependencyArtifactIds: [landing.artifactId ?? ''],
      input: { step: 'thank_you', intent: 'new' },
      idempotencyKey: 'idem-root-nextland-thank-you-001',
      registrySnapshotRef: 'snapshot:root-nextland',
    },
    adapters,
  );

  assert.equal(landing.status, 'completed');
  assert.equal(thankYou.status, 'completed');

  const landingInputJson = persistedInputsByRequestId.get('req-root-nextland-landing-001') ?? {};
  const thankYouInputJson = persistedInputsByRequestId.get('req-root-nextland-thank-you-001') ?? {};

  const landingWorkflow = (landingInputJson.toolWorkflow ?? {}) as Record<string, unknown>;
  const thankYouWorkflow = (thankYouInputJson.toolWorkflow ?? {}) as Record<string, unknown>;

  assert.equal(landingWorkflow.stepKey, 'landing');
  assert.equal(landingWorkflow.artifactRole, 'step');
  assert.equal(thankYouWorkflow.stepKey, 'thank_you');
  assert.equal(thankYouWorkflow.artifactRole, 'final');
  assert.deepEqual(thankYouWorkflow.dependsOnSteps, ['landing']);
  assert.deepEqual(thankYouWorkflow.dependencyArtifactIds, [landing.artifactId]);
});
