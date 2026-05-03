import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createActor, setup } from 'xstate';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';

vi.mock('./briefing-upload.machine', () => {
  const briefingUploadMachine = setup({
    types: {
      context: {} as {},
      events: {} as
        | { type: 'FILE_SELECTED'; file: File }
        | { type: 'RESET' }
        | { type: 'EXTRACTION_RECOVERED'; artifactId: string; payload: Record<string, unknown>; briefingId?: string | null; fileName?: string | null },
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
          EXTRACTION_RECOVERED: { target: 'ready' },
        },
      },
      ready: {
        on: {
          RESET: { target: 'idle' },
          EXTRACTION_RECOVERED: { target: 'ready' },
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
});

// ---------------------------------------------------------------------------
// Phase 2 – hydration actor (HYDRATE_REQUESTED / success / failure / legacy)
// ---------------------------------------------------------------------------

vi.mock('../../artifacts/runtime/artifacts-client', () => ({
  listArtifacts: vi.fn(),
  getArtifactById: vi.fn(),
}));

vi.mock('../../generation/runtime/step-hydration', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../generation/runtime/step-hydration')>();
  return {
    ...original,
    buildExtractionContextFromArtifact: vi.fn(original.buildExtractionContextFromArtifact),
  };
});

import { listArtifacts, getArtifactById } from '../../artifacts/runtime/artifacts-client';
import { buildExtractionContextFromArtifact } from '../../generation/runtime/step-hydration';

const makeExtractionArtifact = (overrides: Partial<GenerationArtifact> = {}): GenerationArtifact => ({
  artifactId: 'ext-1',
  requestId: 'req-ext-1',
  projectId: 'project-1',
  artifactType: 'extraction',
  status: 'completed',
  model: 'openrouter/auto',
  toolKey: 'funnel-pages',
  workflowType: 'funnel-pages',
  content: JSON.stringify({ topic: 'test' }),
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  sourceRequest: {
    requestId: 'req-ext-1',
    userId: 'user-1',
    projectId: 'project-1',
    artifactType: 'extraction',
    model: 'openrouter/auto',
    toolKey: 'funnel-pages',
    workflowType: 'funnel-pages',
    input: { briefingId: 'brief-1', toolKey: 'funnel-pages' },
  },
  ...overrides,
});

const makeContentArtifact = (overrides: Partial<GenerationArtifact> = {}): GenerationArtifact => ({
  artifactId: 'cnt-1',
  requestId: 'req-cnt-1',
  projectId: 'project-1',
  artifactType: 'content',
  status: 'completed',
  model: 'openrouter/auto',
  toolKey: 'funnel-pages',
  workflowType: 'funnel-pages',
  content: 'generated content',
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  sourceRequest: {
    requestId: 'req-cnt-1',
    userId: 'user-1',
    projectId: 'project-1',
    artifactType: 'content',
    model: 'openrouter/auto',
    toolKey: 'funnel-pages',
    workflowType: 'funnel-pages',
    input: {
      step: 'optin',
      briefingId: 'brief-1',
      extractionArtifactId: 'ext-1',
    },
  },
  ...overrides,
});

describe('toolPageMachine – Phase 2 hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions to hydrating on HYDRATE_REQUESTED', () => {
    vi.mocked(listArtifacts).mockResolvedValue([]);

    const actor = createToolPageActor();
    actor.send({ type: 'HYDRATE_REQUESTED', intent: 'new' });

    expect(actor.getSnapshot().value).toBe('hydrating');
    expect(actor.getSnapshot().context.pendingHydration).not.toBeNull();
    expect(actor.getSnapshot().context.hydrationError).toBeNull();
  });

  it('hydration success: transitions back to configuring with hydrationResult set and briefingActor receives EXTRACTION_RECOVERED', async () => {
    const extractionArtifact = makeExtractionArtifact();
    vi.mocked(listArtifacts).mockResolvedValue([extractionArtifact]);

    const actor = createToolPageActor();
    actor.send({ type: 'HYDRATE_REQUESTED', intent: 'new', localArtifacts: [extractionArtifact] });

    // Wait for async actor to complete
    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('configuring');
    });

    const ctx = actor.getSnapshot().context;
    expect(ctx.hydrationResult).not.toBeNull();
    expect(ctx.hydrationResult?.extractionArtifactId).toBe('ext-1');
    expect(ctx.hydrationResult?.briefingId).toBe('brief-1');
    expect(ctx.hydrationError).toBeNull();
    // briefingActor should have transitioned to ready via EXTRACTION_RECOVERED
    expect(ctx.briefingActorRef?.getSnapshot().matches('ready')).toBe(true);
  });

  it('hydration deterministic branch: source extraction artifact is resolved directly via getArtifactById', async () => {
    const extractionArtifact = makeExtractionArtifact({ artifactId: 'ext-direct' });
    vi.mocked(getArtifactById).mockResolvedValue(extractionArtifact);

    const actor = createToolPageActor();
    actor.send({
      type: 'HYDRATE_REQUESTED',
      intent: 'new',
      sourceArtifactId: 'ext-direct',
      localArtifacts: [extractionArtifact],
    });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('configuring');
    });

    const ctx = actor.getSnapshot().context;
    expect(vi.mocked(getArtifactById)).toHaveBeenCalledWith(
      'ext-direct',
      expect.objectContaining({ localArtifacts: [extractionArtifact] }),
    );
    expect(vi.mocked(listArtifacts)).not.toHaveBeenCalled();
    expect(ctx.hydrationResult?.extractionArtifactId).toBe('ext-direct');
    expect(ctx.readiness.canStartFlow).toBe(true);
  });

  it('hydration deterministic branch: source content artifact resolves via linked extraction lookup', async () => {
    const contentArtifact = makeContentArtifact({ artifactId: 'cnt-source' });
    const linkedExtraction = makeExtractionArtifact({
      artifactId: 'ext-linked',
      sourceRequest: {
        requestId: 'req-ext-linked',
        userId: 'user-1',
        projectId: 'project-1',
        artifactType: 'extraction',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel-pages',
        input: { briefingId: 'brief-linked', toolKey: 'funnel-pages' },
      },
    });

    vi.mocked(getArtifactById).mockResolvedValue(contentArtifact);
    vi.mocked(listArtifacts).mockResolvedValue([linkedExtraction]);

    const actor = createToolPageActor();
    actor.send({
      type: 'HYDRATE_REQUESTED',
      intent: 'new',
      sourceArtifactId: 'cnt-source',
      resolvedBriefingId: 'brief-linked',
      sourceExtractionArtifactId: 'ext-linked',
      localArtifacts: [contentArtifact, linkedExtraction],
    });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('configuring');
    });

    const ctx = actor.getSnapshot().context;
    expect(vi.mocked(getArtifactById)).toHaveBeenCalledWith(
      'cnt-source',
      expect.objectContaining({ localArtifacts: [contentArtifact, linkedExtraction] }),
    );
    expect(vi.mocked(listArtifacts)).toHaveBeenCalled();
    expect(ctx.hydrationResult?.extractionArtifactId).toBe('ext-linked');
    expect(ctx.readiness.canStartFlow).toBe(true);
  });

  it('does not hydrate content source artifact without brief references', async () => {
    const contentArtifactWithoutRefs = makeContentArtifact({
      artifactId: 'cnt-without-refs',
      sourceRequest: {
        requestId: 'req-cnt-without-refs',
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
    });

    vi.mocked(getArtifactById).mockResolvedValue(contentArtifactWithoutRefs);
    vi.mocked(listArtifacts).mockResolvedValue([makeExtractionArtifact({ artifactId: 'ext-unrelated' })]);

    const actor = createToolPageActor();
    actor.send({
      type: 'HYDRATE_REQUESTED',
      intent: 'new',
      sourceArtifactId: 'cnt-without-refs',
      localArtifacts: [contentArtifactWithoutRefs],
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

  it('hydration failure: transitions back to configuring with hydrationError set and viewModel.messages.error populated', async () => {
    vi.mocked(listArtifacts).mockResolvedValue([]);

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
    // Legacy extraction artifact: nessun briefingId in sourceRequest.input
    const legacyArtifact = makeExtractionArtifact({
      artifactId: 'legacy-ext',
      sourceRequest: {
        requestId: 'req-legacy',
        userId: 'user-1',
        projectId: 'project-1',
        artifactType: 'extraction',
        model: 'openrouter/auto',
        toolKey: null,
        workflowType: null,
        input: {},  // nessun briefingId
      },
    });
    vi.mocked(listArtifacts).mockResolvedValue([legacyArtifact]);

    const actor = createToolPageActor();
    actor.send({ type: 'HYDRATE_REQUESTED', intent: 'resume' });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('configuring');
    });

    const ctx = actor.getSnapshot().context;
    // briefingId fallback = artifactId del legacy artifact
    expect(ctx.hydrationResult?.briefingId).toBe('legacy-ext');
    expect(ctx.hydrationResult?.extractionArtifactId).toBe('legacy-ext');
    expect(ctx.hydrationError).toBeNull();
  });

  it('ranking TASK-006: sourceExtractionArtifactId ha precedenza su recency', async () => {
    const older = makeExtractionArtifact({
      artifactId: 'ext-target',
      updatedAt: '2026-04-01T00:00:00.000Z',
      sourceRequest: {
        requestId: 'r1',
        userId: 'u1',
        projectId: 'project-1',
        artifactType: 'extraction',
        model: 'm',
        toolKey: null,
        workflowType: null,
        input: { briefingId: 'brief-target' },
      },
    });
    const newer = makeExtractionArtifact({
      artifactId: 'ext-newer',
      updatedAt: '2026-05-01T00:00:00.000Z',
      sourceRequest: {
        requestId: 'r2',
        userId: 'u1',
        projectId: 'project-1',
        artifactType: 'extraction',
        model: 'm',
        toolKey: null,
        workflowType: null,
        input: { briefingId: 'brief-other' },
      },
    });
    vi.mocked(listArtifacts).mockResolvedValue([newer, older]);

    const actor = createToolPageActor();
    actor.send({
      type: 'HYDRATE_REQUESTED',
      intent: 'resume',
      sourceExtractionArtifactId: 'ext-target',
    });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('configuring');
    });

    // Nonostante `ext-newer` sia più recente, `ext-target` è il match esatto
    expect(actor.getSnapshot().context.hydrationResult?.extractionArtifactId).toBe('ext-target');
  });

  // TASK-017: retry after failure
  it('retry: hydration failure seguita da HYDRATE_REQUESTED valido azzera hydrationError e produce hydrationResult', async () => {
    // Prima tentativo: fallisce (nessun artifact)
    vi.mocked(listArtifacts).mockResolvedValueOnce([]);

    const actor = createToolPageActor();
    actor.send({ type: 'HYDRATE_REQUESTED', intent: 'new' });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('configuring');
    });

    expect(actor.getSnapshot().context.hydrationError).toBe('no_extraction_artifact');
    expect(actor.getSnapshot().context.hydrationResult).toBeNull();

    // Retry: successo con artifact disponibile
    const extractionArtifact = makeExtractionArtifact();
    vi.mocked(listArtifacts).mockResolvedValueOnce([extractionArtifact]);

    actor.send({ type: 'HYDRATE_REQUESTED', intent: 'new', localArtifacts: [extractionArtifact] });

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
  it('ranking: resolvedBriefingId match vince su recency in assenza di sourceExtractionArtifactId', async () => {
    const olderWithMatch = makeExtractionArtifact({
      artifactId: 'ext-briefing-match',
      updatedAt: '2026-04-01T00:00:00.000Z',
      sourceRequest: {
        requestId: 'r1',
        userId: 'u1',
        projectId: 'project-1',
        artifactType: 'extraction',
        model: 'm',
        toolKey: null,
        workflowType: null,
        input: { briefingId: 'brief-target' },
      },
    });
    const newerNoMatch = makeExtractionArtifact({
      artifactId: 'ext-no-briefing-match',
      updatedAt: '2026-05-01T00:00:00.000Z',
      sourceRequest: {
        requestId: 'r2',
        userId: 'u1',
        projectId: 'project-1',
        artifactType: 'extraction',
        model: 'm',
        toolKey: null,
        workflowType: null,
        input: { briefingId: 'brief-other' },
      },
    });
    vi.mocked(listArtifacts).mockResolvedValue([newerNoMatch, olderWithMatch]);

    const actor = createToolPageActor();
    actor.send({
      type: 'HYDRATE_REQUESTED',
      intent: 'resume',
      resolvedBriefingId: 'brief-target',
    });

    await vi.waitFor(() => {
      expect(actor.getSnapshot().value).toBe('configuring');
    });

    // `ext-briefing-match` vince nonostante sia più vecchio: ha briefingId matching
    expect(actor.getSnapshot().context.hydrationResult?.extractionArtifactId).toBe('ext-briefing-match');
    expect(actor.getSnapshot().context.hydrationResult?.briefingId).toBe('brief-target');
  });
});
