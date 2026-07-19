import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolPageTemplate } from './ToolPageTemplate';

const handlePrimaryAction = vi.fn();
const handleExtractionStart = vi.fn();
const handleCancelGeneration = vi.fn();
const handleBriefingFileSelected = vi.fn();
const handleAngleDetectorFileSelected = vi.fn();
const handleBriefingReset = vi.fn();

let mockedEffectiveBriefingStatus: 'idle' | 'uploading' | 'extracting' | 'ready' = 'idle';
const formState = {
  projectId: 'project-1',
  model: 'openrouter/auto',
  campaignObjective: '',
};
const setFormState = vi.fn((updater: (prev: typeof formState) => typeof formState) => {
  Object.assign(formState, updater(formState));
});

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
    missingRequiredAssets: [],
    missingOptionalAssets: [],
  }),
}));

vi.mock('../runtime/useToolPage', () => ({
  useToolPage: ({ toolKey }: { toolKey: string }) => ({
    toolConfig: {
      displayName: 'MetaAds Generator',
      steps: ['context-generation', 'ads-generation'],
    },
    formState,
    setFormState,
    projects: [{ id: 'project-1', name: 'Project 1' }],
    projectsLoading: false,
    briefingError: null,
    briefingGuidance: null,
    dispatchError: null,
    artifactsReloadError: null,
    effectiveBriefingStatus: mockedEffectiveBriefingStatus,
    effectiveBriefingFileName: 'brief.md',
    machineViewModel: {
      primaryActionPolicy: 'start-generation',
      secondaryActionFlags: {
        canRetry: false,
        canSkipStep: false,
        canCancelGeneration: false,
        canOpenPreviousArtifact: false,
      },
      stepStatuses: {
        'context-generation': 'idle',
        'ads-generation': 'idle',
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
    nextAvailableStep: null,
    effectiveCanonicalState: 'draft-ready',
    currentProject: { id: 'project-1', name: 'Project 1' },
    isStreamActive: false,
    sessionId: 'session-1',
    handlePrimaryAction,
    handleCancelGeneration,
    handleBriefingFileSelected,
    handleAngleDetectorFileSelected,
    handleExtractionStart,
    handleBriefingReset,
    angleDetectorFileName: null,
    toolKey,
  }),
}));

vi.mock('./ToolGenerationFlowVertical', () => ({
  ToolGenerationFlowVertical: ({ primaryActionCta }: { primaryActionCta?: { label?: string; onClick?: () => void; disabled?: boolean } }) => (
    <div data-testid="tool-flow-vertical">
      <button type="button" onClick={() => primaryActionCta?.onClick?.()} disabled={primaryActionCta?.disabled}>
        {primaryActionCta?.label ?? 'primary-action'}
      </button>
    </div>
  ),
}));

describe('ToolPageTemplate meta-ads e2e flow', () => {
  beforeEach(() => {
    mockedEffectiveBriefingStatus = 'idle';
    formState.campaignObjective = '';
    setFormState.mockClear();
    handleExtractionStart.mockClear();
    handlePrimaryAction.mockClear();
  });

  it('uses the primary generation CTA to arm context extraction in a single click', async () => {
    render(
      <MemoryRouter>
        <ToolPageTemplate toolKey="meta-ads" />
      </MemoryRouter>,
    );

    const objectiveSelect = screen.getByRole('combobox', { name: /campaign objective/i });
    fireEvent.mouseDown(objectiveSelect);
    fireEvent.click(screen.getByRole('option', { name: 'Leads' }));

    expect(formState.campaignObjective).toBe('Leads');

    fireEvent.click(screen.getByRole('button', { name: /start generation/i }));

    await waitFor(() => {
      expect(handleExtractionStart).toHaveBeenCalledTimes(1);
    });

    expect(handlePrimaryAction).not.toHaveBeenCalled();
  });
});
