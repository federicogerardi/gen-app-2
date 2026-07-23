import { describe, expect, it, vi, afterEach } from 'vitest';
import { createActor } from 'xstate';

vi.mock('./briefing-upload.machine', async () => {
  const { createBriefingUploadMachineMock } = await import('../../../test/mocks/briefing-upload-machine.mock');
  return createBriefingUploadMachineMock({ initialState: 'idle' });
});

import { toolPageMachine } from './tool-page.machine';

const activeActors: Array<ReturnType<typeof createActor<typeof toolPageMachine>>> = [];

const createActor_ = () => {
  const actor = createActor(toolPageMachine, {
    input: {
      toolKey: 'funnel-pages',
      projectId: 'project-1',
      model: 'openrouter/auto',
      registrySnapshotRef: 'snapshot:default',
      apiBaseUrl: '',
      capabilities: {},
      userId: 'user-1',
    },
  });
  actor.start();
  activeActors.push(actor);
  return actor;
};

afterEach(() => {
  while (activeActors.length > 0) activeActors.pop()?.stop();
  vi.clearAllMocks();
});

describe('SSE-to-machine integration', () => {
  it('full flow: SUBMIT_JOB -> JOB_PROGRESS x3 -> JOB_COMPLETED -> completed', () => {
    const actor = createActor_();
    actor.send({ type: 'PROGRESS_SYNCED', artifacts: [], intent: 'new', sourceArtifact: null, runRequestPrefix: null });

    actor.send({ type: 'SUBMIT_JOB', jobId: 'job-1' });
    expect(actor.getSnapshot().value).toBe('submitting');
    expect(actor.getSnapshot().context.pendingJobId).toBe('job-1');

    actor.send({ type: 'JOB_PROGRESS', step: 'optin', status: 'running' });
    expect(actor.getSnapshot().value).toBe('running');

    actor.send({ type: 'JOB_PROGRESS', step: 'optin', status: 'done', artifactId: 'art-1' });
    expect(actor.getSnapshot().context.progress.completedSteps.has('optin')).toBe(true);

    actor.send({ type: 'JOB_PROGRESS', step: 'quiz', status: 'running' });
    actor.send({ type: 'JOB_PROGRESS', step: 'quiz', status: 'done', artifactId: 'art-2' });
    expect(actor.getSnapshot().context.progress.completedSteps.has('quiz')).toBe(true);

    actor.send({ type: 'JOB_PROGRESS', step: 'vsl', status: 'running' });
    actor.send({ type: 'JOB_PROGRESS', step: 'vsl', status: 'done', artifactId: 'art-3' });

    actor.send({ type: 'JOB_COMPLETED', sessionId: 'session-1', artifactIds: ['art-1', 'art-2', 'art-3'] });
    expect(actor.getSnapshot().value).toBe('completed');
    expect(actor.getSnapshot().context.pendingJobId).toBeNull();
    expect(actor.getSnapshot().context.errorMessage).toBeNull();
  });

  it('SSE disconnect mid-job: machine stays in running, can be cancelled', () => {
    const actor = createActor_();
    actor.send({ type: 'PROGRESS_SYNCED', artifacts: [], intent: 'new', sourceArtifact: null, runRequestPrefix: null });

    actor.send({ type: 'SUBMIT_JOB', jobId: 'job-2' });
    actor.send({ type: 'JOB_PROGRESS', step: 'optin', status: 'running' });
    actor.send({ type: 'JOB_PROGRESS', step: 'optin', status: 'done', artifactId: 'art-1' });

    expect(actor.getSnapshot().value).toBe('running');
    expect(actor.getSnapshot().context.pendingJobId).toBe('job-2');

    actor.send({ type: 'CANCEL_GENERATION' });
    expect(actor.getSnapshot().value).toEqual({ configuring: 'clean' });
  });

  it('JOB_FAILED mid-job: transits to generationFailed with error message', () => {
    const actor = createActor_();
    actor.send({ type: 'PROGRESS_SYNCED', artifacts: [], intent: 'new', sourceArtifact: null, runRequestPrefix: null });

    actor.send({ type: 'SUBMIT_JOB', jobId: 'job-3' });
    actor.send({ type: 'JOB_PROGRESS', step: 'optin', status: 'running' });
    actor.send({ type: 'JOB_FAILED', reason: 'Rate limit exceeded' });

    expect(actor.getSnapshot().value).toEqual({ configuring: 'generationFailed' });
    expect(actor.getSnapshot().context.errorMessage).toBe('Rate limit exceeded');
    expect(actor.getSnapshot().context.pendingJobId).toBeNull();
  });
});
