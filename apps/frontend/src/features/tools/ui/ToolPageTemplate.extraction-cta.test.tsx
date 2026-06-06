import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolPageTemplate } from './ToolPageTemplate';

const handlePrimaryAction = vi.fn();
const handleCancelGeneration = vi.fn();
const handleBriefingFileSelected = vi.fn();
const handleAngleDetectorFileSelected = vi.fn();
const handleExtractionStart = vi.fn();
const handleBriefingReset = vi.fn();
let mockedEffectiveBriefingStatus: 'idle' | 'uploading' | 'extracting' | 'ready' = 'idle';
let mockedIsGenerating = false;
let mockedIsStreamActive = false;
let mockedEffectiveCanonicalState: 'draft-empty' | 'running' = 'draft-empty';

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
    inputFiles: [
      {
        key: 'briefing-file',
        label: 'Briefing File',
        accept: '.docx,.txt,.md',
        requiredness: 'always-required',
      },
      {
        key: 'angle-detector-file',
        label: 'Angle Detector File',
        accept: '.docx,.txt,.md',
        requiredness: 'optional-by-tool-setting',
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
  }),
}));

vi.mock('../runtime/useToolPage', () => ({
  useToolPage: () => ({
    toolConfig: {
      displayName: 'Angle Generator',
      steps: ['context-and-angle-matrix'],
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
    effectiveBriefingStatus: mockedEffectiveBriefingStatus,
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
        'context-and-angle-matrix': 'idle',
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
    isGenerating: mockedIsGenerating,
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
    effectiveCanonicalState: mockedEffectiveCanonicalState,
    currentProject: { id: 'project-1', name: 'Project 1' },
    isStreamActive: mockedIsStreamActive,
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
  ToolGenerationFlowVertical: ({ primaryActionCta }: { primaryActionCta?: { label?: string; onClick?: () => void; disabled?: boolean } }) => (
    <div data-testid="tool-flow-vertical">
      <button type="button" onClick={() => primaryActionCta?.onClick?.()} disabled={primaryActionCta?.disabled}>
        {primaryActionCta?.label ?? 'primary-action'}
      </button>
    </div>
  ),
}));

describe('ToolPageTemplate extraction CTA', () => {
  beforeEach(() => {
    mockedEffectiveBriefingStatus = 'idle';
    mockedIsGenerating = false;
    mockedIsStreamActive = false;
    mockedEffectiveCanonicalState = 'draft-empty';
  });

  it('shows disabled Avvia la generazione while extraction is in progress', () => {
    mockedEffectiveBriefingStatus = 'extracting';

    render(
      <MemoryRouter>
        <ToolPageTemplate toolKey="angle-generator" />
      </MemoryRouter>,
    );

    const primaryButton = screen.getByRole('button', { name: /avvia la generazione/i });
    expect(primaryButton).toBeDisabled();

  });

  it('arms extraction from Avvia la generazione and refreshes optional file payload first', async () => {
    mockedEffectiveBriefingStatus = 'idle';
    handlePrimaryAction.mockReset();
    handleCancelGeneration.mockReset();
    handleBriefingFileSelected.mockReset();
    handleAngleDetectorFileSelected.mockReset();
    handleExtractionStart.mockReset();
    handleBriefingReset.mockReset();

    render(
      <MemoryRouter>
        <ToolPageTemplate toolKey="angle-generator" />
      </MemoryRouter>,
    );

    const angleFile = new File(['angle-content'], 'angle-detector.md', { type: 'text/markdown' });
    const angleUploadButton = screen.getByRole('button', { name: /angle detector file/i });
    const angleUploadInput = angleUploadButton.querySelector('input[type="file"]') as HTMLInputElement | null;

    expect(angleUploadInput).not.toBeNull();
    fireEvent.change(angleUploadInput as HTMLInputElement, { target: { files: [angleFile] } });

    expect(handleAngleDetectorFileSelected).toHaveBeenCalledTimes(1);
    expect(handleAngleDetectorFileSelected).toHaveBeenCalledWith(angleFile);
    expect(handleExtractionStart).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /avvia la generazione/i }));

    await waitFor(() => {
      expect(handleExtractionStart).toHaveBeenCalledTimes(1);
    });

    expect(handlePrimaryAction).not.toHaveBeenCalled();

    expect(handleAngleDetectorFileSelected).toHaveBeenCalledTimes(2);

    const payloadRefreshCallOrder = handleAngleDetectorFileSelected.mock.invocationCallOrder[1];
    const extractionStartCallOrder = handleExtractionStart.mock.invocationCallOrder[0];

    expect(payloadRefreshCallOrder).toBeDefined();
    expect(extractionStartCallOrder).toBeDefined();
    expect(payloadRefreshCallOrder!).toBeLessThan(extractionStartCallOrder!);
  });

  it('locks form fields during generation and keeps only Annulla active', () => {
    mockedIsGenerating = true;
    mockedIsStreamActive = false;
    mockedEffectiveCanonicalState = 'running';

    render(
      <MemoryRouter>
        <ToolPageTemplate toolKey="angle-generator" />
      </MemoryRouter>,
    );

    expect(screen.getByRole('combobox', { name: /progetto/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('combobox', { name: /modello/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('combobox', { name: /tono/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /briefing file/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /angle detector file/i })).toHaveAttribute('aria-disabled', 'true');

    const cancelButton = screen.getByRole('button', { name: /annulla/i });
    expect(cancelButton).toBeEnabled();
    fireEvent.click(cancelButton);
    expect(handleCancelGeneration).toHaveBeenCalledTimes(1);
  });
});
