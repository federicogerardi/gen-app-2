import { describe, expect, it, vi, afterEach } from 'vitest';
import { createActor } from 'xstate';

vi.mock('./briefing-upload.machine', async () => {
  const { createBriefingUploadMachineMock } = await import('../../../test/mocks/briefing-upload-machine.mock');
  return createBriefingUploadMachineMock({ initialState: 'idle' });
});

import { toolPageMachine } from './tool-page.machine';
import { buildReactiveViewModel } from './tool-page-view-model';

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

const withReadyContext = (ctx: Record<string, unknown>) => ({
  ...ctx,
  isMachineCompleted: false,
  readiness: {
    ...(ctx.readiness as Record<string, unknown>),
    canStartFlow: true,
    hasExtractionContext: true,
    hasProject: true,
    hasPrimaryTargetStep: true,
    reasonCodes: [],
  },
}) as unknown as Parameters<typeof buildReactiveViewModel>[0];

afterEach(() => {
  while (activeActors.length > 0) activeActors.pop()?.stop();
  vi.clearAllMocks();
});

describe('ViewModel with SSE progress', () => {
  it('0 completed steps -> canonicalState: draft-ready', () => {
    const actor = createActor_();
    actor.send({ type: 'PROGRESS_SYNCED', artifacts: [], intent: 'new', sourceArtifact: null, runRequestPrefix: null });

    const ctx = actor.getSnapshot().context;
    const vm = buildReactiveViewModel(withReadyContext(ctx), 'clean');

    expect(vm.canonicalState).toBe('draft-ready');
  });

  it('1 completed step (not all) -> canonicalState still draft-ready (checkpoint requires PROGRESS_SYNCED)', () => {
    const actor = createActor_();
    actor.send({ type: 'PROGRESS_SYNCED', artifacts: [], intent: 'new', sourceArtifact: null, runRequestPrefix: null });

    actor.send({ type: 'SUBMIT_JOB', jobId: 'job-1' });
    actor.send({ type: 'JOB_PROGRESS', step: 'optin', status: 'done', artifactId: 'art-1' });

    const ctx = actor.getSnapshot().context;
    const vm = buildReactiveViewModel(withReadyContext(ctx), 'clean');

    expect(ctx.progress.completedSteps.has('optin')).toBe(true);
    expect(vm.canonicalState).toBe('draft-ready');
  });

  it('all steps completed via JOB_PROGRESS -> canonicalState: completed', () => {
    const actor = createActor_();
    actor.send({ type: 'PROGRESS_SYNCED', artifacts: [], intent: 'new', sourceArtifact: null, runRequestPrefix: null });

    actor.send({ type: 'SUBMIT_JOB', jobId: 'job-1' });
    actor.send({ type: 'JOB_PROGRESS', step: 'optin', status: 'done', artifactId: 'art-1' });
    actor.send({ type: 'JOB_PROGRESS', step: 'quiz', status: 'done', artifactId: 'art-2' });
    actor.send({ type: 'JOB_PROGRESS', step: 'vsl', status: 'done', artifactId: 'art-3' });

    const ctx = actor.getSnapshot().context;
    const vm = buildReactiveViewModel(withReadyContext(ctx), 'clean');

    expect(ctx.progress.completedSteps.size).toBe(3);
    expect(vm.canonicalState).toBe('completed');
  });

  it('stepArtifactIds populated by JOB_PROGRESS', () => {
    const actor = createActor_();
    actor.send({ type: 'PROGRESS_SYNCED', artifacts: [], intent: 'new', sourceArtifact: null, runRequestPrefix: null });

    actor.send({ type: 'SUBMIT_JOB', jobId: 'job-1' });
    actor.send({ type: 'JOB_PROGRESS', step: 'optin', status: 'done', artifactId: 'art-optin' });

    expect(actor.getSnapshot().context.stepArtifactIds.optin).toBe('art-optin');
  });
});
