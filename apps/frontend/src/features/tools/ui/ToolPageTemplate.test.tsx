import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { ToolPageTemplate } from './ToolPageTemplate';
import { resolveFlowProgressState } from '../machines/tool-page.machine';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';
import { useMswHandler } from '../../../test/mocks/server';
import { toolFileInstructionsRegistry } from '../runtime/tool-form-architecture';

const briefingMachineSeed = vi.hoisted(() => ({
  initialState: 'ready' as 'idle' | 'ready',
  context: {
    projectId: 'project-001',
    toolKey: 'funnel-pages',
    apiBaseUrl: '',
    capabilities: {} as Record<string, unknown>,
    userId: 'seed-user-001',
    file: null as File | null,
    fileName: null as string | null,
    angleDetectorFile: null as File | null,
    angleDetectorFileName: null as string | null,
    briefingId: 'brief-001' as string | null,
    extractionArtifactId: 'artifact-extract-001' as string | null,
    extractionPayload: { schemaVersion: 'extraction.v1' } as Record<string, unknown> | null,
    normalizedText: 'brief text' as string | null,
    parsedFormat: 'md' as 'txt' | 'md' | 'docx' | null,
    angleDetectorNormalizedText: null as string | null,
    angleDetectorParsedFormat: null as 'txt' | 'md' | 'docx' | null,
    error: null as string | null,
  },
}));

vi.mock('../machines/briefing-upload.machine', async () => {
  const { createBriefingUploadMachineMock } = await import('../../../test/mocks/briefing-upload-machine.mock');
  return createBriefingUploadMachineMock({
    initialState: briefingMachineSeed.initialState,
    contextOverrides: briefingMachineSeed.context,
  });
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

const generationRunWorkspaceState = {
  snapshot: { context: { lastRequest: null, errorMessage: null }, matches: vi.fn((state: string) => state === 'idle') },
  generationStatus: 'idle' as 'idle' | 'running' | 'completed' | 'failed',
  isGenerationActive: false,
  startRun: startMock,
  resetRun: vi.fn(),
};

const availableStepsState = {
  steps: ['optin'] as Array<'optin' | 'quiz' | 'vsl' | 'landing' | 'thank_you'>,
};

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => authState,
  useAuthState: () => ({
    session: authState.session,
    loading: false,
    hasError: false,
  }),
  useAuthActions: () => ({
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    clearError: () => {},
  }),
  useApiConfig: () => ({
    apiBaseUrl: authState.apiBaseUrl,
    capabilities: authState.capabilities,
  }),
  useOAuthUrl: () => ({
    oauthStartUrl: '',
  }),
}));

vi.mock('../../generation/runtime/GenerationWorkspaceProvider', () => ({
  useGenerationWorkspace: () => generationWorkspaceState,
  useGenerationStreamWorkspace: () => generationWorkspaceState,
  useGenerationGenerationWorkspace: () => generationRunWorkspaceState,
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
        campaignObjective: '',
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
      expect(screen.getByRole('button', { name: /start generation/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /start generation/i }));

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
      expect(screen.getByRole('button', { name: /start generation/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /start generation/i }));

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledTimes(1);
    });

    const firstRequest = startMock.mock.calls[0]?.[0] as { requestId: string };
    const runRequestPrefix = firstRequest.requestId.split(':')[0] ?? '';

    generationState.streamStatus = 'completed';
    generationState.isStreamActive = false;
    generationState.artifacts = [
      defaultExtractionArtifact,
      {
        artifactId: 'artifact-optin-001',
        requestId: `${runRequestPrefix}:optin`,
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
      expect(screen.getByRole('button', { name: /start generation/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /start generation/i }));

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledTimes(1);
    });

    // Step 1: optin
    const firstRequest = startMock.mock.calls[0]?.[0] as { input: Record<string, unknown> };
    const runRequestPrefix = ((startMock.mock.calls[0]?.[0] as { requestId: string }).requestId.split(':')[0] ?? '');
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
        requestId: `${runRequestPrefix}:optin`,
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
        requestId: `${runRequestPrefix}:optin`,
        projectId: 'project-001',
        status: 'completed',
        toolKey: 'funnel-pages',
        sourceRequest: { input: { step: 'optin' } },
        content: 'optin content',
      },
      {
        artifactId: 'artifact-quiz-001',
        requestId: `${runRequestPrefix}:quiz`,
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

  it('keeps api binding adapter off by default even when required api-acquisition is configured', async () => {
    const originalFunnelInstructions = toolFileInstructionsRegistry['funnel-pages'];
    const previousFeatureFlag = import.meta.env.VITE_FF_TOOLS_API_BINDING_STATUS;
    (import.meta.env as Record<string, string | undefined>).VITE_FF_TOOLS_API_BINDING_STATUS = undefined;
    toolFileInstructionsRegistry['funnel-pages'] = {
      ...originalFunnelInstructions,
      apiAcquisitionInputs: [
        {
          key: 'market-intel-service',
          label: 'MarketIntelService',
          requiredness: 'required-by-tool-setting',
        },
      ],
    };

    try {
      renderTemplate();

      const primaryButton = await waitFor(() => (
        screen.getByRole('button', { name: /start generation/i })
      ));

      expect(primaryButton).toBeEnabled();
    } finally {
      (import.meta.env as Record<string, string | undefined>).VITE_FF_TOOLS_API_BINDING_STATUS = previousFeatureFlag;
      toolFileInstructionsRegistry['funnel-pages'] = originalFunnelInstructions;
    }
  });

  it('keeps legacy tool flow enabled when no api-acquisition binding is configured', async () => {
    renderTemplate();

    const primaryButton = await waitFor(() => (
      screen.getByRole('button', { name: /start generation/i })
    ));

    expect(primaryButton).toBeEnabled();
    fireEvent.click(primaryButton);

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledTimes(1);
    });
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

  it('tracks only current run steps for new intent when runRequestPrefix is active', () => {
    const artifacts = [
      {
        artifactId: 'art-optin-historical',
        requestId: 'req-optin-historical',
        projectId: 'project-001',
        artifactType: 'content',
        status: 'completed',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel_pages',
        content: 'historical optin',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
        sourceRequest: {
          requestId: 'req-optin-historical',
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
        artifactId: 'art-quiz-run',
        requestId: 'run-current:quiz',
        projectId: 'project-001',
        artifactType: 'content',
        status: 'completed',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel_pages',
        content: 'quiz content',
        createdAt: '2026-05-03T00:00:00.000Z',
        updatedAt: '2026-05-03T00:00:00.000Z',
        sourceRequest: {
          requestId: 'run-current:quiz',
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
        artifactId: 'art-vsl-run',
        requestId: 'run-current:vsl',
        projectId: 'project-001',
        artifactType: 'content',
        status: 'completed',
        model: 'openrouter/auto',
        toolKey: 'funnel-pages',
        workflowType: 'funnel_pages',
        content: 'vsl content',
        createdAt: '2026-05-03T00:01:00.000Z',
        updatedAt: '2026-05-03T00:01:00.000Z',
        sourceRequest: {
          requestId: 'run-current:vsl',
          userId: 'user-1',
          projectId: 'project-001',
          artifactType: 'content',
          model: 'openrouter/auto',
          toolKey: 'funnel-pages',
          workflowType: 'funnel_pages',
          input: { step: 'vsl' },
        },
      },
    ] satisfies GenerationArtifact[];

    const result = resolveFlowProgressState(
      artifacts,
      'funnel-pages',
      'project-001',
      null,
      'new',
      null,
      'run-current',
    );

    expect([...result.completedSteps]).toEqual(['quiz', 'vsl']);
    expect(result.latestArtifactByStep.optin).toBeUndefined();
    expect(result.latestArtifactByStep.quiz?.artifactId).toBe('art-quiz-run');
    expect(result.latestArtifactByStep.vsl?.artifactId).toBe('art-vsl-run');
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
      angleDetectorFile: null,
      angleDetectorFileName: null,
      briefingId: 'brief-001',
      extractionArtifactId: 'artifact-extract-001',
      extractionPayload: { schemaVersion: 'extraction.v1' },
      normalizedText: 'brief text',
      parsedFormat: 'md',
      angleDetectorNormalizedText: null,
      angleDetectorParsedFormat: null,
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
      const button = screen.queryByRole('button', { name: /^Regenerate$/i })
        ?? screen.queryByRole('button', { name: /start generation/i });
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

  it('uses completed CTA policy without exposing a View button', async () => {
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

  it('machine-driven readiness: la readiness della macchina determina la policy CTA, non variabili locali UI', async () => {
    // Con briefingUploadMachine in 'ready' (mock default) e projectId valido
    // la macchina deriva canStartFlow=true → policy=start-generation → bottone abilitato
    renderTemplate({ initialProjectId: 'project-001' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start generation/i })).toBeInTheDocument();
    });

    // Bottone presente e non disabled (la policy non è 'disabled')
    expect(screen.getByRole('button', { name: /start generation/i })).not.toBeDisabled();
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
      const button = screen.getByRole('button', { name: /start generation/i });
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
});
