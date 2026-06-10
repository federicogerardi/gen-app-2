import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolPageTemplate } from './ToolPageTemplate';

const setFormState = vi.fn();

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    session: { user: { id: 'user-1' } },
    apiBaseUrl: '',
    capabilities: {},
  }),
}));

vi.mock('../../../app/runtime/queries/useModelsQuery', () => ({
  useModelsQuery: () => ({
    data: [{ key: 'openrouter/auto', label: 'OpenRouter Auto', isDefault: true }],
    loading: false,
    error: null,
  }),
}));

vi.mock('../runtime/tool-page-selectors', () => ({
  selectToolFileInstructions: () => ({
    inputFiles: [],
    requiredFields: [],
    alwaysRequiredFiles: [],
    requiredBySettingFiles: [],
    optionalBySettingFiles: [],
  }),
  deriveToolInputRequirementMatrix: () => ({
    entries: [],
    requiredEntriesSatisfied: true,
    missingRequiredEntries: [],
    missingOptionalEntries: [],
    missingRequiredFiles: [],
    missingOptionalFiles: [],
    missingRequiredApiAcquisition: [],
    missingOptionalApiAcquisition: [],
  }),
}));

vi.mock('../runtime/useToolPage', () => ({
  useToolPage: ({ toolKey }: { toolKey: string }) => ({
    toolConfig: {
      displayName: 'Tool',
      steps: ['context-generation'],
    },
    formState: {
      projectId: 'project-1',
      model: 'openrouter/auto',
      tone: 'Professional',
      campaignObjective: '',
    },
    setFormState,
    projects: [{ id: 'project-1', name: 'Project 1' }],
    projectsLoading: false,
    briefingError: null,
    briefingGuidance: null,
    dispatchError: null,
    artifactsReloadError: null,
    effectiveBriefingStatus: 'ready',
    effectiveBriefingFileName: 'brief.md',
    machineViewModel: {
      primaryActionPolicy: 'disabled',
      secondaryActionFlags: {
        canRetry: false,
        canSkipStep: false,
        canCancelGeneration: false,
        canOpenPreviousArtifact: false,
      },
      stepStatuses: {
        'context-generation': 'idle',
      },
      messages: { status: null, error: null },
      readiness: {
        canStartFlow: false,
        hasProject: true,
        hasExtractionContext: true,
        hasPrimaryTargetStep: true,
        reasonCodes: [],
      },
      canonicalState: 'draft-ready',
    },
    isGenerating: false,
    readinessSnapshot: {
      canStartFlow: false,
      hasProject: true,
      hasExtractionContext: true,
      hasPrimaryTargetStep: true,
      reasonCodes: [],
    },
    completedStepsForFlow: new Set<string>(),
    latestArtifactByStep: {},
    currentRunningStep: null,
    streamingStep: null,
    pausedCheckpointStep: null,
    nextAvailableStep: null,
    effectiveCanonicalState: 'draft-ready',
    currentProject: { id: 'project-1', name: 'Project 1' },
    isStreamActive: false,
    sessionId: 'session-1',
    handlePrimaryAction: vi.fn(),
    handleCancelGeneration: vi.fn(),
    handleBriefingFileSelected: vi.fn(),
    handleAngleDetectorFileSelected: vi.fn(),
    handleExtractionStart: vi.fn(),
    handleBriefingReset: vi.fn(),
    angleDetectorFileName: null,
    toolKey,
  }),
}));

vi.mock('./ToolGenerationFlowVertical', () => ({
  ToolGenerationFlowVertical: () => <div data-testid="tool-flow-vertical" />,
}));

describe('ToolPageTemplate meta-ads campaign objective', () => {
  beforeEach(() => {
    setFormState.mockReset();
  });

  it('renders campaign objective select only for meta-ads', () => {
    const { rerender } = render(
      <MemoryRouter>
        <ToolPageTemplate toolKey="meta-ads" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('combobox', { name: /obiettivo campagna/i })).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ToolPageTemplate toolKey="funnel-pages" />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('combobox', { name: /obiettivo campagna/i })).not.toBeInTheDocument();
  });

  it('updates form state when campaign objective changes', () => {
    render(
      <MemoryRouter>
        <ToolPageTemplate toolKey="meta-ads" />
      </MemoryRouter>,
    );

    const objectiveSelect = screen.getByRole('combobox', { name: /obiettivo campagna/i });
    fireEvent.mouseDown(objectiveSelect);
    fireEvent.click(screen.getByRole('option', { name: 'Leads' }));

    expect(setFormState).toHaveBeenCalled();
    const updateArg = setFormState.mock.calls.at(-1)?.[0] as ((prev: { campaignObjective: string }) => { campaignObjective: string });
    expect(updateArg({ campaignObjective: '' }).campaignObjective).toBe('Leads');
  });
});
