import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useToolPage } from './useToolPage';

const mocks = vi.hoisted(() => {
  const send = vi.fn();
  const useMachine = vi.fn();
  const useSelector = vi.fn();
  const navigate = vi.fn();
  const setFormState = vi.fn();

  const machineSnapshot = {
    context: {
      briefingActorRef: {},
      hydrationResult: null as Record<string, unknown> | null,
      progress: {
        completedSteps: new Set<string>(),
        latestArtifactByStep: {},
      },
      readiness: {
        canStartFlow: true,
        reasons: [] as string[],
        hasExtractionContext: true,
        hasPrimaryTargetStep: true,
      },
      viewModel: {
        canonicalState: 'draft-ready',
        primaryActionPolicy: 'start-generation',
        secondaryFlags: {
          canRetry: false,
          canSkipStep: false,
          canCancelGeneration: false,
          canOpenPreviousArtifact: false,
        },
      },
      pendingStepStart: null as { step: string; runRequestPrefix: string } | null,
    },
    matches: vi.fn(() => false),
  };

  const briefingSnapshot = {
    matches: vi.fn((state: string) => state === 'idle'),
    context: {
      error: null as string | null,
      fileName: null as string | null,
      briefingId: null as string | null,
      extractionArtifactId: null as string | null,
      extractionPayload: null as Record<string, unknown> | null,
      normalizedText: null as string | null,
      parsedFormat: null as 'md' | 'txt' | 'docx' | null,
    },
  };

  const generation = {
    focusedProjectId: 'project-001',
    setFocusedProjectId: vi.fn(),
    artifacts: [] as Array<Record<string, unknown>>,
    snapshot: {
      context: {
        lastRequest: null as { input?: Record<string, unknown> } | null,
        errorMessage: null as string | null,
      },
    },
    isStreamActive: false,
    streamStatus: 'idle' as 'idle' | 'completed' | 'failed',
    terminalCompletedStep: null as string | null,
    terminalFailedStep: null as string | null,
    cancel: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    getExtractionContext: vi.fn(() => null),
    upsertExtractionContext: vi.fn(),
  };

  const auth = {
    apiBaseUrl: '',
    capabilities: { artifacts: true, toolsUpload: true } as Record<string, unknown>,
    session: { user: { id: 'user-001' } },
  };

  const formState = {
    projectId: 'project-001',
    model: 'openrouter/auto',
    tone: 'Professional',
    registrySnapshotRef: 'snapshot:default',
    briefingFile: null,
    briefingFileName: null,
    briefingError: null,
    briefingStatus: 'idle',
    selectedSteps: new Set<string>(),
    stepArtifactIds: {} as Record<string, string>,
  };

  const toolConfig = {
    toolKey: 'funnel-pages',
    title: 'Funnel Pages',
    description: 'desc',
    defaultModel: 'openrouter/auto',
    defaults: { registrySnapshotRef: 'snapshot:default' },
    steps: ['optin', 'quiz', 'vsl'] as Array<'optin' | 'quiz' | 'vsl'>,
  };

  const availableSteps = ['optin'] as Array<'optin' | 'quiz' | 'vsl'>;

  return {
    send,
    useMachine,
    useSelector,
    navigate,
    setFormState,
    machineSnapshot,
    briefingSnapshot,
    generation,
    auth,
    formState,
    toolConfig,
    availableSteps,
  };
});

vi.mock('@xstate/react', () => ({
  useMachine: (...args: unknown[]) => mocks.useMachine(...args),
  useSelector: (...args: unknown[]) => mocks.useSelector(...args),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => mocks.auth,
}));

vi.mock('../../generation/runtime/GenerationWorkspaceProvider', () => ({
  useGenerationWorkspace: () => mocks.generation,
}));

vi.mock('../runtime/tool-form-architecture', () => ({
  getToolFormConfig: () => mocks.toolConfig,
}));

vi.mock('../runtime/useToolForm', () => ({
  useProjectsLoader: () => ({ projects: [{ id: 'project-001', name: 'Project 001' }], loading: false }),
  useToolFormInit: () => ({ formState: mocks.formState, setFormState: mocks.setFormState }),
  useAvailableSteps: () => mocks.availableSteps,
}));

vi.mock('../../artifacts/runtime/artifacts-client', () => ({
  getArtifactById: vi.fn(),
}));

vi.mock('../runtime/tools-client', () => ({
  orchestrateToolStep: vi.fn().mockResolvedValue({
    toolKey: 'funnel-pages',
    targetStep: 'optin',
    stepDependencyArtifactIds: [],
    dependencyArtifactIdsByStep: {},
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();

  mocks.machineSnapshot.context.hydrationResult = null;
  mocks.machineSnapshot.context.pendingStepStart = null;
  mocks.machineSnapshot.context.viewModel.primaryActionPolicy = 'start-generation';
  mocks.machineSnapshot.context.readiness.canStartFlow = true;
  mocks.machineSnapshot.matches.mockReturnValue(false);

  mocks.briefingSnapshot.matches.mockImplementation((state: string) => state === 'idle');
  mocks.briefingSnapshot.context.error = null;
  mocks.briefingSnapshot.context.fileName = null;

  mocks.generation.isStreamActive = false;
  mocks.generation.snapshot.context.lastRequest = null;
  mocks.generation.snapshot.context.errorMessage = null;
  mocks.generation.streamStatus = 'idle';

  mocks.useMachine.mockImplementation(() => [mocks.machineSnapshot, mocks.send]);
  mocks.useSelector.mockImplementation(() => mocks.briefingSnapshot);
});

describe('useToolPage', () => {
  it('initializes tool page machine with canonical tool input', () => {
    renderHook(() => useToolPage({ toolKey: 'funnel-pages' }));

    expect(mocks.useMachine).toHaveBeenCalledTimes(1);
    const machineOptions = mocks.useMachine.mock.calls.at(0)?.[1];
    expect(machineOptions).toBeDefined();
    expect(machineOptions).toMatchObject({
      input: {
        toolKey: 'funnel-pages',
        projectId: 'project-001',
        model: 'openrouter/auto',
      },
    });
  });

  it('treats hydration result as ready briefing state', () => {
    mocks.machineSnapshot.context.hydrationResult = {
      projectId: 'project-001',
      briefingId: 'brief-001',
      extractionArtifactId: 'artifact-extract-001',
      extractionPayload: {},
      normalizedText: 'brief text',
      parsedFormat: 'md',
    };
    mocks.briefingSnapshot.matches.mockImplementation(() => false);

    const { result } = renderHook(() => useToolPage({ toolKey: 'funnel-pages' }));

    expect(result.current.effectiveBriefingStatus).toBe('ready');
  });

  it('dispatches REQUEST_STEP_START when primary action starts generation', () => {
    const { result } = renderHook(() => useToolPage({ toolKey: 'funnel-pages' }));

    act(() => {
      result.current.handlePrimaryAction();
    });

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'REQUEST_STEP_START',
        step: 'optin',
      }),
    );
  });

  it('exposes semantic briefing handlers and streamingStep without leaking internals', () => {
    mocks.generation.isStreamActive = true;
    mocks.generation.snapshot.context.lastRequest = {
      input: { step: 'optin' },
    };

    const { result } = renderHook(() => useToolPage({ toolKey: 'funnel-pages' }));

    const file = new File(['brief'], 'brief.md', { type: 'text/markdown' });
    act(() => {
      result.current.handleBriefingFileSelected(file);
      result.current.handleBriefingReset();
    });

    expect(result.current.streamingStep).toBe('optin');
    expect(mocks.send).toHaveBeenCalledWith({ type: 'BRIEFING_FILE_SELECTED', file });
    expect(mocks.send).toHaveBeenCalledWith({ type: 'BRIEFING_RESET' });

    expect('toolPageSend' in result.current).toBe(false);
    expect('generationSnapshot' in result.current).toBe(false);
    expect('progressState' in result.current).toBe(false);
  });

  it('normalizes model legacy provider format before dispatch', async () => {
    mocks.formState.model = 'openrouter:auto';
    mocks.formState.tone = 'Professional';
    mocks.machineSnapshot.context.hydrationResult = {
      extractionArtifactId: 'artifact-extract-001',
      extractionPayload: { schemaVersion: 'extraction.v1' },
      briefingId: 'brief-001',
      normalizedText: 'brief text',
      parsedFormat: 'md',
    };
    mocks.machineSnapshot.context.pendingStepStart = {
      step: 'optin',
      runRequestPrefix: 'run-001',
    };

    renderHook(() => useToolPage({ toolKey: 'funnel-pages' }));

    await waitFor(() => {
      expect(mocks.generation.start).toHaveBeenCalledTimes(1);
    });

    const request = mocks.generation.start.mock.calls[0]?.[0] as {
      model: string;
      input: { tone: string };
    };

    expect(request.model).toBe('openrouter/auto');
    expect(request.input.tone).toBe('Professional');
  });

  it('falls back to canonical defaults for empty model and non-canonical tone', async () => {
    mocks.formState.model = '   ';
    mocks.formState.tone = 'warm and playful';
    mocks.machineSnapshot.context.hydrationResult = {
      extractionArtifactId: 'artifact-extract-001',
      extractionPayload: { schemaVersion: 'extraction.v1' },
      briefingId: 'brief-001',
      normalizedText: 'brief text',
      parsedFormat: 'md',
    };
    mocks.machineSnapshot.context.pendingStepStart = {
      step: 'optin',
      runRequestPrefix: 'run-002',
    };

    renderHook(() => useToolPage({ toolKey: 'funnel-pages' }));

    await waitFor(() => {
      expect(mocks.generation.start).toHaveBeenCalledTimes(1);
    });

    const request = mocks.generation.start.mock.calls[0]?.[0] as {
      model: string;
      input: { tone: string };
    };

    expect(request.model).toBe('openrouter/auto');
    expect(request.input.tone).toBe('Professional');
  });

  it('declares failure and cancels run when terminal failed has no failedStep', async () => {
    mocks.generation.isStreamActive = true;
    mocks.generation.streamStatus = 'idle';
    mocks.generation.snapshot.context.lastRequest = {
      input: { step: 'optin' },
    };

    const { result, rerender } = renderHook(() => useToolPage({ toolKey: 'funnel-pages' }));

    act(() => {
      mocks.generation.isStreamActive = false;
      mocks.generation.streamStatus = 'failed';
      mocks.generation.terminalFailedStep = null;
      mocks.generation.snapshot.context.errorMessage = 'terminal_failed:402';
    });

    rerender();

    await waitFor(() => {
      expect(mocks.send).toHaveBeenCalledWith({ type: 'CANCEL_GENERATION' });
    });

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'STEP_FAILED',
        step: 'optin',
      }),
    );
    expect(result.current.dispatchError).toContain('terminal_failed:402');
  });

  it('surfaces stream_empty_output as inline dispatch feedback on terminal failure', async () => {
    mocks.generation.isStreamActive = true;
    mocks.generation.streamStatus = 'idle';
    mocks.generation.snapshot.context.lastRequest = {
      input: { step: 'optin' },
    };

    const { result, rerender } = renderHook(() => useToolPage({ toolKey: 'funnel-pages' }));

    act(() => {
      mocks.generation.isStreamActive = false;
      mocks.generation.streamStatus = 'failed';
      mocks.generation.terminalFailedStep = null;
      mocks.generation.snapshot.context.errorMessage = 'stream_empty_output';
    });

    rerender();

    await waitFor(() => {
      expect(mocks.send).toHaveBeenCalledWith({ type: 'CANCEL_GENERATION' });
    });

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'STEP_FAILED',
        step: 'optin',
        message: 'stream_empty_output',
      }),
    );
    expect(result.current.dispatchError).toBe('stream_empty_output');
  });
});
