import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assign, createActor, setup } from 'xstate';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import { isExtractionContextValidForTool } from './extraction-context-validity';

vi.mock('./briefing-upload.machine', () => {
  const briefingUploadMachine = setup({
    types: {
      context: {} as {
        extractionArtifactId: string | null;
        extractionPayload: Record<string, unknown> | null;
        briefingId: string | null;
        fileName: string | null;
        normalizedText: string | null;
        parsedFormat: 'txt' | 'md' | 'docx' | null;
      },
      events: {} as
        | { type: 'FILE_SELECTED'; file: File }
        | { type: 'RESET' }
        | {
            type: 'EXTRACTION_RECOVERED';
            artifactId: string;
            payload: Record<string, unknown>;
            briefingId?: string | null;
            fileName?: string | null;
            normalizedText?: string | null;
            parsedFormat?: 'txt' | 'md' | 'docx' | null;
          },
      input: {} as {
        toolKey: 'funnel-pages' | 'nextland' | 'youtube-lf-script';
        projectId: string;
        apiBaseUrl: string;
        capabilities: Record<string, unknown>;
        userId: string | null;
      },
    },
  }).createMachine({
    id: 'briefingUploadMachine',
    context: {
      extractionArtifactId: null,
      extractionPayload: null,
      briefingId: null,
      fileName: null,
      normalizedText: null,
      parsedFormat: null,
    },
    initial: 'idle',
    states: {
      idle: {
        on: {
          FILE_SELECTED: {
            target: 'ready',
            actions: assign({
              extractionArtifactId: () => 'mock-extraction-artifact',
              extractionPayload: () => ({ topic: 'mock' }),
              briefingId: () => 'mock-briefing-id',
              fileName: ({ event }) => event.file.name,
              normalizedText: () => 'mock brief text',
              parsedFormat: () => 'md',
            }),
          },
          RESET: {
            target: 'idle',
            actions: assign({
              extractionArtifactId: () => null,
              extractionPayload: () => null,
              briefingId: () => null,
              fileName: () => null,
              normalizedText: () => null,
              parsedFormat: () => null,
            }),
          },
          EXTRACTION_RECOVERED: {
            target: 'ready',
            actions: assign({
              extractionArtifactId: ({ event }) => event.artifactId,
              extractionPayload: ({ event }) => event.payload,
              briefingId: ({ event }) => event.briefingId ?? null,
              fileName: ({ event }) => event.fileName ?? null,
              normalizedText: ({ event }) => event.normalizedText ?? null,
              parsedFormat: ({ event }) => event.parsedFormat ?? null,
            }),
          },
        },
      },
      ready: {
        on: {
          RESET: {
            target: 'idle',
            actions: assign({
              extractionArtifactId: () => null,
              extractionPayload: () => null,
              briefingId: () => null,
              fileName: () => null,
              normalizedText: () => null,
              parsedFormat: () => null,
            }),
          },
          EXTRACTION_RECOVERED: {
            target: 'ready',
            actions: assign({
              extractionArtifactId: ({ context }) => context.extractionArtifactId,
              extractionPayload: ({ context }) => context.extractionPayload,
              briefingId: ({ context }) => context.briefingId,
              fileName: ({ context }) => context.fileName,
              normalizedText: ({ context }) => context.normalizedText,
              parsedFormat: ({ context }) => context.parsedFormat,
            }),
          },
        },
      },
    },
  });

  const hasReadyBriefingExtractionContext = (
    toolKey: 'funnel-pages' | 'nextland' | 'youtube-lf-script',
    briefingActorRef: { getSnapshot?: () => { matches: (value: string) => boolean; context: {
      extractionArtifactId: string | null;
      extractionPayload: Record<string, unknown> | null;
      briefingId: string | null;
      normalizedText: string | null;
    } } } | null,
  ) => {
    const snapshot = briefingActorRef?.getSnapshot?.();
    return snapshot?.matches('ready')
      && (snapshot.context.extractionArtifactId?.trim().length ?? 0) > 0
      && (snapshot.context.briefingId?.trim().length ?? 0) > 0
      && isExtractionContextValidForTool(
        toolKey,
        snapshot.context.extractionPayload,
        snapshot.context.normalizedText,
      );
  };

  return { briefingUploadMachine, hasReadyBriefingExtractionContext };
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
      capabilities: { toolsUpload: true },
      userId: 'user-1',
    },
  });

  actor.start();
  activeActors.push(actor);
  return actor;
};

const createYoutubeToolPageActor = () => {
  const actor = createActor(toolPageMachine, {
    input: {
      toolKey: 'youtube-lf-script',
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

const createNextlandToolPageActor = () => {
  const actor = createActor(toolPageMachine, {
    input: {
      toolKey: 'nextland',
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

// Phase 3: syncCanStartFlow non passa più boolean readiness — la macchina li deriva internamente.
// Il briefing actor dev'essere in stato ready (via BRIEFING_FILE_SELECTED) prima di chiamare questa helper.
const syncCanStartFlow = (actor: ReturnType<typeof createToolPageActor>) => {
  actor.send({
    type: 'PROGRESS_SYNCED',
    artifacts: [],
    intent: 'new',
    sourceArtifact: null,
    runRequestPrefix: null,
  });
};

describe('toolPageMachine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    while (activeActors.length > 0) {
      activeActors.pop()?.stop();
    }
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

    syncCanStartFlow(actor);

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
    syncCanStartFlow(actor);
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
    syncCanStartFlow(actor);
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
      workflowType: 'funnel_pages',
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
        workflowType: 'funnel_pages',
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
        workflowType: 'funnel_pages',
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
          workflowType: 'funnel_pages',
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
        workflowType: 'funnel_pages',
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
          workflowType: 'funnel_pages',
          input: { step: 'quiz' },
        },
      },
    ] satisfies GenerationArtifact[];

    // Phase 3: briefing actor in ready per derivare hasExtractionContext = true
    actor.send({ type: 'BRIEFING_FILE_SELECTED', file: new File(['brief'], 'brief.md', { type: 'text/markdown' }) });

    actor.send({
      type: 'PROGRESS_SYNCED',
      artifacts,
      intent: 'regenerate',
      sourceArtifact,
      runRequestPrefix: null,
    });

    const progress = actor.getSnapshot().context.progress;
    expect([...progress.completedSteps]).toEqual(['optin', 'quiz', 'vsl']);
    expect(progress.lastCheckpointStep).toBe('vsl');
    expect(progress.latestArtifactByStep.optin?.artifactId).toBe('art-optin');

    const viewModel = actor.getSnapshot().context.viewModel;
    expect(viewModel.readiness.canStartFlow).toBe(true);
    expect(viewModel.canonicalState).toBe('prefilled-regenerate');
    expect(viewModel.primaryActionPolicy).toBe('regenerate-current-step');
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
      workflowType: 'funnel_pages',
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
        workflowType: 'funnel_pages',
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
        workflowType: 'funnel_pages',
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
          workflowType: 'funnel_pages',
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
    });

    const progress = actor.getSnapshot().context.progress;
    expect([...progress.completedSteps]).toEqual([]);
    expect(progress.lastCheckpointStep).toBeNull();
    expect(progress.latestArtifactByStep).toEqual({});
  });

  it('computes structured readiness reason codes from PROGRESS_SYNCED signals', () => {
    const actor = createToolPageActor();

    // Phase 3: PROJECT_SELECTED con stringa vuota → hasProject = false
    // briefingActor in idle (nessun FILE_SELECTED) → hasExtractionContext = false (derivato)
    // hasPrimaryTargetStep sempre true per tool con step definiti (derivato)
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
    });

    expect(actor.getSnapshot().context.readiness).toEqual({
      canStartFlow: false,
      hasProject: false,
      hasExtractionContext: false,
      hasPrimaryTargetStep: true,
      reasonCodes: [
        'missing_project',
        'missing_extraction_context',
      ],
    });

    expect(actor.getSnapshot().context.viewModel.readiness).toEqual(actor.getSnapshot().context.readiness);
    expect(actor.getSnapshot().context.viewModel.primaryActionPolicy).toBe('disabled');
  });

  it('requires canonical extraction fields for youtube-lf-script readiness', () => {
    const actor = createYoutubeToolPageActor();

    actor.send({
      type: 'BRIEFING_FILE_SELECTED',
      file: new File(['brief'], 'brief.md', { type: 'text/markdown' }),
    });

    actor.send({
      type: 'PROGRESS_SYNCED',
      artifacts: [],
      intent: 'new',
      sourceArtifact: null,
      runRequestPrefix: null,
    });

    expect(actor.getSnapshot().context.readiness.hasExtractionContext).toBe(false);
  });

  it('enables hasExtractionContext for valid funnel-pages extraction context', () => {
    const actor = createToolPageActor();

    actor.getSnapshot().context.briefingActorRef?.send({
      type: 'EXTRACTION_RECOVERED',
      artifactId: 'artifact-funnel-valid',
      payload: { schemaVersion: 'extraction.v1' },
      briefingId: 'brief-funnel-valid',
      normalizedText: 'brief text',
      parsedFormat: 'md',
    });

    actor.send({
      type: 'PROGRESS_SYNCED',
      artifacts: [],
      intent: 'new',
      sourceArtifact: null,
      runRequestPrefix: null,
    });

    expect(actor.getSnapshot().context.readiness.hasExtractionContext).toBe(true);
  });

  it('keeps hasExtractionContext=false for invalid nextland extraction context', () => {
    const actor = createNextlandToolPageActor();

    actor.getSnapshot().context.briefingActorRef?.send({
      type: 'EXTRACTION_RECOVERED',
      artifactId: 'artifact-nextland-invalid',
      payload: {},
      briefingId: 'brief-nextland-invalid',
      normalizedText: 'brief text',
      parsedFormat: 'md',
    });

    actor.send({
      type: 'PROGRESS_SYNCED',
      artifacts: [],
      intent: 'new',
      sourceArtifact: null,
      runRequestPrefix: null,
    });

    expect(actor.getSnapshot().context.readiness.hasExtractionContext).toBe(false);
    expect(actor.getSnapshot().context.readiness.canStartFlow).toBe(false);
  });

  it('enables hasExtractionContext for valid youtube-lf-script extraction context', () => {
    const actor = createYoutubeToolPageActor();

    actor.getSnapshot().context.briefingActorRef?.send({
      type: 'EXTRACTION_RECOVERED',
      artifactId: 'artifact-youtube-valid',
      payload: {
        knowledge_content: 'Knowledge',
        avatar: 'Avatar',
        pain_point: 'Pain point',
        offer: 'Offer',
        proof: 'Proof',
      },
      briefingId: 'brief-youtube-valid',
      normalizedText: 'brief text',
      parsedFormat: 'md',
    });

    actor.send({
      type: 'PROGRESS_SYNCED',
      artifacts: [],
      intent: 'new',
      sourceArtifact: null,
      runRequestPrefix: null,
    });

    expect(actor.getSnapshot().context.readiness.hasExtractionContext).toBe(true);
    expect(actor.getSnapshot().context.readiness.canStartFlow).toBe(true);
  });

  it('keeps hasExtractionContext=false when briefing actor is ready with empty payload', () => {
    const actor = createToolPageActor();

    actor.send({
      type: 'BRIEFING_FILE_SELECTED',
      file: new File(['brief'], 'brief.md', { type: 'text/markdown' }),
    });

    actor.send({
      type: 'BRIEFING_RESET',
    });

    actor.send({
      type: 'PROGRESS_SYNCED',
      artifacts: [],
      intent: 'new',
      sourceArtifact: null,
      runRequestPrefix: null,
    });

    // Simula un recovery con context semanticamente vuoto (payload senza segnali utili).
    actor.getSnapshot().context.briefingActorRef?.send({
      type: 'EXTRACTION_RECOVERED',
      artifactId: 'artifact-empty',
      payload: {},
      briefingId: 'brief-empty',
      normalizedText: 'brief text',
      parsedFormat: 'md',
    });

    actor.send({
      type: 'PROGRESS_SYNCED',
      artifacts: [],
      intent: 'new',
      sourceArtifact: null,
      runRequestPrefix: null,
    });

    expect(actor.getSnapshot().context.readiness.hasExtractionContext).toBe(false);
    expect(actor.getSnapshot().context.readiness.canStartFlow).toBe(false);
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
        workflowType: 'funnel_pages',
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
          workflowType: 'funnel_pages',
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
        workflowType: 'funnel_pages',
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
          workflowType: 'funnel_pages',
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
        workflowType: 'funnel_pages',
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
          workflowType: 'funnel_pages',
          input: { step: 'vsl' },
        },
      },
    ] satisfies GenerationArtifact[];

    // Phase 3: briefing actor in ready per derivare hasExtractionContext = true
    actor.send({ type: 'BRIEFING_FILE_SELECTED', file: new File(['brief'], 'brief.md', { type: 'text/markdown' }) });

    actor.send({
      type: 'PROGRESS_SYNCED',
      artifacts,
      intent: 'resume',
      sourceArtifact: null,
      runRequestPrefix: null,
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
      workflowType: 'funnel_pages',
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
        workflowType: 'funnel_pages',
        input: {
          step: 'optin',
        },
      },
    } satisfies GenerationArtifact;

    // Phase 3: briefing actor in ready per derivare hasExtractionContext = true
    actor.send({ type: 'BRIEFING_FILE_SELECTED', file: new File(['brief'], 'brief.md', { type: 'text/markdown' }) });

    actor.send({
      type: 'PROGRESS_SYNCED',
      artifacts: [sourceArtifact],
      intent: 'resume',
      sourceArtifact,
      runRequestPrefix: null,
    });

    const snapshot = actor.getSnapshot().context;
    expect(snapshot.readiness.canStartFlow).toBe(true);
    expect(snapshot.viewModel.readiness.canStartFlow).toBe(true);
    expect(snapshot.viewModel.primaryActionPolicy).toBe('resume-checkpoint');
    expect(snapshot.viewModel.canonicalState).toBe('paused-with-checkpoint');
  });

  const makeAllStepsArtifacts = () =>
    [
      {
        artifactId: 'art-optin',
        requestId: 'req-optin',
        projectId: 'project-1',
        artifactType: 'content' as const,
        status: 'completed' as const,
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel_pages',
        content: 'optin content',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
        sourceRequest: {
          requestId: 'req-optin',
          userId: 'user-1',
          projectId: 'project-1',
          artifactType: 'content' as const,
          model: 'openrouter/auto',
          toolKey: 'funnel-pages',
          workflowType: 'funnel_pages',
          input: { step: 'optin' },
        },
      },
      {
        artifactId: 'art-quiz',
        requestId: 'req-quiz',
        projectId: 'project-1',
        artifactType: 'content' as const,
        status: 'completed' as const,
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel_pages',
        content: 'quiz content',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
        sourceRequest: {
          requestId: 'req-quiz',
          userId: 'user-1',
          projectId: 'project-1',
          artifactType: 'content' as const,
          model: 'openrouter/auto',
          toolKey: 'funnel-pages',
          workflowType: 'funnel_pages',
          input: { step: 'quiz' },
        },
      },
      {
        artifactId: 'art-vsl',
        requestId: 'req-vsl',
        projectId: 'project-1',
        artifactType: 'content' as const,
        status: 'completed' as const,
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel_pages',
        content: 'vsl content',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
        sourceRequest: {
          requestId: 'req-vsl',
          userId: 'user-1',
          projectId: 'project-1',
          artifactType: 'content' as const,
          model: 'openrouter/auto',
          toolKey: 'funnel-pages',
          workflowType: 'funnel_pages',
          input: { step: 'vsl' },
        },
      },
    ] satisfies GenerationArtifact[];

  it('returns open-last-artifact when intent=new and all steps completed (TEST-002)', () => {
    const actor = createToolPageActor();

    actor.send({ type: 'BRIEFING_FILE_SELECTED', file: new File(['brief'], 'brief.md', { type: 'text/markdown' }) });
    actor.send({
      type: 'PROGRESS_SYNCED',
      artifacts: makeAllStepsArtifacts(),
      intent: 'new',
      sourceArtifact: null,
      runRequestPrefix: null,
    });

    const vm = actor.getSnapshot().context.viewModel;
    expect(vm.readiness.canStartFlow).toBe(true);
    expect(vm.canonicalState).toBe('completed');
    expect(vm.primaryActionPolicy).toBe('open-last-artifact');
  });

  it('returns open-last-artifact when intent=resume and all steps completed (TEST-003)', () => {
    const actor = createToolPageActor();

    actor.send({ type: 'BRIEFING_FILE_SELECTED', file: new File(['brief'], 'brief.md', { type: 'text/markdown' }) });
    actor.send({
      type: 'PROGRESS_SYNCED',
      artifacts: makeAllStepsArtifacts(),
      intent: 'resume',
      sourceArtifact: null,
      runRequestPrefix: null,
    });

    const vm = actor.getSnapshot().context.viewModel;
    expect(vm.readiness.canStartFlow).toBe(true);
    expect(vm.canonicalState).toBe('completed');
    expect(vm.primaryActionPolicy).toBe('open-last-artifact');
  });

  it('returns regenerate-current-step when intent=regenerate and zero steps completed (TEST-004)', () => {
    const actor = createToolPageActor();

    actor.send({ type: 'BRIEFING_FILE_SELECTED', file: new File(['brief'], 'brief.md', { type: 'text/markdown' }) });
    actor.send({
      type: 'PROGRESS_SYNCED',
      artifacts: [],
      intent: 'regenerate',
      sourceArtifact: null,
      runRequestPrefix: null,
    });

    const vm = actor.getSnapshot().context.viewModel;
    expect(vm.readiness.canStartFlow).toBe(true);
    expect(vm.canonicalState).toBe('prefilled-regenerate');
    expect(vm.primaryActionPolicy).toBe('regenerate-current-step');
  });

  it('returns open-last-artifact when intent=regenerate and current run completed all steps (TEST-005)', () => {
    // Simulates the state after the user clicked "Rilancia" and the new run finished:
    // runRequestPrefix is set (non-null) and all steps of the current run are done.
    // resolveFlowProgressState with a non-null prefix returns ONLY current-run steps
    // (filter: artifact.requestId.startsWith(`${runPrefix}:`)).
    // All 3 steps present → isCurrentRunComplete=true → regenerate branch is skipped →
    // hasCompletedAllSteps branch fires → open-last-artifact.
    const actor = createToolPageActor();
    actor.send({ type: 'BRIEFING_FILE_SELECTED', file: new File(['brief'], 'brief.md', { type: 'text/markdown' }) });

    const runPrefix = 'req-current-run-001';
    const currentRunArtifacts: GenerationArtifact[] = [
      {
        artifactId: 'art-run-optin',
        requestId: `${runPrefix}:optin`,
        projectId: 'project-1',
        artifactType: 'content' as const,
        status: 'completed' as const,
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel_pages',
        content: 'optin content',
        createdAt: '2026-05-05T10:00:00.000Z',
        updatedAt: '2026-05-05T10:00:00.000Z',
        sourceRequest: {
          requestId: `${runPrefix}:optin`,
          userId: 'user-1',
          projectId: 'project-1',
          artifactType: 'content' as const,
          model: 'openrouter/auto',
          toolKey: 'funnel-pages',
          workflowType: 'funnel_pages',
          input: { step: 'optin' },
        },
      },
      {
        artifactId: 'art-run-quiz',
        requestId: `${runPrefix}:quiz`,
        projectId: 'project-1',
        artifactType: 'content' as const,
        status: 'completed' as const,
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel_pages',
        content: 'quiz content',
        createdAt: '2026-05-05T10:01:00.000Z',
        updatedAt: '2026-05-05T10:01:00.000Z',
        sourceRequest: {
          requestId: `${runPrefix}:quiz`,
          userId: 'user-1',
          projectId: 'project-1',
          artifactType: 'content' as const,
          model: 'openrouter/auto',
          toolKey: 'funnel-pages',
          workflowType: 'funnel_pages',
          input: { step: 'quiz' },
        },
      },
      {
        artifactId: 'art-run-vsl',
        requestId: `${runPrefix}:vsl`,
        projectId: 'project-1',
        artifactType: 'content' as const,
        status: 'completed' as const,
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel_pages',
        content: 'vsl content',
        createdAt: '2026-05-05T10:02:00.000Z',
        updatedAt: '2026-05-05T10:02:00.000Z',
        sourceRequest: {
          requestId: `${runPrefix}:vsl`,
          userId: 'user-1',
          projectId: 'project-1',
          artifactType: 'content' as const,
          model: 'openrouter/auto',
          toolKey: 'funnel-pages',
          workflowType: 'funnel_pages',
          input: { step: 'vsl' },
        },
      },
    ];

    actor.send({
      type: 'PROGRESS_SYNCED',
      artifacts: currentRunArtifacts,
      intent: 'regenerate',
      sourceArtifact: null,
      runRequestPrefix: runPrefix,
    });

    const vm = actor.getSnapshot().context.viewModel;
    expect(vm.readiness.canStartFlow).toBe(true);
    expect(vm.canonicalState).toBe('completed');
    expect(vm.primaryActionPolicy).toBe('open-last-artifact');
  });
});

// ---------------------------------------------------------------------------
// Phase 2 – hydration actor (HYDRATE_REQUESTED / success / failure / legacy)
// ---------------------------------------------------------------------------

import type { HydrationResult } from './tool-page.machine';

const makeFetchSuccess = (hydration: Partial<HydrationResult> & { extractionArtifactId: string }) =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        ok: true,
        data: {
          hydration: {
            extractionPayload: { topic: 'test' },
            briefingId: 'brief-1',
            normalizedText: 'brief text',
            parsedFormat: 'md',
            briefingFileName: null,
            ...hydration,
          } satisfies HydrationResult,
        },
      }),
  } as Response);

const makeFetchError = (message: string, code = 'bad_request') =>
  Promise.resolve({
    ok: false,
    json: () => Promise.resolve({ ok: false, error: { code, message } }),
  } as Response);

describe('toolPageMachine – Phase 2 hydration', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('transitions to hydrating on HYDRATE_REQUESTED', () => {
    mockFetch.mockReturnValue(new Promise(() => {/* never resolves */}));

    const actor = createToolPageActor();
    actor.send({ type: 'HYDRATE_REQUESTED', intent: 'new' });

    expect(actor.getSnapshot().value).toBe('hydrating');
    expect(actor.getSnapshot().context.pendingHydration).not.toBeNull();
    expect(actor.getSnapshot().context.hydrationError).toBeNull();
  });

  it('hydration success: transitions back to configuring with hydrationResult set and briefingActor receives EXTRACTION_RECOVERED', async () => {
    mockFetch.mockReturnValue(makeFetchSuccess({ extractionArtifactId: 'ext-1', briefingId: 'brief-1' }));

    const actor = createToolPageActor();
    actor.send({ type: 'HYDRATE_REQUESTED', intent: 'new' });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('configuring');
    });

    const ctx = actor.getSnapshot().context;
    expect(ctx.hydrationResult).not.toBeNull();
    expect(ctx.hydrationResult?.extractionArtifactId).toBe('ext-1');
    expect(ctx.hydrationResult?.briefingId).toBe('brief-1');
    expect(ctx.hydrationResult?.normalizedText).toBe('brief text');
    expect(ctx.hydrationError).toBeNull();
    // briefingActor should have transitioned to ready via EXTRACTION_RECOVERED
    expect(ctx.briefingActorRef?.getSnapshot().matches('ready')).toBe(true);
    expect(ctx.briefingActorRef?.getSnapshot().context.normalizedText).toBe('brief text');
  });

  it('hydration deterministic branch: source extraction artifact is resolved directly', async () => {
    mockFetch.mockReturnValue(makeFetchSuccess({ extractionArtifactId: 'ext-direct', briefingId: 'brief-1' }));

    const actor = createToolPageActor();
    actor.send({
      type: 'HYDRATE_REQUESTED',
      intent: 'new',
      sourceArtifactId: 'ext-direct',
    });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('configuring');
    });

    const ctx = actor.getSnapshot().context;
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/tools/hydrate',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"sourceArtifactId":"ext-direct"'),
      }),
    );
    expect(ctx.hydrationResult?.extractionArtifactId).toBe('ext-direct');
    expect(ctx.readiness.canStartFlow).toBe(true);
  });

  it('hydrates legacy extraction artifact from normalizedText fallback without network', async () => {
    const actor = createToolPageActor();
    actor.send({
      type: 'HYDRATE_REQUESTED',
      intent: 'new',
      sourceArtifactId: 'ext-legacy-local',
      localArtifacts: [
        {
          artifactId: 'ext-legacy-local',
          requestId: 'req-ext-legacy-local',
          projectId: 'project-1',
          artifactType: 'extraction',
          status: 'completed',
          model: 'openrouter/auto',
          toolKey: 'funnel-pages',
          workflowType: 'extraction',
          content: '{"schemaVersion":"extraction.v1"}',
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-01T00:00:00.000Z',
          sourceRequest: {
            requestId: 'req-ext-legacy-local',
            userId: 'user-1',
            projectId: 'project-1',
            artifactType: 'extraction',
            model: 'openrouter/auto',
            toolKey: 'extraction',
            workflowType: 'extraction',
            input: {
              briefingId: 'brief-legacy-local',
              normalizedText: 'legacy brief text',
            },
          },
        },
      ],
    });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('configuring');
    });

    const ctx = actor.getSnapshot().context;
    expect(mockFetch).not.toHaveBeenCalled();
    expect(ctx.hydrationResult?.extractionArtifactId).toBe('ext-legacy-local');
    expect(ctx.hydrationResult?.normalizedText).toBe('legacy brief text');
    expect(ctx.readiness.canStartFlow).toBe(true);
  });

  it('hydrates extraction artifact from fenced JSON payload without network', async () => {
    const actor = createToolPageActor();
    actor.send({
      type: 'HYDRATE_REQUESTED',
      intent: 'new',
      sourceArtifactId: 'ext-fenced-local',
      localArtifacts: [
        {
          artifactId: 'ext-fenced-local',
          requestId: 'req-ext-fenced-local',
          projectId: 'project-1',
          artifactType: 'extraction',
          status: 'completed',
          model: 'openrouter/auto',
          toolKey: 'funnel-pages',
          workflowType: 'extraction',
          content: '```json\n{"payload":{"offer":"test","audience":"cold"}}\n```',
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-01T00:00:00.000Z',
          sourceRequest: {
            requestId: 'req-ext-fenced-local',
            userId: 'user-1',
            projectId: 'project-1',
            artifactType: 'extraction',
            model: 'openrouter/auto',
            toolKey: 'extraction',
            workflowType: 'extraction',
            input: {
              briefingId: 'brief-fenced-local',
              briefingText: 'fenced brief text',
            },
          },
        },
      ],
    });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('configuring');
    });

    const ctx = actor.getSnapshot().context;
    expect(mockFetch).not.toHaveBeenCalled();
    expect(ctx.hydrationResult?.extractionPayload).toEqual({ offer: 'test', audience: 'cold' });
    expect(ctx.readiness.canStartFlow).toBe(true);
  });

  it('hydration deterministic branch: source content artifact resolves via linked extraction lookup', async () => {
    mockFetch.mockReturnValue(makeFetchSuccess({ extractionArtifactId: 'ext-linked', briefingId: 'brief-linked' }));

    const actor = createToolPageActor();
    actor.send({
      type: 'HYDRATE_REQUESTED',
      intent: 'new',
      sourceArtifactId: 'cnt-source',
      resolvedBriefingId: 'brief-linked',
      sourceExtractionArtifactId: 'ext-linked',
    });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('configuring');
    });

    const ctx = actor.getSnapshot().context;
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/tools/hydrate',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"sourceArtifactId":"cnt-source"'),
      }),
    );
    expect(ctx.hydrationResult?.extractionArtifactId).toBe('ext-linked');
    expect(ctx.readiness.canStartFlow).toBe(true);
  });

  it('does not hydrate content source artifact without brief references', async () => {
    mockFetch.mockReturnValue(makeFetchError('missing_extraction_reference', 'bad_request'));

    const actor = createToolPageActor();
    actor.send({
      type: 'HYDRATE_REQUESTED',
      intent: 'new',
      sourceArtifactId: 'cnt-without-refs',
    });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('configuring');
    });

    const ctx = actor.getSnapshot().context;
    expect(ctx.hydrationResult).toBeNull();
    expect(ctx.hydrationError).toBe('missing_extraction_reference');
    expect(ctx.readiness.hasExtractionContext).toBe(false);
    expect(ctx.readiness.canStartFlow).toBe(false);
  });

  it('blocks readiness when hydrate returns incomplete extraction context', async () => {
    mockFetch.mockReturnValue(makeFetchSuccess({
      extractionArtifactId: 'ext-incomplete',
      briefingId: 'brief-incomplete',
      normalizedText: '',
    }));

    const actor = createToolPageActor();
    actor.send({ type: 'HYDRATE_REQUESTED', intent: 'new' });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('configuring');
    });

    const ctx = actor.getSnapshot().context;
    expect(ctx.hydrationResult).toBeNull();
    expect(ctx.hydrationError).toBe('incomplete_extraction_context');
    expect(ctx.readiness.hasExtractionContext).toBe(false);
    expect(ctx.readiness.canStartFlow).toBe(false);
  });

  it('hydration failure: transitions back to configuring with hydrationError set and viewModel.messages.error populated', async () => {
    mockFetch.mockReturnValue(makeFetchError('no_extraction_artifact', 'not_found'));

    const actor = createToolPageActor();
    actor.send({ type: 'HYDRATE_REQUESTED', intent: 'new' });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('configuring');
    });

    const ctx = actor.getSnapshot().context;
    expect(ctx.hydrationError).toBe('no_extraction_artifact');
    expect(ctx.hydrationResult).toBeNull();
    expect(ctx.viewModel.messages.error).toBe('no_extraction_artifact');
  });

  it('hydration legacy: artifact senza briefingId usa artifactId come fallback (TASK-007)', async () => {
    mockFetch.mockReturnValue(makeFetchSuccess({ extractionArtifactId: 'legacy-ext', briefingId: 'legacy-ext' }));

    const actor = createToolPageActor();
    actor.send({ type: 'HYDRATE_REQUESTED', intent: 'resume' });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('configuring');
    });

    const ctx = actor.getSnapshot().context;
    expect(ctx.hydrationResult?.briefingId).toBe('legacy-ext');
    expect(ctx.hydrationResult?.extractionArtifactId).toBe('legacy-ext');
    expect(ctx.hydrationError).toBeNull();
  });

  it('ranking TASK-006: sourceExtractionArtifactId ha precedenza su recency', async () => {
    mockFetch.mockReturnValue(makeFetchSuccess({ extractionArtifactId: 'ext-target', briefingId: 'brief-target' }));

    const actor = createToolPageActor();
    actor.send({
      type: 'HYDRATE_REQUESTED',
      intent: 'resume',
      sourceExtractionArtifactId: 'ext-target',
    });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('configuring');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/tools/hydrate',
      expect.objectContaining({
        body: expect.stringContaining('"sourceExtractionArtifactId":"ext-target"'),
      }),
    );
    expect(actor.getSnapshot().context.hydrationResult?.extractionArtifactId).toBe('ext-target');
  });

  // TASK-017: retry after failure
  it('retry: hydration failure seguita da HYDRATE_REQUESTED valido azzera hydrationError e produce hydrationResult', async () => {
    // Prima tentativo: fallisce
    mockFetch.mockReturnValueOnce(makeFetchError('no_extraction_artifact', 'not_found'));

    const actor = createToolPageActor();
    actor.send({ type: 'HYDRATE_REQUESTED', intent: 'new' });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('configuring');
    });

    expect(actor.getSnapshot().context.hydrationError).toBe('no_extraction_artifact');
    expect(actor.getSnapshot().context.hydrationResult).toBeNull();

    // Retry: successo
    mockFetch.mockReturnValueOnce(makeFetchSuccess({ extractionArtifactId: 'ext-1', briefingId: 'brief-1' }));

    actor.send({ type: 'HYDRATE_REQUESTED', intent: 'new' });

    // Appena inviato HYDRATE_REQUESTED, macchina torna in hydrating e cancella l'errore
    expect(actor.getSnapshot().value).toBe('hydrating');
    expect(actor.getSnapshot().context.hydrationError).toBeNull();

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('configuring');
    });

    expect(actor.getSnapshot().context.hydrationResult?.extractionArtifactId).toBe('ext-1');
    expect(actor.getSnapshot().context.hydrationError).toBeNull();
  });

  // TASK-017: ranking by resolvedBriefingId
  it('ranking: resolvedBriefingId viene passato al BE endpoint', async () => {
    mockFetch.mockReturnValue(makeFetchSuccess({ extractionArtifactId: 'ext-briefing-match', briefingId: 'brief_target' }));

    const actor = createToolPageActor();
    actor.send({
      type: 'HYDRATE_REQUESTED',
      intent: 'resume',
      resolvedBriefingId: 'brief_target',
    });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('configuring');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/tools/hydrate',
      expect.objectContaining({
        body: expect.stringContaining('"resolvedBriefingId":"brief_target"'),
      }),
    );
    expect(actor.getSnapshot().context.hydrationResult?.extractionArtifactId).toBe('ext-briefing-match');
    expect(actor.getSnapshot().context.hydrationResult?.briefingId).toBe('brief_target');
  });
});
