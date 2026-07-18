import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ToolPageTemplate } from './ToolPageTemplate';

const handlePrimaryAction = vi.fn();
const handleCancelGeneration = vi.fn();
const handleBriefingFileSelected = vi.fn();
const handleAngleDetectorFileSelected = vi.fn();
const handleExtractionStart = vi.fn();
const handleBriefingReset = vi.fn();

vi.mock('../../../app/providers/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    session: { user: { id: 'user-1' } },
    apiBaseUrl: '',
    capabilities: {},
  }),
  useAuthState: () => ({
    session: { user: { id: 'user-1' } },
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
    apiBaseUrl: '',
    capabilities: {},
  }),
  useOAuthUrl: () => ({
    oauthStartUrl: '',
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
    inputFiles: [
      {
        key: 'briefing-file',
        label: 'Briefing File',
        accept: '.docx,.txt,.md',
        requiredness: 'always-required',
      },
    ],
    requiredFields: [],
    alwaysRequiredFiles: [],
    requiredBySettingFiles: [],
    optionalBySettingFiles: [],
  }),
  deriveToolInputFileCompletion: () => ({
    requiredFilesComplete: true,
    missingRequiredFiles: [],
    missingOptionalFiles: [],
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
  useToolPage: () => ({
    toolConfig: {
      displayName: 'Funnel Pages',
      steps: ['optin'],
    },
    formState: {
      projectId: 'project-1',
      model: 'openrouter/auto',
      tone: 'Professional',
      campaignObjective: '',
    },
    setFormState: vi.fn(),
    projects: [{ id: 'project-1', name: 'Project 1' }],
    projectsLoading: false,
    briefingError: null,
    briefingGuidance: null,
    dispatchError: null,
    artifactsReloadError: null,
    effectiveBriefingStatus: 'idle',
    effectiveBriefingFileName: null,
    machineViewModel: {
      primaryActionPolicy: 'disabled',
      secondaryActionFlags: {
        canRetry: false,
        canSkipStep: false,
        canCancelGeneration: false,
        canOpenPreviousArtifact: false,
      },
      stepStatuses: {
        optin: 'idle',
      },
      messages: { status: null, error: null },
      readiness: {
        canStartFlow: false,
        hasProject: true,
        hasExtractionContext: false,
        hasPrimaryTargetStep: true,
        reasonCodes: ['missing_extraction_context'],
      },
      canonicalState: 'draft-empty',
    },
    isGenerating: false,
    readinessSnapshot: {
      canStartFlow: false,
      hasProject: true,
      hasExtractionContext: false,
      hasPrimaryTargetStep: true,
      reasonCodes: ['missing_extraction_context'],
    },
    completedStepsForFlow: new Set<string>(),
    latestArtifactByStep: {},
    currentRunningStep: null,
    streamingStep: null,
    effectiveCanonicalState: 'draft-empty',
    currentProject: { id: 'project-1', name: 'Project 1' },
    isStreamActive: false,
    handlePrimaryAction,
    handleCancelGeneration,
    handleBriefingFileSelected,
    handleAngleDetectorFileSelected,
    handleExtractionStart,
    handleBriefingReset,
    angleDetectorFileName: null,
  }),
}));

vi.mock('./ToolGenerationFlowVertical', () => ({
  ToolGenerationFlowVertical: ({ primaryActionCta }: { primaryActionCta?: { label?: string; onClick?: () => void } }) => (
    <div data-testid="tool-flow-vertical">
      <button type="button" onClick={() => primaryActionCta?.onClick?.()}>
        {primaryActionCta?.label ?? 'primary-action'}
      </button>
    </div>
  ),
}));

describe('ToolPageTemplate extraction CTA single-file', () => {
  it.skip('arms extraction from Avvia la generazione and refreshes briefing payload first', async () => {
    handlePrimaryAction.mockReset();
    handleCancelGeneration.mockReset();
    handleBriefingFileSelected.mockReset();
    handleAngleDetectorFileSelected.mockReset();
    handleExtractionStart.mockReset();
    handleBriefingReset.mockReset();

    render(
      <MemoryRouter>
        <ToolPageTemplate toolKey="funnel-pages" />
      </MemoryRouter>,
    );

    const briefingFile = new File(['brief-content'], 'brief.md', { type: 'text/markdown' });
    const briefingUploadButton = screen.getByRole('button', { name: /briefing file/i });
    const briefingUploadInput = briefingUploadButton.querySelector('input[type="file"]') as HTMLInputElement | null;

    expect(briefingUploadInput).not.toBeNull();
    fireEvent.change(briefingUploadInput as HTMLInputElement, { target: { files: [briefingFile] } });

    expect(handleBriefingFileSelected).toHaveBeenCalledTimes(1);
    expect(handleBriefingFileSelected).toHaveBeenCalledWith(briefingFile);
    expect(handleExtractionStart).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /avvia la generazione/i }));

    await waitFor(() => {
      expect(handleExtractionStart).toHaveBeenCalledTimes(1);
    });

    expect(handlePrimaryAction).not.toHaveBeenCalled();

    expect(handleBriefingFileSelected).toHaveBeenCalledTimes(2);
    expect(handleAngleDetectorFileSelected).not.toHaveBeenCalled();

    const payloadRefreshCallOrder = handleBriefingFileSelected.mock.invocationCallOrder[1];
    const extractionStartCallOrder = handleExtractionStart.mock.invocationCallOrder[0];

    expect(payloadRefreshCallOrder).toBeDefined();
    expect(extractionStartCallOrder).toBeDefined();
    expect(payloadRefreshCallOrder!).toBeLessThan(extractionStartCallOrder!);
  });
});
