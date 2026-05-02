import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createActor, setup } from 'xstate';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';

vi.mock('./briefing-upload.machine', () => {
  const briefingUploadMachine = setup({
    types: {
      context: {} as {},
      events: {} as { type: 'FILE_SELECTED'; file: File } | { type: 'RESET' },
      input: {} as {
        toolKey: 'funnel-pages' | 'nextland';
        projectId: string;
        apiBaseUrl: string;
        capabilities: Record<string, unknown>;
        userId: string | null;
      },
    },
  }).createMachine({
    id: 'briefingUploadMachine',
    initial: 'idle',
    states: {
      idle: {
        on: {
          FILE_SELECTED: { target: 'ready' },
          RESET: { target: 'idle' },
        },
      },
      ready: {
        on: {
          RESET: { target: 'idle' },
        },
      },
    },
  });

  return { briefingUploadMachine };
});

import { toolPageMachine } from './tool-page.machine';

const createToolPageActor = () => {
  const actor = createActor(toolPageMachine, {
    input: {
      toolKey: 'funnel-pages',
      projectId: 'project-1',
      model: 'openrouter/auto',
      registrySnapshotRef: 'snapshot:default',
      apiBaseUrl: '',
      capabilities: { toolsUpload: true },
      userId: 'user-1',
    },
  });

  actor.start();
  return actor;
};

const syncCanStartFlow = (actor: ReturnType<typeof createToolPageActor>, canStartFlow: boolean) => {
  actor.send({
    type: 'PROGRESS_SYNCED',
    artifacts: [],
    intent: 'new',
    sourceArtifact: null,
    runRequestPrefix: null,
    hasExtractionContext: canStartFlow,
    hasPrimaryTargetStep: canStartFlow,
  });
};

describe('toolPageMachine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks START_GENERATION when briefing is not ready', () => {
    const actor = createToolPageActor();

    expect(actor.getSnapshot().context.briefingActorRef).not.toBeNull();

    actor.send({ type: 'START_GENERATION' });

    expect(actor.getSnapshot().value).toBe('configuring');
  });

  it('transitions configuring -> generating -> completed when briefing is ready and steps finish', () => {
    const actor = createToolPageActor();

    actor.send({
      type: 'BRIEFING_FILE_SELECTED',
      file: new File(['brief'], 'brief.md', { type: 'text/markdown' }),
    });

    expect(actor.getSnapshot().context.briefingActorRef?.getSnapshot().matches('ready')).toBe(true);

    syncCanStartFlow(actor, true);

    actor.send({ type: 'START_GENERATION' });
    expect(actor.getSnapshot().value).toBe('generating');

    // If START is not forwarded to toolFlowActor, these STEP_DONE events are ignored and state never completes.
    actor.send({ type: 'STEP_DONE', step: 'optin' });
    actor.send({ type: 'STEP_DONE', step: 'quiz' });
    actor.send({ type: 'STEP_DONE', step: 'vsl' });

    expect(actor.getSnapshot().value).toBe('completed');
  });

  it('resets completed state back to configuring', () => {
    const actor = createToolPageActor();

    actor.send({
      type: 'BRIEFING_FILE_SELECTED',
      file: new File(['brief'], 'brief.md', { type: 'text/markdown' }),
    });
    syncCanStartFlow(actor, true);
    actor.send({ type: 'START_GENERATION' });
    actor.send({ type: 'STEP_DONE', step: 'optin' });
    actor.send({ type: 'STEP_DONE', step: 'quiz' });
    actor.send({ type: 'STEP_DONE', step: 'vsl' });

    expect(actor.getSnapshot().value).toBe('completed');

    actor.send({ type: 'RESET' });

    expect(actor.getSnapshot().value).toBe('configuring');
    expect(actor.getSnapshot().context.briefingActorRef).not.toBeNull();
  });

  it('propagates CANCEL_GENERATION and returns to configuring', () => {
    const actor = createToolPageActor();

    actor.send({
      type: 'BRIEFING_FILE_SELECTED',
      file: new File(['brief'], 'brief.md', { type: 'text/markdown' }),
    });
    syncCanStartFlow(actor, true);
    actor.send({ type: 'START_GENERATION' });

    expect(actor.getSnapshot().value).toBe('generating');

    actor.send({ type: 'CANCEL_GENERATION' });

    expect(actor.getSnapshot().value).toBe('configuring');
  });

  it('syncs unified progress in context via PROGRESS_SYNCED', () => {
    const actor = createToolPageActor();

    const sourceArtifact = {
      artifactId: 'art-vsl',
      requestId: 'req-vsl',
      projectId: 'project-1',
      artifactType: 'content',
      status: 'completed',
      model: 'openrouter/auto',
      toolKey: 'funnel-pages',
      workflowType: 'funnel-pages',
      content: 'vsl content',
      createdAt: '2026-05-02T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
      sourceRequest: {
        requestId: 'req-vsl',
        userId: 'user-1',
        projectId: 'project-1',
        artifactType: 'content',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel-pages',
        input: {
          step: 'vsl',
          stepDependencyArtifactIdsByStep: {
            optin: 'art-optin',
            quiz: 'art-quiz',
          },
        },
      },
    } satisfies GenerationArtifact;

    const artifacts = [
      sourceArtifact,
      {
        artifactId: 'art-optin',
        requestId: 'req-optin',
        projectId: 'project-1',
        artifactType: 'content',
        status: 'completed',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel-pages',
        content: 'optin content',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
        sourceRequest: {
          requestId: 'req-optin',
          userId: 'user-1',
          projectId: 'project-1',
          artifactType: 'content',
          model: 'openrouter/auto',
          toolKey: 'funnel-pages',
          workflowType: 'funnel-pages',
          input: { step: 'optin' },
        },
      },
      {
        artifactId: 'art-quiz',
        requestId: 'req-quiz',
        projectId: 'project-1',
        artifactType: 'content',
        status: 'completed',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel-pages',
        content: 'quiz content',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
        sourceRequest: {
          requestId: 'req-quiz',
          userId: 'user-1',
          projectId: 'project-1',
          artifactType: 'content',
          model: 'openrouter/auto',
          toolKey: 'funnel-pages',
          workflowType: 'funnel-pages',
          input: { step: 'quiz' },
        },
      },
    ] satisfies GenerationArtifact[];

    actor.send({
      type: 'PROGRESS_SYNCED',
      artifacts,
      intent: 'regenerate',
      sourceArtifact,
      runRequestPrefix: null,
      hasExtractionContext: true,
      hasPrimaryTargetStep: true,
    });

    const progress = actor.getSnapshot().context.progress;
    expect([...progress.completedSteps]).toEqual(['optin', 'quiz', 'vsl']);
    expect(progress.lastCheckpointStep).toBe('vsl');
    expect(progress.latestArtifactByStep.optin?.artifactId).toBe('art-optin');

    const viewModel = actor.getSnapshot().context.viewModel;
    expect(viewModel.readiness.canStartFlow).toBe(true);
    expect(viewModel.canonicalState).toBe('completed');
    expect(viewModel.primaryActionPolicy).toBe('open-last-artifact');
  });

  it('treats relaunch new from artifact as fresh progress state', () => {
    const actor = createToolPageActor();

    const sourceArtifact = {
      artifactId: 'art-vsl',
      requestId: 'req-vsl',
      projectId: 'project-1',
      artifactType: 'content',
      status: 'completed',
      model: 'openrouter/auto',
      toolKey: 'funnel-pages',
      workflowType: 'funnel-pages',
      content: 'vsl content',
      createdAt: '2026-05-02T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
      sourceRequest: {
        requestId: 'req-vsl',
        userId: 'user-1',
        projectId: 'project-1',
        artifactType: 'content',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel-pages',
        input: {
          step: 'vsl',
          stepDependencyArtifactIdsByStep: {
            optin: 'art-optin',
            quiz: 'art-quiz',
          },
        },
      },
    } satisfies GenerationArtifact;

    const artifacts = [
      sourceArtifact,
      {
        artifactId: 'art-optin',
        requestId: 'req-optin',
        projectId: 'project-1',
        artifactType: 'content',
        status: 'completed',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel-pages',
        content: 'optin content',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
        sourceRequest: {
          requestId: 'req-optin',
          userId: 'user-1',
          projectId: 'project-1',
          artifactType: 'content',
          model: 'openrouter/auto',
          toolKey: 'funnel-pages',
          workflowType: 'funnel-pages',
          input: { step: 'optin' },
        },
      },
    ] satisfies GenerationArtifact[];

    actor.send({
      type: 'PROGRESS_SYNCED',
      artifacts,
      intent: 'new',
      sourceArtifact,
      runRequestPrefix: null,
      hasExtractionContext: true,
      hasPrimaryTargetStep: true,
    });

    const progress = actor.getSnapshot().context.progress;
    expect([...progress.completedSteps]).toEqual([]);
    expect(progress.lastCheckpointStep).toBeNull();
    expect(progress.latestArtifactByStep).toEqual({});
  });

  it('computes structured readiness reason codes from PROGRESS_SYNCED signals', () => {
    const actor = createToolPageActor();

    actor.send({
      type: 'PROJECT_SELECTED',
      projectId: '',
    });

    actor.send({
      type: 'PROGRESS_SYNCED',
      artifacts: [],
      intent: 'new',
      sourceArtifact: null,
      runRequestPrefix: null,
      hasExtractionContext: false,
      hasPrimaryTargetStep: false,
    });

    expect(actor.getSnapshot().context.readiness).toEqual({
      canStartFlow: false,
      hasProject: false,
      hasExtractionContext: false,
      hasPrimaryTargetStep: false,
      reasonCodes: [
        'missing_project',
        'missing_extraction_context',
        'missing_primary_target_step',
      ],
    });

    expect(actor.getSnapshot().context.viewModel.readiness).toEqual(actor.getSnapshot().context.readiness);
    expect(actor.getSnapshot().context.viewModel.primaryActionPolicy).toBe('disabled');
  });

  it('blocks START_GENERATION when readiness is true but policy is not startable', () => {
    const actor = createToolPageActor();

    const artifacts = [
      {
        artifactId: 'art-optin',
        requestId: 'req-optin',
        projectId: 'project-1',
        artifactType: 'content',
        status: 'completed',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel-pages',
        content: 'optin',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
        sourceRequest: {
          requestId: 'req-optin',
          userId: 'user-1',
          projectId: 'project-1',
          artifactType: 'content',
          model: 'openrouter/auto',
          toolKey: 'funnel-pages',
          workflowType: 'funnel-pages',
          input: { step: 'optin' },
        },
      },
      {
        artifactId: 'art-quiz',
        requestId: 'req-quiz',
        projectId: 'project-1',
        artifactType: 'content',
        status: 'completed',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel-pages',
        content: 'quiz',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
        sourceRequest: {
          requestId: 'req-quiz',
          userId: 'user-1',
          projectId: 'project-1',
          artifactType: 'content',
          model: 'openrouter/auto',
          toolKey: 'funnel-pages',
          workflowType: 'funnel-pages',
          input: { step: 'quiz' },
        },
      },
      {
        artifactId: 'art-vsl',
        requestId: 'req-vsl',
        projectId: 'project-1',
        artifactType: 'content',
        status: 'completed',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel-pages',
        content: 'vsl',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
        sourceRequest: {
          requestId: 'req-vsl',
          userId: 'user-1',
          projectId: 'project-1',
          artifactType: 'content',
          model: 'openrouter/auto',
          toolKey: 'funnel-pages',
          workflowType: 'funnel-pages',
          input: { step: 'vsl' },
        },
      },
    ] satisfies GenerationArtifact[];

    actor.send({
      type: 'PROGRESS_SYNCED',
      artifacts,
      intent: 'resume',
      sourceArtifact: null,
      runRequestPrefix: null,
      hasExtractionContext: true,
      hasPrimaryTargetStep: true,
    });

    expect(actor.getSnapshot().context.readiness.canStartFlow).toBe(true);
    expect(actor.getSnapshot().context.viewModel.primaryActionPolicy).toBe('open-last-artifact');

    actor.send({ type: 'START_GENERATION' });

    expect(actor.getSnapshot().value).toBe('configuring');
  });

  it('keeps readiness and policy coherent for resume checkpoint flow', () => {
    const actor = createToolPageActor();

    const sourceArtifact = {
      artifactId: 'art-optin',
      requestId: 'req-optin',
      projectId: 'project-1',
      artifactType: 'content',
      status: 'completed',
      model: 'openrouter/auto',
      toolKey: 'funnel-pages',
      workflowType: 'funnel-pages',
      content: 'optin content',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      sourceRequest: {
        requestId: 'req-optin',
        userId: 'user-1',
        projectId: 'project-1',
        artifactType: 'content',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel-pages',
        input: {
          step: 'optin',
        },
      },
    } satisfies GenerationArtifact;

    actor.send({
      type: 'PROGRESS_SYNCED',
      artifacts: [sourceArtifact],
      intent: 'resume',
      sourceArtifact,
      runRequestPrefix: null,
      hasExtractionContext: true,
      hasPrimaryTargetStep: true,
    });

    const snapshot = actor.getSnapshot().context;
    expect(snapshot.readiness.canStartFlow).toBe(true);
    expect(snapshot.viewModel.readiness.canStartFlow).toBe(true);
    expect(snapshot.viewModel.primaryActionPolicy).toBe('resume-checkpoint');
    expect(snapshot.viewModel.canonicalState).toBe('paused-with-checkpoint');
  });
});
