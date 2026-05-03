import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolPageTemplate } from './ToolPageTemplate';
import { resolveFlowProgressState } from '../machines/tool-page.machine';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';

// Phase 4: briefingUploadMachine mockato per partire in 'ready' con contesto estrazione.
// Consente a deriveHasExtractionContext di restituire true dal primo render,
// e al fallback di startGenerationStep (briefingSnapshot.context) di funzionare.
vi.mock('../machines/briefing-upload.machine', async () => {
  const { setup } = await import('xstate');
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
        | { type: 'EXTRACTION_RECOVERED'; artifactId: string; payload: Record<string, unknown>; briefingId?: string | null; fileName?: string | null },
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
    }),
    initial: 'ready',
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
  return { briefingUploadMachine };
});

// Phase 4: la hydration avviene in macchina via artifacts-client locale.
// Con capabilities={} il client usa sempre localArtifacts → nessuna rete.
vi.mock('../../artifacts/runtime/artifacts-client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../artifacts/runtime/artifacts-client')>();
  return original;
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
  workflowType: 'funnel-pages',
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
    workflowType: 'funnel-pages',
    input: { briefingId: 'brief-001', toolKey: 'funnel-pages' },
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
  capabilities: {},
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
}));

vi.mock('../runtime/useToolForm', async () => {
  const toolUxState = await vi.importActual<typeof import('../runtime/tool-ux-state')>('../runtime/tool-ux-state');

  return {
    useProjectsLoader: () => ({
      projects: [{ id: 'project-001', name: 'Project 001' }],
      loading: false,
      error: null,
    }),
    useBriefingUpload: () => ({
      file: briefingState.file,
      fileName: briefingState.fileName,
      error: briefingState.error,
      status: briefingState.status,
      extractionContext: briefingState.extractionContext,
      handleFileSelected: vi.fn(),
    }),
    useToolFormInit: () => ({
      formState: {
        projectId: 'project-001',
        model: 'openrouter/auto',
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
    useToolUiState: (
      toolKey: 'funnel-pages' | 'nextland',
      runtimeInput: {
        intent?: 'new' | 'resume' | 'regenerate';
        formState: {
          projectId: string;
          briefingFile: File | null;
          briefingStatus: 'idle' | 'uploading' | 'extracting' | 'ready';
        };
        isGenerationStreamActive: boolean;
        completedSteps: Set<'optin' | 'quiz' | 'vsl' | 'landing' | 'thank_you'>;
        currentRunningStep: 'optin' | 'quiz' | 'vsl' | 'landing' | 'thank_you' | null;
        hasCompletedPreviousGeneration: boolean;
        lastCheckpointStep: 'optin' | 'quiz' | 'vsl' | 'landing' | 'thank_you' | null;
        nextAvailableStep: 'optin' | 'quiz' | 'vsl' | 'landing' | 'thank_you' | null;
        generationError: string | null;
        hasStartedCurrentRun?: boolean;
      },
    ) => toolUxState.deriveCanonicalToolUiState({
      toolKey,
      ...(runtimeInput.intent !== undefined ? { intent: runtimeInput.intent } : {}),
      projectId: runtimeInput.formState.projectId,
      briefingFile: runtimeInput.formState.briefingFile,
      briefingStatus: runtimeInput.formState.briefingStatus,
      isGenerationStreamActive: runtimeInput.isGenerationStreamActive,
      completedSteps: runtimeInput.completedSteps,
      currentRunningStep: runtimeInput.currentRunningStep,
      hasCompletedPreviousGeneration: runtimeInput.hasCompletedPreviousGeneration,
      lastCheckpointStep: runtimeInput.lastCheckpointStep,
      nextAvailableStep: runtimeInput.nextAvailableStep,
      generationError: runtimeInput.generationError,
      ...(runtimeInput.hasStartedCurrentRun !== undefined
        ? { hasStartedCurrentRun: runtimeInput.hasStartedCurrentRun }
        : {}),
    }),
  };
});

describe('ToolPageTemplate wiring', () => {
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
    expect(request.workflowType).toBe('funnel-pages');
    expect(request.input.step).toBe('quiz');
    expect(request.input.stepDependencyArtifactIds).toEqual(['artifact-optin-001']);
    expect(request.input.extractionArtifactId).toBe('artifact-extract-001');
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
      workflowType: 'funnel-pages',
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
        projectId: 'project-001',
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
          projectId: 'project-001',
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
        projectId: 'project-001',
        artifactType: 'content',
        status: 'completed',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel-pages',
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
          workflowType: 'funnel-pages',
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
        workflowType: 'funnel-pages',
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
          workflowType: 'funnel-pages',
          input: { step: 'optin' },
        },
      },
    ] satisfies GenerationArtifact[];

    const result = resolveFlowProgressState(
      artifacts,
      'funnel-pages',
      'project-001',
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
      workflowType: 'funnel-pages',
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
        workflowType: 'funnel-pages',
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
        workflowType: 'funnel-pages',
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
          workflowType: 'funnel-pages',
          input: { step: 'quiz' },
        },
      },
    ] satisfies GenerationArtifact[];

    const result = resolveFlowProgressState(
      artifacts,
      'funnel-pages',
      'project-001',
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
  });

  it('updates CTA and feedback to resume-checkpoint when checkpoint hydration completes', async () => {
    extractionContextState = null;
    briefingState.fileName = null;
    briefingState.status = 'idle';
    briefingState.extractionContext = null;
    generationState.artifacts = [
      {
        artifactId: 'source-checkpoint-001',
        projectId: 'project-001',
        status: 'completed',
        toolKey: 'funnel-pages',
        sourceRequest: {
          input: {
            briefingId: 'brief-restore-001',
            extractionArtifactId: 'artifact-extract-restore-001',
            briefingFileName: 'restore-brief.md',
            step: 'optin',
          },
          toolKey: 'funnel-pages',
          workflowType: 'funnel-pages',
        },
        content: 'optin content',
      },
    ];
    generationWorkspaceState.artifacts = generationState.artifacts;
    availableStepsState.steps = ['quiz'];

    renderTemplate({
      intent: 'resume',
      sourceArtifactId: 'source-checkpoint-001',
      initialProjectId: 'project-001',
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /riprendi dal checkpoint/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /riprendi dal checkpoint/i }));

    await waitFor(() => {
      expect(startMock).toHaveBeenCalled();
    });

    const resumeSteps = startMock.mock.calls
      .map((call) => (call[0] as { input: Record<string, unknown> }).input.step);
    expect(resumeSteps).toContain('quiz');

    expect(screen.getByText(/generazione in corso/i)).toBeInTheDocument();
    expect(screen.getByText(/briefing status:\s*ready\s*- restore-brief.md/i)).toBeInTheDocument();
  });

  it('updates CTA and feedback to regenerate when a completed checkout is restored', async () => {
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
          workflowType: 'funnel-pages',
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
          workflowType: 'funnel-pages',
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
          workflowType: 'funnel-pages',
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

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^rigenera$/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/contesto caricato — avvia la rigenerazione/i)).toBeInTheDocument();
    expect(screen.getByText(/briefing status:\s*ready\s*- restore-regen.md/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^rigenera$/i }));

    await waitFor(() => {
      expect(startMock).toHaveBeenCalled();
    });

    const regenerateSteps = startMock.mock.calls
      .map((call) => (call[0] as { input: Record<string, unknown> }).input.step);
    expect(regenerateSteps).toContain('vsl');
  });

  it('recovers checkpoint from legacy extraction artifact without input.toolKey', async () => {
    extractionContextState = null;
    briefingState.fileName = null;
    briefingState.status = 'idle';
    briefingState.extractionContext = null;

    generationState.artifacts = [
      {
        artifactId: 'source-legacy-001',
        projectId: 'project-001',
        status: 'completed',
        toolKey: 'funnel-pages',
        sourceRequest: {
          input: {
            briefingId: 'brief-legacy-001',
            extractionArtifactId: 'extract-legacy-001',
            briefingFileName: 'legacy-brief.md',
            step: 'optin',
          },
          toolKey: 'funnel-pages',
          workflowType: 'funnel-pages',
        },
        content: 'optin content',
      },
      {
        artifactId: 'extract-legacy-001',
        requestId: 'req-extract-legacy-001',
        projectId: 'project-001',
        artifactType: 'extraction',
        status: 'completed',
        model: 'openrouter/auto',
        toolKey: 'extraction',
        workflowType: 'extraction',
        content: '{"summary":"legacy extraction"}',
        createdAt: '2026-05-02T10:00:00.000Z',
        updatedAt: '2026-05-02T10:00:01.000Z',
        sourceRequest: {
          requestId: 'req-extract-legacy-001',
          userId: 'seed-user-001',
          projectId: 'project-001',
          artifactType: 'extraction',
          model: 'openrouter/auto',
          toolKey: 'extraction',
          workflowType: 'extraction',
          input: {
            briefingId: 'brief-legacy-001',
            // legacy: input.toolKey intentionally missing
          },
        },
      },
    ];
    generationWorkspaceState.artifacts = generationState.artifacts;
    availableStepsState.steps = ['quiz'];

    renderTemplate({
      intent: 'resume',
      sourceArtifactId: 'source-legacy-001',
      initialProjectId: 'project-001',
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /riprendi dal checkpoint/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/briefing status:\s*ready\s*- legacy-brief.md/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /riprendi dal checkpoint/i }));

    await waitFor(() => {
      expect(startMock).toHaveBeenCalled();
    });

    const resumeSteps = startMock.mock.calls
      .map((call) => (call[0] as { input: Record<string, unknown> }).input.step);
    expect(resumeSteps).toContain('quiz');
  });

  it('uses completed CTA policy without dispatching generation start', async () => {
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

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /visualizza i risultati/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /visualizza i risultati/i }));

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
    // Simula stream attivo: click non deve chiamare start
    generationWorkspaceState.isStreamActive = true;

    const { rerender } = renderTemplate({ initialProjectId: 'project-001' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /avvia la generazione/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /avvia la generazione/i }));
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
      expect(screen.getByRole('button', { name: /avvia la generazione/i })).toBeInTheDocument();
    });

    // Ora il click deve propagarsi correttamente
    fireEvent.click(screen.getByRole('button', { name: /avvia la generazione/i }));

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledTimes(1);
    });
  });
});
