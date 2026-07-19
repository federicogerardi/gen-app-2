import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useToolPage } from './useToolPage';
import type { ToolStep } from '../machines/tool-flow.machine';

const mocks = vi.hoisted(() => {
  const send = vi.fn();
  const useMachine = vi.fn();
  const useSelector = vi.fn();
  const navigate = vi.fn();
  const setFormState = vi.fn();
  const orchestrateToolStep = vi.fn();

  const machineSnapshot = {
    context: {
      toolKey: 'funnel-pages',
      briefingActorRef: {},
      hydrationResult: null as Record<string, unknown> | null,
      hydrationError: null as string | null,
      generationError: null as string | null,
      intent: 'new' as 'new' | 'resume' | 'regenerate',
      runRequestPrefix: null as string | null,
      progress: {
        completedSteps: new Set<string>(),
        latestArtifactByStep: {},
        lastCheckpointStep: null as string | null,
      },
      readiness: {
        canStartFlow: true,
        reasons: [] as string[],
        hasExtractionContext: true,
        hasPrimaryTargetStep: true,
      },
      pendingStepStart: null as { step: string; runRequestPrefix: string } | null,
    },
    matches: vi.fn(() => false),
  };

  const briefingSnapshot = {
    matches: vi.fn((state: string) => state === 'idle'),
    context: {
      fileName: null as string | null,
      angleDetectorFileName: null as string | null,
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

  const generationRun = {
    snapshot: {
      context: {
        lastRequest: null as { input?: Record<string, unknown> } | null,
        errorMessage: null as string | null,
      },
      matches: vi.fn((state: string) => state === 'idle'),
    },
    generationStatus: 'idle' as 'idle' | 'running' | 'completed' | 'failed',
    isGenerationActive: false,
    startRun: generation.start,
    resetRun: vi.fn(),
  };

  const formState = {
    projectId: 'project-001',
    model: 'openrouter/auto',
    tone: 'Professional',
    campaignObjective: '',
    videoTitle: '',
    topic: '',
    keywords: '',
    ctaText: '',
    ctaLink: '',
    credentialsOrProof: '',
    chaptersWithTimestamps: '',
    socialLinks: '',
    hashtags: '',
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
    steps: ['optin', 'quiz', 'vsl'] as ToolStep[],
  };

  const availableSteps = ['optin'] as ToolStep[];

  return {
    send,
    useMachine,
    useSelector,
    navigate,
    setFormState,
    machineSnapshot,
    briefingSnapshot,
    generation,
    generationRun,
    formState,
    toolConfig,
    availableSteps,
    orchestrateToolStep,
  };
});

vi.mock('@xstate/react', () => ({
  useMachine: (...args: unknown[]) => mocks.useMachine(...args),
  useSelector: (...args: unknown[]) => mocks.useSelector(...args),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock('../../../app/providers/AuthSessionProvider', async () => {
  const { createMockAuthSessionProvider } = await import('../../../test/mocks/auth-session-provider.mock');
  return createMockAuthSessionProvider({ userId: 'user-001', capabilities: { artifacts: true, toolsUpload: true } });
});

vi.mock('../../generation/runtime/GenerationWorkspaceProvider', () => ({
  useGenerationWorkspace: () => mocks.generation,
  useGenerationStreamWorkspace: () => mocks.generation,
  useGenerationGenerationWorkspace: () => mocks.generationRun,
  useGenerationArtifactsWorkspace: () => ({
    artifacts: mocks.generation.artifacts,
    reloadArtifacts: vi.fn(),
  }),
  useGenerationProjectWorkspace: () => ({
    focusedProjectId: mocks.generation.focusedProjectId,
    extractionByProject: {},
    setFocusedProjectId: mocks.generation.setFocusedProjectId,
    upsertExtractionContext: mocks.generation.upsertExtractionContext,
    getExtractionContext: mocks.generation.getExtractionContext,
  }),
}));

vi.mock('../runtime/tool-form-architecture', () => ({
  getToolFormConfig: () => mocks.toolConfig,
  getRequiredToolInputFiles: () => [],
  getAvailableSteps: () => [],
}));

vi.mock('../../../app/runtime/queries/useProjectsQuery', () => ({
  useProjectsQuery: () => ({
    data: [{ id: 'project-001', name: 'Project 001' }],
    loading: false,
    error: null,
    reload: vi.fn(),
  }),
}));

vi.mock('../runtime/useToolForm', () => ({
  useToolFormInit: () => ({ formState: mocks.formState, setFormState: mocks.setFormState }),
  useAvailableSteps: () => mocks.availableSteps,
}));

vi.mock('../../artifacts/runtime/artifacts-client', () => ({
  getArtifactById: vi.fn(),
}));

vi.mock('../runtime/tools-client', () => ({
  orchestrateToolStep: (...args: unknown[]) => mocks.orchestrateToolStep(...args),
}));

beforeEach(() => {
  mocks.orchestrateToolStep.mockResolvedValue({
    toolKey: 'funnel-pages',
    targetStep: 'optin',
    stepDependencyArtifactIds: [],
    dependencyArtifactIdsByStep: {},
  });
  vi.clearAllMocks();

  mocks.toolConfig = {
    toolKey: 'funnel-pages',
    title: 'Funnel Pages',
    description: 'desc',
    defaultModel: 'openrouter/auto',
    defaults: { registrySnapshotRef: 'snapshot:default' },
    steps: ['optin', 'quiz', 'vsl'],
  };
  mocks.availableSteps = ['optin'];

  mocks.formState.projectId = 'project-001';
  mocks.formState.model = 'openrouter/auto';
  mocks.formState.tone = 'Professional';
  mocks.formState.campaignObjective = '';
  mocks.formState.videoTitle = '';
  mocks.formState.topic = '';
  mocks.formState.keywords = '';
  mocks.formState.ctaText = '';
  mocks.formState.ctaLink = '';
  mocks.formState.credentialsOrProof = '';
  mocks.formState.chaptersWithTimestamps = '';
  mocks.formState.socialLinks = '';
  mocks.formState.hashtags = '';

  mocks.machineSnapshot.context.hydrationResult = null;
  mocks.machineSnapshot.context.pendingStepStart = null;
  mocks.machineSnapshot.context.readiness.canStartFlow = true;
  mocks.machineSnapshot.matches.mockReturnValue(false);

  mocks.briefingSnapshot.matches.mockImplementation((state: unknown) => {
    if (typeof state === 'string') return state === 'idle';
    if (typeof state === 'object' && state !== null && 'idle' in state) return (state as Record<string, string>).idle === 'clean';
    return false;
  });
  
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

  it('auto-starts generation only after extraction is ready and readiness has been recomputed', async () => {
    const { result, rerender } = renderHook(() => useToolPage({ toolKey: 'funnel-pages' }));

    act(() => {
      result.current.handleExtractionStart({ autoStartGeneration: true });
    });

    expect(mocks.send).toHaveBeenCalledWith({ type: 'BRIEFING_EXTRACTION_REQUESTED' });

    mocks.briefingSnapshot.matches.mockImplementation((state: unknown) => {
      if (typeof state === 'string') return state === 'ready';
      if (typeof state === 'object' && state !== null && 'idle' in state) return false;
      return false;
    });
    mocks.briefingSnapshot.context.briefingId = 'brief-001';
    mocks.briefingSnapshot.context.extractionArtifactId = 'artifact-extract-001';
    mocks.briefingSnapshot.context.extractionPayload = { schemaVersion: 'extraction.v1' };
    mocks.briefingSnapshot.context.normalizedText = 'brief text';
    mocks.briefingSnapshot.context.parsedFormat = 'md';
    mocks.machineSnapshot.context.readiness.canStartFlow = false;

    rerender();

    expect(mocks.send).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'REQUEST_STEP_START',
        step: 'optin',
      }),
    );

    mocks.machineSnapshot.context.readiness.canStartFlow = true;

    rerender();

    await waitFor(() => {
      expect(mocks.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'REQUEST_STEP_START',
          step: 'optin',
        }),
      );
    });
  });

  it('re-syncs PROGRESS_SYNCED when project selection changes', () => {
    const { rerender } = renderHook(() => useToolPage({ toolKey: 'funnel-pages' }));

    const progressSyncedCallsBefore = mocks.send.mock.calls.filter(
      ([event]) => (event as { type?: string })?.type === 'PROGRESS_SYNCED',
    ).length;

    mocks.formState.projectId = 'project-002';
    rerender();

    const progressSyncedCallsAfter = mocks.send.mock.calls.filter(
      ([event]) => (event as { type?: string })?.type === 'PROGRESS_SYNCED',
    ).length;

    expect(progressSyncedCallsAfter).toBeGreaterThan(progressSyncedCallsBefore);
  });

  it('exposes semantic briefing handlers (including angle-detector source) and streamingStep without leaking internals', () => {
    mocks.generation.isStreamActive = true;
    mocks.generation.snapshot.context.lastRequest = {
      input: { step: 'optin' },
    };

    const { result } = renderHook(() => useToolPage({ toolKey: 'funnel-pages' }));

    const file = new File(['brief'], 'brief.md', { type: 'text/markdown' });
    const angleDetectorFile = new File(['angle'], 'angle-detector.md', { type: 'text/markdown' });
    act(() => {
      result.current.handleBriefingFileSelected(file);
      result.current.handleAngleDetectorFileSelected(angleDetectorFile);
      result.current.handleBriefingReset();
    });

    expect(result.current.streamingStep).toBe('optin');
    expect(mocks.send).toHaveBeenCalledWith({ type: 'BRIEFING_FILE_SELECTED', file });
    expect(mocks.send).toHaveBeenCalledWith({ type: 'BRIEFING_FILE_SELECTED', file: angleDetectorFile, sourceKey: 'angle-detector-file' });
    expect(mocks.send).toHaveBeenCalledWith({ type: 'BRIEFING_RESET' });
    expect(mocks.generationRun.startRun).not.toHaveBeenCalled();
    expect(mocks.generation.start).not.toHaveBeenCalled();

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
      expect(mocks.generationRun.startRun).toHaveBeenCalledTimes(1);
    });

    const request = mocks.generationRun.startRun.mock.calls[0]?.[0] as {
      model: string;
      input: { tone: string };
    };

    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PROGRESS_SYNCED',
        runRequestPrefix: 'run-001',
      }),
    );
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
      expect(mocks.generationRun.startRun).toHaveBeenCalledTimes(1);
    });

    const request = mocks.generationRun.startRun.mock.calls[0]?.[0] as {
      model: string;
      input: { tone: string };
    };

    expect(request.model).toBe('openrouter/auto');
    expect(request.input.tone).toBe('Professional');
  });

  it('dispatches youtube-description with direct-input extraction payload after CTA flow', async () => {
    mocks.toolConfig = {
      ...mocks.toolConfig,
      toolKey: 'youtube-description',
      steps: ['youtube-description-generation'],
    };
    mocks.availableSteps = ['youtube-description-generation'];
    mocks.orchestrateToolStep.mockResolvedValue({
      toolKey: 'youtube-description',
      targetStep: 'youtube-description-generation',
      stepDependencyArtifactIds: [],
      dependencyArtifactIdsByStep: {},
    });

    mocks.formState.model = 'openrouter/auto';
    mocks.formState.tone = 'Professional';
    mocks.formState.projectId = 'project-001';
    mocks.formState.videoTitle = 'Strategia YouTube 2026';
    mocks.formState.topic = 'Growth organica';
    mocks.formState.keywords = 'youtube, growth, seo';
    mocks.formState.ctaText = 'Prenota una call';
    mocks.formState.ctaLink = 'https://example.com/call';
    mocks.formState.credentialsOrProof = '10 anni di risultati misurabili';
    mocks.formState.chaptersWithTimestamps = '0:00 Intro\n1:30 Strategia';
    mocks.formState.socialLinks = '';
    mocks.formState.hashtags = '';

    mocks.machineSnapshot.context.pendingStepStart = {
      step: 'youtube-description-generation',
      runRequestPrefix: 'run-ytd-001',
    };
    mocks.machineSnapshot.context.hydrationResult = null;

    renderHook(() => useToolPage({ toolKey: 'youtube-description' }));

    await waitFor(() => {
      expect(mocks.generationRun.startRun).toHaveBeenCalledTimes(1);
    });

    const request = mocks.generationRun.startRun.mock.calls[0]?.[0] as {
      toolKey: string;
      workflowType: string;
      input: {
        briefingId: string;
        briefingText: string;
        extractionArtifactId: string;
        extractionPayload: Record<string, unknown>;
      };
    };

    expect(request.toolKey).toBe('youtube-description');
    expect(request.workflowType).toBe('youtube_description');
    expect(request.input.briefingId).toBe('direct-input:youtube-description');
    expect(request.input.extractionArtifactId).toBe('direct-input:youtube-description');
    expect(request.input.briefingText).toContain('Video title: Strategia YouTube 2026');
    expect(request.input.briefingText).toContain('CTA text: Prenota una call');
    expect(request.input.briefingText).toContain('Chapters with timestamps:');
    expect(request.input.extractionPayload).toMatchObject({
      videoTitle: 'Strategia YouTube 2026',
      topic: 'Growth organica',
      keywords: ['youtube', 'growth', 'seo'],
      ctaText: 'Prenota una call',
      ctaLink: 'https://example.com/call',
      credentialsOrProof: '10 anni di risultati misurabili',
      chaptersWithTimestamps: ['0:00 Intro', '1:30 Strategia'],
    });
    expect(request.input.extractionPayload).not.toHaveProperty('socialLinks');
    expect(request.input.extractionPayload).not.toHaveProperty('hashtags');
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
    expect(result.current.dispatchError).toBe('Generation was unsuccessful. Try again shortly.');
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
        message: 'The briefing does not contain enough data for generation. Upload a new, more detailed brief.',
      }),
    );
    expect(result.current.dispatchError).toBe('The briefing does not contain enough data for generation. Upload a new, more detailed brief.');
  });

  it('keeps primary action disabled after invalid extraction and surfaces inline dispatch error', async () => {
    mocks.machineSnapshot.context.readiness.canStartFlow = false;
    mocks.machineSnapshot.context.readiness.hasExtractionContext = false;
    mocks.briefingSnapshot.matches.mockImplementation((state: unknown) => {
      if (typeof state === 'string') return state === 'ready';
      if (typeof state === 'object' && state !== null && 'idle' in state) return (state as Record<string, string>).idle === 'failed';
      return false;
    });
    

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

    expect(result.current.machineViewModel.primaryActionPolicy).toBe('disabled');
    expect(result.current.readinessSnapshot.canStartFlow).toBe(false);
    expect(result.current.briefingError).toBe('The briefing does not contain enough data for generation. Upload a new, more detailed brief.');
    expect(result.current.dispatchError).toBe('The briefing does not contain enough data for generation. Upload a new, more detailed brief.');
  });

  it('re-upload recovery: keeps disabled on invalid context and re-enables only after valid context', async () => {
    mocks.machineSnapshot.context.readiness.canStartFlow = false;
    mocks.machineSnapshot.context.readiness.hasExtractionContext = false;
    mocks.briefingSnapshot.matches.mockImplementation((state: unknown) => {
      if (typeof state === 'string') return state === 'ready';
      if (typeof state === 'object' && state !== null && 'idle' in state) return false;
      return false;
    });
    
    mocks.briefingSnapshot.context.briefingId = 'brief-invalid';
    mocks.briefingSnapshot.context.extractionArtifactId = 'artifact-invalid';
    mocks.briefingSnapshot.context.extractionPayload = {};
    mocks.briefingSnapshot.context.normalizedText = 'brief text';
    mocks.briefingSnapshot.context.parsedFormat = 'md';

    const { result, rerender } = renderHook(() => useToolPage({ toolKey: 'funnel-pages' }));

    expect(result.current.machineViewModel.primaryActionPolicy).toBe('disabled');
    expect(mocks.generation.upsertExtractionContext).not.toHaveBeenCalled();

    mocks.machineSnapshot.context.readiness.canStartFlow = true;
    mocks.machineSnapshot.context.readiness.hasExtractionContext = true;
    
    mocks.briefingSnapshot.context.briefingId = 'brief-valid';
    mocks.briefingSnapshot.context.extractionArtifactId = 'artifact-valid';
    mocks.briefingSnapshot.context.extractionPayload = { schemaVersion: 'extraction.v1' };
    mocks.briefingSnapshot.context.normalizedText = 'brief text';
    mocks.briefingSnapshot.context.parsedFormat = 'md';

    rerender();

    expect(result.current.machineViewModel.primaryActionPolicy).toBe('start-generation');
    expect(result.current.readinessSnapshot.canStartFlow).toBe(true);
    expect(result.current.briefingError).toBeNull();
  });
});
