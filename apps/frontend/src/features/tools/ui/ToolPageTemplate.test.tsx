import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { ToolPageTemplate } from './ToolPageTemplate';
import { resolveFlowProgressState } from '../machines/tool-page.machine';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import { useMswHandler } from '../../../test/mocks/server';
import { FeedbackMessageProvider } from '../../../app/providers/FeedbackMessageProvider';
import { GlobalFeedbackViewport } from '../../../app/ui/GlobalFeedbackViewport';

const briefingMachineSeed = vi.hoisted(() => ({
  initialState: 'ready' as 'idle' | 'ready',
  context: {
    projectId: 'project-001',
    toolKey: 'funnel-pages',
    apiBaseUrl: '',
    capabilities: {},
    userId: 'seed-user-001',
    file: null as File | null,
    fileName: null as string | null,
    briefingId: 'brief-001' as string | null,
    extractionArtifactId: 'artifact-extract-001' as string | null,
    extractionPayload: { schemaVersion: 'extraction.v1' } as Record<string, unknown> | null,
    normalizedText: 'brief text' as string | null,
    parsedFormat: 'md' as string | null,
    error: null as string | null,
  },
}));

// Phase 4: briefingUploadMachine mockato per partire in 'ready' con contesto estrazione.
// Consente a deriveHasExtractionContext di restituire true dal primo render,
// e al fallback di startGenerationStep (briefingSnapshot.context) di funzionare.
vi.mock('../machines/briefing-upload.machine', async () => {
  const { setup } = await import('xstate');
  const { isExtractionContextValidForTool } = await import('../machines/extraction-context-validity');
  const briefingUploadMachine = setup({
    types: {
      context: {} as {
        projectId: string;
        toolKey: string;
        apiBaseUrl: string;
        capabilities: Record<string, unknown>;
        userId: string | null;
        file: File | null;
        fileName: string | null;
        briefingId: string | null;
        extractionArtifactId: string | null;
        extractionPayload: Record<string, unknown> | null;
        normalizedText: string | null;
        parsedFormat: string | null;
        error: string | null;
      },
      events: {} as
        | { type: 'FILE_SELECTED'; file: File }
        | { type: 'RESET' }
        | { type: 'INPUT_SYNCED'; projectId: string; apiBaseUrl: string; capabilities: Record<string, unknown>; userId: string | null }
        | {
            type: 'EXTRACTION_RECOVERED';
            artifactId: string;
            payload: Record<string, unknown>;
            briefingId?: string | null;
            fileName?: string | null;
            normalizedText?: string | null;
            parsedFormat?: string | null;
          },
      input: {} as {
        toolKey: string;
        projectId: string;
        apiBaseUrl: string;
        capabilities: Record<string, unknown>;
        userId: string | null;
      },
    },
  }).createMachine({
    id: 'briefingUploadMachine',
    // Parte in 'ready' con contesto estrazione pre-popolato.
    // Serve al fallback briefingSnapshot.context in startGenerationStep.
    // fileName: null → effectiveBriefingFileName scende alla prop/sourceArtifact fallback.
    context: () => ({
      ...briefingMachineSeed.context,
    }),
    initial: briefingMachineSeed.initialState,
    states: {
      idle: {
        on: {
          FILE_SELECTED: { target: 'ready' },
          RESET: { target: 'idle' },
          INPUT_SYNCED: { target: 'idle' },
          EXTRACTION_RECOVERED: { target: 'ready' },
        },
      },
      ready: {
        on: {
          RESET: { target: 'idle' },
          INPUT_SYNCED: { target: 'ready' },
          EXTRACTION_RECOVERED: { target: 'ready' },
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

// Phase 4: la hydration avviene in macchina via artifacts-client locale.
// Con capabilities={} il client usa sempre localArtifacts → nessuna rete.
vi.mock('../../artifacts/runtime/artifacts-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../artifacts/runtime/artifacts-client')>();
  return {
    ...original,
    getArtifactById: async (id: string, options?: { localArtifacts?: GenerationArtifact[] }) => {
      const local = options?.localArtifacts?.find((artifact) => artifact.artifactId === id) ?? null;
      if (local) {
        return local;
      }

      return original.getArtifactById(id, options);
    },
  };
});

const startMock = vi.fn();

type MockExtractionContext = {
  projectId: string;
  briefingId: string;
  extractionArtifactId: string;
  extractionPayload: Record<string, unknown>;
  normalizedText: string;
  parsedFormat: 'md' | 'txt' | 'docx';
  updatedAt: string;
};

const makeExtractionContext = (): MockExtractionContext => ({
  projectId: 'project-001',
  briefingId: 'brief-001',
  extractionArtifactId: 'artifact-extract-001',
  extractionPayload: { schemaVersion: 'extraction.v1' },
  normalizedText: 'brief text',
  parsedFormat: 'md',
  updatedAt: new Date().toISOString(),
});

// Extraction artifact presente in generationState.artifacts per i wiring test.
// La macchina lo trova via localArtifacts (nessuna rete con capabilities={}).
const defaultExtractionArtifact = {
  artifactId: 'artifact-extract-001',
  requestId: 'req-extract-001',
  projectId: 'project-001',
  artifactType: 'extraction' as const,
  status: 'completed' as const,
  model: 'openrouter/auto',
  toolKey: 'funnel-pages',
  workflowType: 'funnel_pages',
  content: JSON.stringify({ schemaVersion: 'extraction.v1' }),
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z',
  sourceRequest: {
    requestId: 'req-extract-001',
    userId: 'seed-user-001',
    projectId: 'project-001',
    artifactType: 'extraction' as const,
    model: 'openrouter/auto',
    toolKey: 'funnel-pages',
    workflowType: 'funnel_pages',
    input: { briefingId: 'brief-001', briefingText: 'brief text', toolKey: 'funnel-pages' },
  },
} satisfies GenerationArtifact;

const briefingState = {
  file: null as File | null,
  fileName: 'brief.md' as string | null,
  error: null as string | null,
  status: 'ready' as 'idle' | 'uploading' | 'extracting' | 'ready',
  extractionContext: makeExtractionContext() as MockExtractionContext | null,
};

let extractionContextState: MockExtractionContext | null = makeExtractionContext();

const renderTemplate = (props: Partial<React.ComponentProps<typeof ToolPageTemplate>> = {}) => render(
  <MemoryRouter>
    <ToolPageTemplate toolKey="funnel-pages" {...props} />
  </MemoryRouter>,
);

const generationState = {
  isStreamActive: false,
  streamStatus: 'idle',
  artifacts: [] as Array<{
    artifactId: string;
    projectId: string;
    status: 'completed' | 'generating' | 'failed';
    toolKey: string;
    sourceRequest?: Record<string, unknown>;
    content?: string;
    [key: string]: unknown;
  }>,
};

const authState = {
  session: { user: { id: 'seed-user-001' } },
  capabilities: { artifacts: true } as Record<string, unknown>,
  apiBaseUrl: '',
};

const generationWorkspaceState = {
  snapshot: { context: { lastRequest: { input: {} } } },
  streamStatus: 'idle',
  isStreamActive: false,
  artifacts: generationState.artifacts,
  focusedProjectId: 'project-001',
  setFocusedProjectId: vi.fn(),
  getExtractionContext: () => extractionContextState,
  upsertExtractionContext: vi.fn(),
  cancel: vi.fn(),
  start: startMock,
};

const availableStepsState = {
  steps: ['optin'] as Array<'optin' | 'quiz' | 'vsl' | 'landing' | 'thank_you'>,
};

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => authState,
}));

vi.mock('../../generation/runtime/GenerationWorkspaceProvider', () => ({
  useGenerationWorkspace: () => generationWorkspaceState,
  useGenerationStreamWorkspace: () => generationWorkspaceState,
  useGenerationArtifactsWorkspace: () => ({
    artifacts: generationWorkspaceState.artifacts,
    reloadArtifacts: vi.fn(),
  }),
  useGenerationProjectWorkspace: () => ({
    focusedProjectId: generationWorkspaceState.focusedProjectId,
    extractionByProject: {},
    setFocusedProjectId: generationWorkspaceState.setFocusedProjectId,
    upsertExtractionContext: generationWorkspaceState.upsertExtractionContext,
    getExtractionContext: generationWorkspaceState.getExtractionContext,
  }),
}));

vi.mock('../../../app/runtime/queries/useProjectsQuery', () => ({
  useProjectsQuery: () => ({
    data: [{ id: 'project-001', name: 'Project 001' }],
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock('../runtime/useToolForm', () => {
  return {
    useToolFormInit: () => ({
      formState: {
        projectId: 'project-001',
        model: 'openrouter/auto',
        tone: 'Professional',
        registrySnapshotRef: 'snapshot:default',
        briefingFile: null,
        briefingFileName: 'brief.md',
        briefingError: null,
        briefingStatus: 'ready',
        selectedSteps: new Set(),
        stepArtifactIds: {},
      },
      setFormState: vi.fn(),
      validation: { isValid: true, errors: {} },
    }),
    useAvailableSteps: () => availableStepsState.steps,
  };
});

describe('ToolPageTemplate wiring', () => {
  beforeEach(() => {
    startMock.mockReset();
    authState.capabilities = { artifacts: true } as Record<string, unknown>;
    generationState.isStreamActive = false;
    generationState.streamStatus = 'idle';
    generationState.artifacts = [defaultExtractionArtifact];
    generationWorkspaceState.streamStatus = 'idle';
    generationWorkspaceState.isStreamActive = false;
    generationWorkspaceState.artifacts = generationState.artifacts;
    generationWorkspaceState.snapshot = { context: { lastRequest: { input: {} } } };
    generationWorkspaceState.focusedProjectId = 'project-001';
    generationWorkspaceState.setFocusedProjectId.mockReset();
    generationWorkspaceState.upsertExtractionContext.mockReset();
    generationWorkspaceState.cancel.mockReset();
    availableStepsState.steps = ['optin'];
    extractionContextState = makeExtractionContext();
    briefingState.file = null;
    briefingState.fileName = 'brief.md';
    briefingState.error = null;
    briefingState.status = 'ready';
    briefingState.extractionContext = makeExtractionContext();
    useMswHandler(
      http.post('/api/tools/orchestrate', async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        const targetStep = typeof body.targetStep === 'string' ? body.targetStep : '';
        const projectId = typeof body.projectId === 'string' ? body.projectId : '';
        const stepDeps: Record<string, string> = {};
        const allArtifacts = generationWorkspaceState.artifacts as Array<{ artifactId: string; projectId: string; status: string; toolKey: string; sourceRequest?: { input?: Record<string, unknown> } }>;
        for (const artifact of allArtifacts) {
          if (artifact.projectId === projectId && artifact.status === 'completed' && artifact.sourceRequest?.input?.step) {
            const s = artifact.sourceRequest.input.step as string;
            if (s !== targetStep) {
              stepDeps[s] = artifact.artifactId;
            }
          }
        }
        return HttpResponse.json({
          ok: true,
          data: {
            orchestration: {
              stepDependencyArtifactIds: Object.values(stepDeps),
              dependencyArtifactIdsByStep: stepDeps,
            },
          },
        });
      }),
    );
    useMswHandler(
      http.get('*/api/artifacts/:artifactId', async ({ params }) => {
        const artifactId = typeof params.artifactId === 'string' ? params.artifactId : '';
        const artifact = generationWorkspaceState.artifacts.find((entry) => entry.artifactId === artifactId);
        if (!artifact) {
          return HttpResponse.json({ ok: false, error: { message: 'not_found' } }, { status: 404 });
        }

        return HttpResponse.json({
          ok: true,
          data: {
            artifact,
          },
        });
      }),
    );
  });

  it('dispatches generation.start with resolved step and dependency metadata', async () => {
    generationState.artifacts = [
      defaultExtractionArtifact,
      {
        artifactId: 'artifact-optin-001',
        projectId: 'project-001',
        status: 'completed',
        toolKey: 'funnel-pages',
        sourceRequest: { input: { step: 'optin' } },
        content: 'optin content',
      },
    ];
    generationWorkspaceState.artifacts = generationState.artifacts;
    availableStepsState.steps = ['quiz'];

    renderTemplate();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /avvia la generazione/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /avvia la generazione/i }));

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledTimes(1);
    });

    const request = startMock.mock.calls[0]?.[0] as {
      input: Record<string, unknown>;
      toolKey: string;
      workflowType: string;
    };

    expect(request.toolKey).toBe('funnel-pages');
    expect(request.workflowType).toBe('funnel_pages');
    expect(request.input.step).toBe('quiz');
    expect(request.input.stepDependencyArtifactIds).toEqual(['artifact-optin-001']);
    expect(request.input.briefingId).toBe('brief-001');
    expect(request.input.briefingText).toBe('brief text');
    expect(request.input.extractionArtifactId).toBe('artifact-extract-001');
    expect(request.input.extractionPayload).toEqual({ schemaVersion: 'extraction.v1' });
  });

  it('auto-starts the next step after previous step completion in auto-chain mode', async () => {
    const { rerender } = renderTemplate();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /avvia la generazione/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /avvia la generazione/i }));

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledTimes(1);
    });

    generationState.streamStatus = 'completed';
    generationState.isStreamActive = false;
    generationState.artifacts = [
      defaultExtractionArtifact,
      {
        artifactId: 'artifact-optin-001',
        projectId: 'project-001',
        status: 'completed',
        toolKey: 'funnel-pages',
        sourceRequest: { input: { step: 'optin' } },
        content: 'optin content',
      },
    ];
    generationWorkspaceState.artifacts = generationState.artifacts;
    availableStepsState.steps = ['quiz'];

    rerender(
      <MemoryRouter>
        <ToolPageTemplate toolKey="funnel-pages" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledTimes(2);
    });

    const secondRequest = startMock.mock.calls[1]?.[0] as { input: Record<string, unknown> };
    expect(secondRequest.input.step).toBe('quiz');
  });

  it('persists extraction context and grows step dependency context incrementally across steps', async () => {
    availableStepsState.steps = ['optin'];
    generationState.artifacts = [defaultExtractionArtifact];
    generationWorkspaceState.artifacts = generationState.artifacts;

    const { rerender } = renderTemplate();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /avvia la generazione/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /avvia la generazione/i }));

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledTimes(1);
    });

    // Step 1: optin
    const firstRequest = startMock.mock.calls[0]?.[0] as { input: Record<string, unknown> };
    expect(firstRequest.input.step).toBe('optin');
    expect(firstRequest.input.briefingId).toBe('brief-001');
    expect(firstRequest.input.briefingText).toBe('brief text');
    expect(firstRequest.input.extractionArtifactId).toBe('artifact-extract-001');
    expect(firstRequest.input.extractionPayload).toEqual({ schemaVersion: 'extraction.v1' });
    expect(firstRequest.input.stepDependencyArtifactIds).toEqual([]);

    // Step 2: quiz (depends on optin)
    generationState.streamStatus = 'completed';
    generationState.isStreamActive = false;
    generationState.artifacts = [
      defaultExtractionArtifact,
      {
        artifactId: 'artifact-optin-001',
        projectId: 'project-001',
        status: 'completed',
        toolKey: 'funnel-pages',
        sourceRequest: { input: { step: 'optin' } },
        content: 'optin content',
      },
    ];
    generationWorkspaceState.artifacts = generationState.artifacts;
    availableStepsState.steps = ['quiz'];

    rerender(
      <MemoryRouter>
        <ToolPageTemplate toolKey="funnel-pages" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledTimes(2);
    });

    const secondRequest = startMock.mock.calls[1]?.[0] as { input: Record<string, unknown> };
    expect(secondRequest.input.step).toBe('quiz');
    expect(secondRequest.input.extractionPayload).toEqual({ schemaVersion: 'extraction.v1' });
    expect(secondRequest.input.stepDependencyArtifactIds).toEqual(['artifact-optin-001']);
    expect(secondRequest.input.stepDependencyArtifactContentsByStep).toEqual({ optin: 'optin content' });

    // Step 3: vsl (depends on optin + quiz)
    generationState.streamStatus = 'completed';
    generationState.isStreamActive = false;
    generationState.artifacts = [
      defaultExtractionArtifact,
      {
        artifactId: 'artifact-optin-001',
        projectId: 'project-001',
        status: 'completed',
        toolKey: 'funnel-pages',
        sourceRequest: { input: { step: 'optin' } },
        content: 'optin content',
      },
      {
        artifactId: 'artifact-quiz-001',
        projectId: 'project-001',
        status: 'completed',
        toolKey: 'funnel-pages',
        sourceRequest: { input: { step: 'quiz' } },
        content: 'quiz content',
      },
    ];
    generationWorkspaceState.artifacts = generationState.artifacts;
    availableStepsState.steps = ['vsl'];

    rerender(
      <MemoryRouter>
        <ToolPageTemplate toolKey="funnel-pages" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledTimes(3);
    });

    const thirdRequest = startMock.mock.calls[2]?.[0] as { input: Record<string, unknown> };
    expect(thirdRequest.input.step).toBe('vsl');
    expect(thirdRequest.input.extractionPayload).toEqual({ schemaVersion: 'extraction.v1' });
    expect(thirdRequest.input.stepDependencyArtifactIds).toEqual(['artifact-optin-001', 'artifact-quiz-001']);
    expect(thirdRequest.input.stepDependencyArtifactContentsByStep).toEqual({
      optin: 'optin content',
      quiz: 'quiz content',
    });
  });

  it('keeps dispatch failure feedback inline and does not emit global feedback', async () => {
    useMswHandler(
      http.post('/api/tools/orchestrate', () => new HttpResponse(null, { status: 500 })),
    );

    render(
      <FeedbackMessageProvider>
        <MemoryRouter>
          <ToolPageTemplate toolKey="funnel-pages" />
        </MemoryRouter>
        <GlobalFeedbackViewport />
      </FeedbackMessageProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /avvia la generazione/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /avvia la generazione/i }));

    expect(
      await screen.findByText('Impossibile avviare la generazione. Controlla la connessione e riprova.'),
    ).toBeInTheDocument();

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

});

describe('resolveFlowProgressState', () => {
  it('uses only the restored checkout for regenerate before a new run starts', () => {
    const sourceArtifact = {
      artifactId: 'art-vsl',
      requestId: 'req-vsl',
      projectId: 'project-001',
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
        projectId: 'project-001',
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
        projectId: 'project-001',
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
          projectId: 'project-001',
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
        projectId: 'project-001',
        artifactType: 'content',
        status: 'completed',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel_pages',
        content: 'quiz content',
        createdAt: '2026-05-01T01:00:00.000Z',
        updatedAt: '2026-05-01T01:00:00.000Z',
        sourceRequest: {
          requestId: 'req-quiz',
          userId: 'user-1',
          projectId: 'project-001',
          artifactType: 'content',
          model: 'openrouter/auto',
          toolKey: 'funnel-pages',
          workflowType: 'funnel_pages',
          input: { step: 'quiz' },
        },
      },
      {
        artifactId: 'art-unrelated-fresh',
        requestId: 'req-unrelated',
        projectId: 'project-001',
        artifactType: 'content',
        status: 'completed',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel_pages',
        content: 'fresh unrelated optin',
        createdAt: '2026-05-03T00:00:00.000Z',
        updatedAt: '2026-05-03T00:00:00.000Z',
        sourceRequest: {
          requestId: 'req-unrelated',
          userId: 'user-1',
          projectId: 'project-001',
          artifactType: 'content',
          model: 'openrouter/auto',
          toolKey: 'funnel-pages',
          workflowType: 'funnel_pages',
          input: { step: 'optin' },
        },
      },
    ] satisfies GenerationArtifact[];

    const result = resolveFlowProgressState(
      artifacts,
      'funnel-pages',
      'project-001',
      null,
      'regenerate',
      sourceArtifact,
      null,
    );

    expect([...result.completedSteps]).toEqual(['optin', 'quiz', 'vsl']);
    expect(result.latestArtifactByStep.optin?.artifactId).toBe('art-optin');
  });

  it('merges restored checkpoint and current run progress for resume', () => {
    const sourceArtifact = {
      artifactId: 'art-optin',
      requestId: 'req-optin',
      projectId: 'project-001',
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
        projectId: 'project-001',
        artifactType: 'content',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel_pages',
        input: { step: 'optin' },
      },
    } satisfies GenerationArtifact;

    const artifacts = [
      sourceArtifact,
      {
        artifactId: 'art-quiz-run',
        requestId: 'resume-run:quiz',
        projectId: 'project-001',
        artifactType: 'content',
        status: 'completed',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel_pages',
        content: 'quiz regenerated',
        createdAt: '2026-05-03T00:00:00.000Z',
        updatedAt: '2026-05-03T00:00:00.000Z',
        sourceRequest: {
          requestId: 'resume-run:quiz',
          userId: 'user-1',
          projectId: 'project-001',
          artifactType: 'content',
          model: 'openrouter/auto',
          toolKey: 'funnel-pages',
          workflowType: 'funnel_pages',
          input: { step: 'quiz' },
        },
      },
    ] satisfies GenerationArtifact[];

    const result = resolveFlowProgressState(
      artifacts,
      'funnel-pages',
      'project-001',
      null,
      'resume',
      sourceArtifact,
      'resume-run',
    );

    expect([...result.completedSteps]).toEqual(['optin', 'quiz']);
    expect(result.lastCheckpointStep).toBe('optin');
    expect(result.latestArtifactByStep.quiz?.artifactId).toBe('art-quiz-run');
  });
});

describe('ToolPageTemplate restore flow', () => {
  beforeEach(() => {
    startMock.mockReset();
    briefingMachineSeed.initialState = 'ready';
    briefingMachineSeed.context = {
      projectId: 'project-001',
      toolKey: 'funnel-pages',
      apiBaseUrl: '',
      capabilities: {},
      userId: 'seed-user-001',
      file: null,
      fileName: null,
      briefingId: 'brief-001',
      extractionArtifactId: 'artifact-extract-001',
      extractionPayload: { schemaVersion: 'extraction.v1' },
      normalizedText: 'brief text',
      parsedFormat: 'md',
      error: null,
    };

    // Handler for /api/tools/orchestrate: restituisce deps vuote (nessuno step completato al momento del click).
    useMswHandler(
      http.post('/api/tools/orchestrate', async () => {
        return HttpResponse.json({
          ok: true,
          data: {
            orchestration: {
              stepDependencyArtifactIds: [],
              dependencyArtifactIdsByStep: {},
            },
          },
        });
      }),
    );
    // Handler for /api/tools/hydrate: resolves hydration from the sourceArtifact's input fields.
    // Required for tests where the extraction artifact is NOT present in localArtifacts
    // and the machine cannot do local resolution (falls through to the network).
    useMswHandler(
      http.post('/api/tools/hydrate', async ({ request }) => {
        const body = await request.json() as Record<string, unknown>;
        const sourceId = typeof body.sourceArtifactId === 'string' ? body.sourceArtifactId : '';
        const artifact = generationState.artifacts.find((a) => a.artifactId === sourceId);
        const sourceInput = (artifact?.sourceRequest?.input ?? {}) as Record<string, unknown>;
        const extractionArtifactId = typeof sourceInput.extractionArtifactId === 'string'
          ? sourceInput.extractionArtifactId
          : `extract-${sourceId}`;
        const briefingId = typeof sourceInput.briefingId === 'string'
          ? sourceInput.briefingId
          : (typeof body.resolvedBriefingId === 'string' ? body.resolvedBriefingId : 'brief-restored');
        return HttpResponse.json({
          ok: true,
          data: {
            hydration: {
              extractionArtifactId,
              extractionPayload: { schemaVersion: 'extraction.v1' },
              briefingId,
              briefingFileName: null,
              normalizedText: typeof sourceInput.briefingText === 'string'
                ? sourceInput.briefingText
                : 'brief restored',
              parsedFormat: 'md',
            },
          },
        });
      }),
    );
  });

  it('restores briefing state and exposes a primary CTA when a completed checkout is restored', async () => {
    extractionContextState = null;
    briefingState.fileName = null;
    briefingState.status = 'idle';
    briefingState.extractionContext = null;
    generationState.artifacts = [
      {
        artifactId: 'source-regenerate-001',
        projectId: 'project-001',
        status: 'completed',
        toolKey: 'funnel-pages',
        sourceRequest: {
          input: {
            briefingId: 'brief-restore-002',
            extractionArtifactId: 'artifact-extract-restore-002',
            briefingFileName: 'restore-regen.md',
            step: 'vsl',
          },
          toolKey: 'funnel-pages',
          workflowType: 'funnel_pages',
        },
        content: 'vsl content',
      },
      {
        artifactId: 'source-regenerate-quiz-001',
        projectId: 'project-001',
        status: 'completed',
        toolKey: 'funnel-pages',
        sourceRequest: {
          input: {
            step: 'quiz',
          },
          toolKey: 'funnel-pages',
          workflowType: 'funnel_pages',
        },
        content: 'quiz content',
      },
      {
        artifactId: 'source-regenerate-optin-001',
        projectId: 'project-001',
        status: 'completed',
        toolKey: 'funnel-pages',
        sourceRequest: {
          input: {
            step: 'optin',
          },
          toolKey: 'funnel-pages',
          workflowType: 'funnel_pages',
        },
        content: 'optin content',
      },
    ];
    generationWorkspaceState.artifacts = generationState.artifacts;
    availableStepsState.steps = [];

    renderTemplate({
      intent: 'regenerate',
      sourceArtifactId: 'source-regenerate-001',
      initialProjectId: 'project-001',
    });

    const primaryActionButton = await waitFor(() => {
      const button = screen.queryByRole('button', { name: /^rigenera$/i })
        ?? screen.queryByRole('button', { name: /riprendi dal checkpoint/i });
      expect(button).toBeInTheDocument();
      return button as HTMLButtonElement;
    });

    expect(primaryActionButton).toBeEnabled();
  });

  it('uses regenerate intent deterministically for artifact-driven relaunch with extraction source', async () => {
    extractionContextState = null;
    briefingState.fileName = null;
    briefingState.status = 'idle';
    briefingState.extractionContext = null;

    generationState.artifacts = [defaultExtractionArtifact];
    generationWorkspaceState.artifacts = generationState.artifacts;
    availableStepsState.steps = ['optin'];

    renderTemplate({
      intent: 'regenerate',
      sourceArtifactId: 'artifact-extract-001',
      initialProjectId: 'project-001',
    });

    const primaryActionButton = await waitFor(() => {
      const button = screen.queryByRole('button', { name: /^rigenera$/i })
        ?? screen.queryByRole('button', { name: /avvia la generazione/i });
      expect(button).toBeInTheDocument();
      return button as HTMLButtonElement;
    });

    fireEvent.click(primaryActionButton);

    await waitFor(() => {
      expect(startMock).toHaveBeenCalled();
    });

    const firstRequest = startMock.mock.calls[0]?.[0] as { input: Record<string, unknown> };
    expect(firstRequest.input.intent).toBe('regenerate');
    expect(firstRequest.input.briefingText).toBe('brief text');
  });

  it('blocks relaunch from extraction artifact when hydration recovers no briefing text', async () => {
    briefingMachineSeed.initialState = 'idle';
    briefingMachineSeed.context = {
      ...briefingMachineSeed.context,
      briefingId: null,
      extractionArtifactId: null,
      extractionPayload: null,
      normalizedText: null,
      parsedFormat: null,
    };
    extractionContextState = null;
    briefingState.fileName = null;
    briefingState.status = 'idle';
    briefingState.extractionContext = null;

    generationState.artifacts = [
      {
        ...defaultExtractionArtifact,
        artifactId: 'artifact-extract-missing-text',
        content: JSON.stringify({ schemaVersion: 'extraction.v1' }),
        sourceRequest: {
          ...defaultExtractionArtifact.sourceRequest,
          input: {
            briefingId: 'brief-missing-text',
            toolKey: 'funnel-pages',
          },
        },
      },
    ];
    generationWorkspaceState.artifacts = generationState.artifacts;
    availableStepsState.steps = ['optin'];

    renderTemplate({
      intent: 'regenerate',
      sourceArtifactId: 'artifact-extract-missing-text',
      initialProjectId: 'project-001',
    });

    const primaryActionButton = await waitFor(() => {
      const button = screen.getByRole('button', { name: /completa il form per iniziare/i });
      expect(button).toBeDisabled();
      return button;
    });

    expect(screen.getByRole('alert')).toHaveTextContent('incomplete_extraction_context');

    fireEvent.click(primaryActionButton);

    expect(startMock).not.toHaveBeenCalled();
  });

  it('uses completed CTA policy without exposing a Visualizza button', async () => {
    extractionContextState = makeExtractionContext();
    briefingState.fileName = 'completed-brief.md';
    briefingState.status = 'ready';
    briefingState.extractionContext = makeExtractionContext();
    generationState.artifacts = [
      defaultExtractionArtifact,
      {
        artifactId: 'art-optin-completed',
        projectId: 'project-001',
        status: 'completed',
        toolKey: 'funnel-pages',
        sourceRequest: {
          input: { step: 'optin' },
        },
        content: 'optin',
      },
      {
        artifactId: 'art-quiz-completed',
        projectId: 'project-001',
        status: 'completed',
        toolKey: 'funnel-pages',
        sourceRequest: {
          input: { step: 'quiz' },
        },
        content: 'quiz',
      },
      {
        artifactId: 'art-vsl-completed',
        projectId: 'project-001',
        status: 'completed',
        toolKey: 'funnel-pages',
        sourceRequest: {
          input: { step: 'vsl' },
        },
        content: 'vsl',
      },
    ];
    generationWorkspaceState.artifacts = generationState.artifacts;
    availableStepsState.steps = [];

    renderTemplate({
      intent: 'new',
      initialProjectId: 'project-001',
      sourceArtifactId: null, // override default: intent='new' senza sourceArtifact → progressState vuoto → hasCompletedAllSteps via generationState
    });

    expect(startMock).not.toHaveBeenCalled();
  });

  it('completed flow keeps the user on the tool page', async () => {
    extractionContextState = makeExtractionContext();
    briefingState.fileName = 'completed-brief.md';
    briefingState.status = 'ready';
    briefingState.extractionContext = makeExtractionContext();
    generationState.artifacts = [
      defaultExtractionArtifact,
      {
        artifactId: 'art-optin-completed',
        projectId: 'project-001',
        status: 'completed',
        toolKey: 'funnel-pages',
        sourceRequest: {
          input: { step: 'optin' },
        },
        content: 'optin',
      },
      {
        artifactId: 'art-quiz-completed',
        projectId: 'project-001',
        status: 'completed',
        toolKey: 'funnel-pages',
        sourceRequest: {
          input: { step: 'quiz' },
        },
        content: 'quiz',
      },
      {
        artifactId: 'art-vsl-completed',
        projectId: 'project-001',
        status: 'completed',
        toolKey: 'funnel-pages',
        sourceRequest: {
          input: { step: 'vsl' },
        },
        content: 'vsl',
      },
    ];
    generationWorkspaceState.artifacts = generationState.artifacts;
    availableStepsState.steps = [];

    render(
      <MemoryRouter initialEntries={['/tools/funnel-pages']}>
        <Routes>
          <Route
            path="/tools/funnel-pages"
            element={<ToolPageTemplate toolKey="funnel-pages" intent="new" initialProjectId="project-001" sourceArtifactId={null} />}
          />
          <Route path="/artifacts" element={<div>Artifacts archive page</div>} />
          <Route path="/artifacts/:artifactId" element={<div>Artifact detail page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText('Artifact detail page')).toBeNull();
    expect(screen.queryByText('Artifacts archive page')).toBeNull();
    expect(startMock).not.toHaveBeenCalled();
  });
});

// TASK-019: CTA regression guard e isolamento cross-tool stream
describe('ToolPageTemplate CTA regression guard', () => {
  beforeEach(() => {
    startMock.mockReset();
    generationState.isStreamActive = false;
    generationState.streamStatus = 'idle';
    generationState.artifacts = [defaultExtractionArtifact];
    generationWorkspaceState.streamStatus = 'idle';
    generationWorkspaceState.isStreamActive = false;
    generationWorkspaceState.artifacts = generationState.artifacts;
    generationWorkspaceState.snapshot = { context: { lastRequest: { input: {} } } };
    generationWorkspaceState.focusedProjectId = 'project-001';
    availableStepsState.steps = ['optin'];
    extractionContextState = makeExtractionContext();
    briefingState.status = 'ready';
    briefingState.extractionContext = makeExtractionContext();
    useMswHandler(
      http.post('/api/tools/orchestrate', async () => {
        return HttpResponse.json({
          ok: true,
          data: {
            orchestration: {
              stepDependencyArtifactIds: [],
              dependencyArtifactIdsByStep: {},
            },
          },
        });
      }),
    );
  });

  it('stream attivo blocca handlePrimaryAction: startMock non viene chiamato', async () => {
    // Simula uno stream attivo (es. un altro tool sta generando)
    generationWorkspaceState.isStreamActive = true;

    renderTemplate({ initialProjectId: 'project-001' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /avvia la generazione/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /avvia la generazione/i }));

    // Il guard in handlePrimaryAction ritorna early se generation.isStreamActive
    expect(startMock).not.toHaveBeenCalled();
  });

  it('machine-driven readiness: la readiness della macchina determina la policy CTA, non variabili locali UI', async () => {
    // Con briefingUploadMachine in 'ready' (mock default) e projectId valido
    // la macchina deriva canStartFlow=true → policy=start-generation → bottone abilitato
    renderTemplate({ initialProjectId: 'project-001' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /avvia la generazione/i })).toBeInTheDocument();
    });

    // Bottone presente e non disabled (la policy non è 'disabled')
    expect(screen.getByRole('button', { name: /avvia la generazione/i })).not.toBeDisabled();
  });

  it('non interrompe la chain dopo extraction success con extraction context valido', async () => {
    briefingMachineSeed.initialState = 'ready';
    briefingMachineSeed.context = {
      ...briefingMachineSeed.context,
      extractionArtifactId: 'artifact-extract-001',
      extractionPayload: { schemaVersion: 'extraction.v1' },
      normalizedText: 'brief text',
      briefingId: 'brief-001',
    };

    renderTemplate({ initialProjectId: 'project-001' });

    const primaryActionButton = await waitFor(() => {
      const button = screen.getByRole('button', { name: /avvia la generazione/i });
      expect(button).not.toBeDisabled();
      return button;
    });

    fireEvent.click(primaryActionButton);

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledTimes(1);
    });

    const request = startMock.mock.calls[0]?.[0] as { input: Record<string, unknown> };
    expect(request.input.extractionArtifactId).toBe('artifact-extract-001');
    expect(request.input.briefingText).toBe('brief text');
    expect(request.input.extractionPayload).toEqual({ schemaVersion: 'extraction.v1' });
  });

  it('mostra fase di generazione nel pannello verticale quando lo stream è attivo', async () => {
    generationWorkspaceState.isStreamActive = true;
    generationWorkspaceState.streamStatus = 'streaming';
    generationWorkspaceState.snapshot = { context: { lastRequest: { input: { step: 'optin' } } } };

    renderTemplate({ initialProjectId: 'project-001' });

    await waitFor(() => {
      expect(screen.getByText(/generazione in corso/i)).toBeInTheDocument();
    });
  });

  it('CTA non rimane bloccata dopo che lo stream torna inattivo', async () => {
    briefingMachineSeed.initialState = 'ready';
    briefingMachineSeed.context = {
      ...briefingMachineSeed.context,
      extractionArtifactId: 'artifact-extract-001',
      extractionPayload: { schemaVersion: 'extraction.v1' },
      normalizedText: 'brief text',
      briefingId: 'brief-001',
    };

    // Simula stream attivo: click non deve chiamare start
    generationWorkspaceState.isStreamActive = true;

    const { rerender } = renderTemplate({ initialProjectId: 'project-001' });

    await waitFor(() => {
      expect(screen.getByTestId('primary-cta-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('primary-cta-btn'));
    expect(startMock).not.toHaveBeenCalled();

    // Stream termina: rerender con isStreamActive=false
    generationWorkspaceState.isStreamActive = false;
    generationWorkspaceState.streamStatus = 'idle';

    rerender(
      <MemoryRouter>
        <ToolPageTemplate toolKey="funnel-pages" initialProjectId="project-001" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('primary-cta-btn')).toBeInTheDocument();
    });

    // Ora il click deve propagarsi correttamente
    fireEvent.click(screen.getByTestId('primary-cta-btn'));

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledTimes(1);
    });
  });
});
