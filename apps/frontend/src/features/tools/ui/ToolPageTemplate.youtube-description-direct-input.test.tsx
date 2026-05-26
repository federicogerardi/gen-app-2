import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolPageTemplate } from './ToolPageTemplate';

const handlePrimaryAction = vi.fn();
const handleExtractionStart = vi.fn();
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
    title: 'Tool instructions',
    summary: 'Direct input only',
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
  }),
}));

vi.mock('../runtime/useToolPage', () => ({
  useToolPage: () => ({
    toolConfig: {
      displayName: 'YT Description Generator',
      steps: ['youtube-description-generation'],
    },
    formState: {
      projectId: 'project-1',
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
        'youtube-description-generation': 'idle',
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
    nextAvailableStep: 'youtube-description-generation',
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

describe('ToolPageTemplate youtube-description direct input gating', () => {
  beforeEach(() => {
    handlePrimaryAction.mockReset();
    handleExtractionStart.mockReset();
    setFormState.mockReset();
  });

  it('does not submit when required direct-input fields are empty', () => {
    render(
      <MemoryRouter>
        <ToolPageTemplate toolKey="youtube-description" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(handlePrimaryAction).not.toHaveBeenCalled();
    expect(handleExtractionStart).not.toHaveBeenCalled();
  });

  it('submits using primary action and never starts extraction when required direct-input fields are filled', async () => {
    render(
      <MemoryRouter>
        <ToolPageTemplate toolKey="youtube-description" />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Video title'), { target: { value: 'Video title' } });
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'Topic' } });
    fireEvent.change(screen.getByLabelText('Keywords (comma-separated)'), { target: { value: 'kw1, kw2' } });
    fireEvent.change(screen.getByLabelText('CTA text'), { target: { value: 'Click here' } });
    fireEvent.change(screen.getByLabelText('CTA link'), { target: { value: 'https://example.com' } });
    fireEvent.change(screen.getByLabelText('Credentials or proof'), { target: { value: '10 years experience' } });
    fireEvent.change(screen.getByLabelText('Chapters with timestamps (one per line)'), { target: { value: '0:00 Intro\n1:25 Main' } });

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(handlePrimaryAction).toHaveBeenCalledTimes(1);
    });
    expect(handleExtractionStart).not.toHaveBeenCalled();
  });
});
