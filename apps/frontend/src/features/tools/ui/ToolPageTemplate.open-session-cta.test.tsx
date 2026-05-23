import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ToolPageTemplate } from './ToolPageTemplate';

const handlePrimaryAction = vi.fn();

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
    ],
    requiredFields: [],
    alwaysRequiredFiles: [],
    requiredBySettingFiles: [],
    optionalBySettingFiles: [],
  }),
  deriveToolInputFileCompletion: () => ({
    requiredFilesComplete: false,
    missingRequiredFiles: ['briefing-file'],
    missingOptionalFiles: [],
  }),
}));

vi.mock('../runtime/useToolPage', () => ({
  useToolPage: () => ({
    toolConfig: {
      displayName: 'Funnel Pages',
      steps: ['optin'],
    },
    formState: {
      projectId: '',
      model: 'openrouter/auto',
      tone: 'Professional',
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
      primaryActionPolicy: 'open-last-artifact',
      secondaryActionFlags: {
        canRetry: false,
        canSkipStep: false,
        canCancelGeneration: false,
        canOpenPreviousArtifact: false,
      },
      stepStatuses: {
        optin: 'done',
      },
      messages: { status: null, error: null },
      readiness: {
        canStartFlow: true,
        hasProject: true,
        hasExtractionContext: true,
        hasPrimaryTargetStep: true,
        reasonCodes: [],
      },
      canonicalState: 'completed',
    },
    isGenerating: false,
    readinessSnapshot: {
      canStartFlow: true,
      hasProject: true,
      hasExtractionContext: true,
      hasPrimaryTargetStep: true,
      reasonCodes: [],
    },
    completedStepsForFlow: new Set<string>(['optin']),
    latestArtifactByStep: {},
    currentRunningStep: null,
    streamingStep: null,
    pausedCheckpointStep: null,
    nextAvailableStep: null,
    effectiveCanonicalState: 'completed',
    currentProject: { id: 'project-1', name: 'Project 1' },
    isStreamActive: false,
    sessionId: 'sess_demo',
    handlePrimaryAction,
    handleCancelGeneration: vi.fn(),
    handleBriefingFileSelected: vi.fn(),
    handleAngleDetectorFileSelected: vi.fn(),
    handleExtractionStart: vi.fn(),
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

describe('ToolPageTemplate open session CTA', () => {
  beforeEach(() => {
    handlePrimaryAction.mockReset();
  });

  it('triggers open session action even when form validation would fail', () => {
    render(
      <MemoryRouter>
        <ToolPageTemplate toolKey="funnel-pages" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Apri sessione' }));

    expect(handlePrimaryAction).toHaveBeenCalledTimes(1);
  });
});
