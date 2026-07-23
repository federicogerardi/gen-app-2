import { afterEach, describe, expect, it, vi } from 'vitest';
import { createActor } from 'xstate';

vi.mock('./briefing-upload.machine', async () => {
  const { createBriefingUploadMachineMock } = await import('../../../test/mocks/briefing-upload-machine.mock');
  return createBriefingUploadMachineMock({ initialState: 'idle' });
});

import { toolPageMachine } from './tool-page.machine';

const activeActors: Array<ReturnType<typeof createActor<typeof toolPageMachine>>> = [];

const createToolPageActor = () => {
  const actor = createActor(toolPageMachine, {
    input: {
      toolKey: 'funnel-pages',
      projectId: 'project-1',
      model: 'openrouter/auto',
      registrySnapshotRef: 'snapshot:default',
      apiBaseUrl: '',
      capabilities: { toolsUpload: true, toolsJobSystem: true },
      userId: 'user-1',
    },
  });
  actor.start();
  activeActors.push(actor);
  return actor;
};

const syncCanStartFlow = (actor: ReturnType<typeof createToolPageActor>) => {
  actor.send({
    type: 'PROGRESS_SYNCED',
    artifacts: [],
    intent: 'new',
    sourceArtifact: null,
    runRequestPrefix: null,
  });
};

afterEach(() => {
  while (activeActors.length > 0) {
    activeActors.pop()?.stop();
  }
  vi.clearAllMocks();
});

describe('toolPageMachine — ToolWorkflowJob states', () => {
  it('SUBMIT_JOB transitions configuring -> submitting with pendingJobId', () => {
    const actor = createToolPageActor();
    syncCanStartFlow(actor);

    actor.send({ type: 'SUBMIT_JOB', jobId: 'job-1' });

    expect(actor.getSnapshot().value).toBe('submitting');
    expect(actor.getSnapshot().context.pendingJobId).toBe('job-1');
  });

  it('SUBMIT_JOB is rejected by canStartGeneration guard when not ready', () => {
    const actor = createToolPageActor();

    actor.send({ type: 'SUBMIT_JOB', jobId: 'job-1' });

    expect(actor.getSnapshot().value).toEqual({ configuring: 'clean' });
    expect(actor.getSnapshot().context.pendingJobId).toBeNull();
  });

  it('JOB_PROGRESS from submitting -> running', () => {
    const actor = createToolPageActor();
    syncCanStartFlow(actor);

    actor.send({ type: 'SUBMIT_JOB', jobId: 'job-1' });
    expect(actor.getSnapshot().value).toBe('submitting');

    actor.send({ type: 'JOB_PROGRESS', step: 'optin', status: 'running' });

    expect(actor.getSnapshot().value).toBe('running');
  });

  it('JOB_PROGRESS status:done adds step to completedSteps', () => {
    const actor = createToolPageActor();
    syncCanStartFlow(actor);

    actor.send({ type: 'SUBMIT_JOB', jobId: 'job-1' });
    actor.send({ type: 'JOB_PROGRESS', step: 'optin', status: 'running' });
    actor.send({ type: 'JOB_PROGRESS', step: 'optin', status: 'done', artifactId: 'art-1' });

    expect(actor.getSnapshot().context.progress.completedSteps.has('optin')).toBe(true);
    expect(actor.getSnapshot().context.stepArtifactIds.optin).toBe('art-1');
  });

  it('JOB_COMPLETED from running -> completed', () => {
    const actor = createToolPageActor();
    syncCanStartFlow(actor);

    actor.send({ type: 'SUBMIT_JOB', jobId: 'job-1' });
    actor.send({ type: 'JOB_PROGRESS', step: 'optin', status: 'running' });
    actor.send({ type: 'JOB_COMPLETED', sessionId: 'session-1', artifactIds: ['art-1'] });

    expect(actor.getSnapshot().value).toBe('completed');
    expect(actor.getSnapshot().context.pendingJobId).toBeNull();
  });

  it('JOB_FAILED from running -> configuring.generationFailed', () => {
    const actor = createToolPageActor();
    syncCanStartFlow(actor);

    actor.send({ type: 'SUBMIT_JOB', jobId: 'job-1' });
    actor.send({ type: 'JOB_PROGRESS', step: 'optin', status: 'running' });
    actor.send({ type: 'JOB_FAILED', reason: 'LLM timeout' });

    expect(actor.getSnapshot().value).toEqual({ configuring: 'generationFailed' });
    expect(actor.getSnapshot().context.errorMessage).toBe('LLM timeout');
    expect(actor.getSnapshot().context.pendingJobId).toBeNull();
  });

  it('CANCEL_GENERATION from submitting -> configuring.clean', () => {
    const actor = createToolPageActor();
    syncCanStartFlow(actor);

    actor.send({ type: 'SUBMIT_JOB', jobId: 'job-1' });
    expect(actor.getSnapshot().value).toBe('submitting');

    actor.send({ type: 'CANCEL_GENERATION' });

    expect(actor.getSnapshot().value).toEqual({ configuring: 'clean' });
  });

  it('JOB_CANCELLED from running -> configuring.clean', () => {
    const actor = createToolPageActor();
    syncCanStartFlow(actor);

    actor.send({ type: 'SUBMIT_JOB', jobId: 'job-1' });
    actor.send({ type: 'JOB_PROGRESS', step: 'optin', status: 'running' });
    actor.send({ type: 'JOB_CANCELLED' });

    expect(actor.getSnapshot().value).toEqual({ configuring: 'clean' });
    expect(actor.getSnapshot().context.pendingJobId).toBeNull();
  });

  it('existing generating path still works (legacy backward compat)', () => {
    const actor = createToolPageActor();
    syncCanStartFlow(actor);

    actor.send({ type: 'START_GENERATION' });

    expect(actor.getSnapshot().value).toBe('generating');

    actor.send({ type: 'STEP_DONE', step: 'optin' });
    actor.send({ type: 'STEP_DONE', step: 'quiz' });
    actor.send({ type: 'STEP_DONE', step: 'vsl' });

    expect(actor.getSnapshot().value).toBe('completed');
  });
});
