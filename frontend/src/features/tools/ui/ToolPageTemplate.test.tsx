import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolPageTemplate } from './ToolPageTemplate';

const startMock = vi.fn();

const generationState = {
  isStreamActive: false,
  streamStatus: 'idle',
  artifacts: [] as Array<{
    artifactId: string;
    projectId: string;
    status: 'completed' | 'generating' | 'failed';
    toolKey: 'funnel-pages' | 'nextland';
    sourceRequest?: { input?: Record<string, unknown> };
    content?: string;
  }>,
};

const availableStepsState = {
  steps: ['optin'] as Array<'optin' | 'quiz' | 'vsl' | 'landing' | 'thank_you'>,
};

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    session: { user: { id: 'seed-user-001' } },
    capabilities: {},
    apiBaseUrl: '',
  }),
}));

vi.mock('../../generation/runtime/GenerationWorkspaceProvider', () => ({
  useGenerationWorkspace: () => ({
    snapshot: { context: { lastRequest: { input: {} } } },
    streamStatus: generationState.streamStatus,
    isStreamActive: generationState.isStreamActive,
    artifacts: generationState.artifacts,
    focusedProjectId: 'project-001',
    getExtractionContext: () => ({
      projectId: 'project-001',
      briefingId: 'brief-001',
      extractionArtifactId: 'artifact-extract-001',
      extractionPayload: { schemaVersion: 'extraction.v1' },
      normalizedText: 'brief text',
      parsedFormat: 'md',
      updatedAt: new Date().toISOString(),
    }),
    start: startMock,
  }),
}));

vi.mock('../runtime/useToolForm', () => ({
  useProjectsLoader: () => ({
    projects: [{ id: 'project-001', name: 'Project 001' }],
    loading: false,
    error: null,
  }),
  useBriefingUpload: () => ({
    file: null,
    fileName: 'brief.md',
    error: null,
    status: 'ready',
    extractionContext: {
      projectId: 'project-001',
      briefingId: 'brief-001',
      extractionArtifactId: 'artifact-extract-001',
      extractionPayload: { schemaVersion: 'extraction.v1' },
      normalizedText: 'brief text',
      parsedFormat: 'md',
      updatedAt: new Date().toISOString(),
    },
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
  useToolUiState: () => ({
    canonicalState: 'draft-ready',
    primaryActionPolicy: 'start-generation',
    secondaryActions: {
      canRetry: false,
      canSkipStep: false,
      canCancelGeneration: false,
      canOpenPreviousArtifact: false,
    },
    statusMessage: 'Ready to generate',
    errorMessage: null,
    stepStatuses: {
      optin: 'idle',
      quiz: 'idle',
      vsl: 'idle',
    },
  }),
}));

describe('ToolPageTemplate wiring', () => {
  beforeEach(() => {
    startMock.mockReset();
    generationState.isStreamActive = false;
    generationState.streamStatus = 'idle';
    generationState.artifacts = [];
    availableStepsState.steps = ['optin'];
  });

  it('dispatches generation.start with resolved step and dependency metadata', async () => {
    generationState.artifacts = [
      {
        artifactId: 'artifact-optin-001',
        projectId: 'project-001',
        status: 'completed',
        toolKey: 'funnel-pages',
        sourceRequest: { input: { step: 'optin' } },
        content: 'optin content',
      },
    ];
    availableStepsState.steps = ['quiz'];

    render(<ToolPageTemplate toolKey="funnel-pages" />);

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
    expect(request.workflowType).toBe('funnel-pages');
    expect(request.input.step).toBe('quiz');
    expect(request.input.stepDependencyArtifactIds).toEqual(['artifact-optin-001']);
    expect(request.input.extractionArtifactId).toBe('artifact-extract-001');
  });

  it('auto-starts the next step after previous step completion in auto-chain mode', async () => {
    const { rerender } = render(<ToolPageTemplate toolKey="funnel-pages" />);

    fireEvent.click(screen.getByRole('button', { name: /start generation/i }));

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledTimes(1);
    });

    generationState.streamStatus = 'completed';
    generationState.isStreamActive = false;
    generationState.artifacts = [
      {
        artifactId: 'artifact-optin-001',
        projectId: 'project-001',
        status: 'completed',
        toolKey: 'funnel-pages',
        sourceRequest: { input: { step: 'optin' } },
        content: 'optin content',
      },
    ];
    availableStepsState.steps = ['quiz'];

    rerender(<ToolPageTemplate toolKey="funnel-pages" />);

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledTimes(2);
    });

    const secondRequest = startMock.mock.calls[1]?.[0] as { input: Record<string, unknown> };
    expect(secondRequest.input.step).toBe('quiz');
  });
});
