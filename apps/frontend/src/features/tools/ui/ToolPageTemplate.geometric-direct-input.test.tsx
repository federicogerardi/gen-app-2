import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolPageTemplate } from './ToolPageTemplate';

const handlePrimaryAction = vi.fn();
const handleExtractionStart = vi.fn();
const setFormState = vi.fn();

vi.mock('../../../app/providers/AuthSessionProvider', async () => {
  const { createMockAuthSessionProvider } = await import('../../../test/mocks/auth-session-provider.mock');
  return createMockAuthSessionProvider({ userId: 'user-1' });
});

vi.mock('../../../app/runtime/queries/useModelsQuery', () => ({
  useModelsQuery: () => ({
    data: [{ key: 'openrouter/auto', label: 'OpenRouter Auto', isDefault: true }],
    loading: false,
    error: null,
  }),
}));

vi.mock('../runtime/tool-page-selectors', () => ({
  selectToolFileInstructions: () => ({
    title: 'Tool instructions',
    summary: 'Direct input only — no file upload required',
    inputFiles: [],
    allowNoFiles: true,
    requiredFiles: [],
    requiredFieldKeys: [],
    requiredFields: [],
    optionalFields: [],
    examples: [],
    notes: [],
    stepConstraints: [],
  }),
  deriveToolInputRequirementMatrix: () => ({
    entries: [
      {
        key: 'project-selection',
        label: 'ProjectSelection',
        sourceFamily: 'direct-input',
        requiredness: 'always-required',
        satisfied: true,
      },
    ],
    requiredEntriesSatisfied: true,
    missingRequiredEntries: [],
    missingOptionalEntries: [],
    missingRequiredFiles: [],
    missingOptionalFiles: [],
    missingRequiredApiAcquisition: [],
    missingOptionalApiAcquisition: [],
    missingRequiredAssets: [],
    missingOptionalAssets: [],
  }),
}));

vi.mock('../runtime/useToolPage', () => ({
  useToolPage: () => ({
    toolConfig: {
      displayName: 'Geometric',
      steps: ['serp-crawling', 'competitor-scoring', 'strategic-reporting', 'unified-report'],
    },
    formState: {
      projectId: 'project-1',
      model: 'openrouter/auto',
      tone: 'Professional',
      campaignObjective: '',
      videoTitle: '',
      topic: '',
      baseQuery: '',
      language: 'it',
      country: 'google.it',
      keywords: '',
      ctaText: '',
      ctaLink: '',
      credentialsOrProof: '',
      chaptersWithTimestamps: '',
      socialLinks: '',
      hashtags: '',
    },
    setFormState,
    projects: [{ id: 'project-1', name: 'Project 1' }],
    projectsLoading: false,
    briefingError: null,
    briefingGuidance: null,
    dispatchError: null,
    artifactsReloadError: null,
    effectiveBriefingStatus: 'idle',
    effectiveBriefingFileName: null,
    machineViewModel: {
      primaryActionPolicy: 'start-generation',
      secondaryActionFlags: {
        canRetry: false,
        canSkipStep: false,
        canCancelGeneration: false,
        canOpenPreviousArtifact: false,
      },
      stepStatuses: {
        'serp-crawling': 'idle',
        'competitor-scoring': 'idle',
        'strategic-reporting': 'idle',
        'unified-report': 'idle',
      },
      messages: { status: null, error: null },
      readiness: {
        canStartFlow: true,
        hasProject: true,
        hasExtractionContext: true,
        hasPrimaryTargetStep: true,
        reasonCodes: [],
      },
      canonicalState: 'draft-ready',
    },
    isGenerating: false,
    readinessSnapshot: {
      canStartFlow: true,
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
    nextAvailableStep: 'serp-crawling',
    effectiveCanonicalState: 'draft-ready',
    currentProject: { id: 'project-1', name: 'Project 1' },
    isStreamActive: false,
    sessionId: 'sess_demo',
    handlePrimaryAction,
    handleCancelGeneration: vi.fn(),
    handleBriefingFileSelected: vi.fn(),
    handleAngleDetectorFileSelected: vi.fn(),
    handleExtractionStart,
    handleBriefingReset: vi.fn(),
    angleDetectorFileName: null,
  }),
}));

vi.mock('./ToolGenerationFlowVertical', () => ({
  ToolGenerationFlowVertical: ({ primaryActionCta }: { primaryActionCta?: { label?: string; onClick?: () => void } }) => (
    <div>
      <button type="button" onClick={() => primaryActionCta?.onClick?.()}>
        {primaryActionCta?.label ?? 'primary-action'}
      </button>
    </div>
  ),
}));

describe('ToolPageTemplate geometric direct input gating', () => {
  beforeEach(() => {
    handlePrimaryAction.mockReset();
    handleExtractionStart.mockReset();
    setFormState.mockReset();
  });

  it('does not submit when required direct-input fields are empty', () => {
    render(
      <MemoryRouter>
        <ToolPageTemplate toolKey="geometric" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(handlePrimaryAction).not.toHaveBeenCalled();
    expect(handleExtractionStart).not.toHaveBeenCalled();
  });

  it('submits using primary action and never starts extraction when required direct-input fields are filled', async () => {
    render(
      <MemoryRouter>
        <ToolPageTemplate toolKey="geometric" />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Base query'), { target: { value: 'protein supplements' } });

    fireEvent.mouseDown(screen.getByLabelText('Language'));
    const languageOptions = screen.getAllByText('Italian (it)');
    fireEvent.click(languageOptions[languageOptions.length - 1]!);

    fireEvent.mouseDown(screen.getByLabelText('Country / Google Domain'));
    const countryOptions = screen.getAllByText('google.it (Italy)');
    fireEvent.click(countryOptions[countryOptions.length - 1]!);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(handlePrimaryAction).toHaveBeenCalledTimes(1);
    });
    expect(handleExtractionStart).not.toHaveBeenCalled();
  });

  it('renders all 3 geometric direct-input fields', () => {
    render(
      <MemoryRouter>
        <ToolPageTemplate toolKey="geometric" />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Base query')).toBeInTheDocument();
    expect(screen.getByLabelText('Language')).toBeInTheDocument();
    expect(screen.getByLabelText('Country / Google Domain')).toBeInTheDocument();
  });

  it('does not render file upload fields', () => {
    render(
      <MemoryRouter>
        <ToolPageTemplate toolKey="geometric" />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/briefing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/upload/i)).not.toBeInTheDocument();
  });
});
