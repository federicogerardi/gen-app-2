import type { CanonicalToolUiState } from '../../generation/ui/tool-ux-state';
import { appCopy } from '../../../app/copy/system';
import { cx, uiPrimitives } from '../../../app/ui/primitives';

// ─── DDD-084: simplified Workflow Panel contract (supersedes DDD-082, DDD-083) ─

type InputFilePayloadStatus = {
  key: string;
  label: string;
  requiredness: 'always-required' | 'required-by-tool-setting' | 'optional-by-tool-setting';
  status: 'todo' | 'active' | 'done' | 'error';
  fileName: string | null;
};

type GenerationProgressSnapshot = {
  completedCount: number;
  totalCount: number;
  currentStepLabel: string | null;
  sessionId: string | null;
  extractionProgress?: {
    completedCount: number;
    totalCount: number;
    currentStepLabel: string | null;
    statusLabel: string;
  };
};

export interface ToolGenerationFlowVerticalProps {
  canonicalState: CanonicalToolUiState;
  projectName: string | null;
  errorMessage: string | null;
  inputFilePayload?: InputFilePayloadStatus[];
  generationProgress?: GenerationProgressSnapshot;
  primaryActionCta?: {
    label: string;
    disabled: boolean;
    onClick: () => void;
    isLoading?: boolean;
    tooltip?: string;
  };
}

// ─── STATUS_TEXT map (DDD-084) ───────────────────────────────────────────────

const STATUS_TEXT: Record<CanonicalToolUiState, string> = {
  'draft-empty': appCopy.ui.toolPage.flow.statusByCanonicalState['draft-empty'],
  'processing-briefing': appCopy.ui.toolPage.flow.statusByCanonicalState['processing-briefing'],
  'draft-ready': appCopy.ui.toolPage.flow.statusByCanonicalState['draft-ready'],
  'resume-needs-briefing': appCopy.ui.toolPage.flow.statusByCanonicalState['resume-needs-briefing'],
  'prefilled-regenerate': appCopy.ui.toolPage.flow.statusByCanonicalState['prefilled-regenerate'],
  'paused-with-checkpoint': appCopy.ui.toolPage.flow.statusByCanonicalState['paused-with-checkpoint'],
  running: appCopy.ui.toolPage.flow.statusByCanonicalState.running,
  completed: appCopy.ui.toolPage.flow.statusByCanonicalState.completed,
};

type BarVariant = 'hidden' | 'idle' | 'active' | 'paused' | 'completed';

type ProgressPhase = 'extraction' | 'generation';

type ProgressBarModel = {
  phase: ProgressPhase;
  variant: BarVariant;
  ariaLabel: string;
};

const REQUIREDNESS_LABEL: Record<InputFilePayloadStatus['requiredness'], string> = {
  'always-required': appCopy.ui.toolPage.flow.requirednessLabel.required,
  'required-by-tool-setting': appCopy.ui.toolPage.flow.requirednessLabel.required,
  'optional-by-tool-setting': appCopy.ui.toolPage.flow.requirednessLabel.optional,
};

const deriveProgressBarModel = (s: CanonicalToolUiState): ProgressBarModel => {
  if (s === 'processing-briefing') {
    return {
      phase: 'extraction',
      variant: 'active',
      ariaLabel: appCopy.ui.toolPage.flow.progressAria.extractionInProgress,
    };
  }

  if (s === 'running') {
    return {
      phase: 'generation',
      variant: 'active',
      ariaLabel: appCopy.ui.toolPage.flow.progressAria.generationInProgress,
    };
  }

  if (s === 'completed') {
    return {
      phase: 'generation',
      variant: 'completed',
      ariaLabel: appCopy.ui.toolPage.flow.progressAria.generationCompleted,
    };
  }

  if (s === 'paused-with-checkpoint') {
    return {
      phase: 'generation',
      variant: 'idle',
      ariaLabel: appCopy.ui.toolPage.flow.progressAria.generationPaused,
    };
  }

  if (s === 'draft-ready') {
    return {
      phase: 'extraction',
      variant: 'idle',
      ariaLabel: appCopy.ui.toolPage.flow.progressAria.extractionCompleted,
    };
  }

  if (s === 'draft-empty' || s === 'resume-needs-briefing') {
    return {
      phase: 'extraction',
      variant: 'idle',
      ariaLabel: appCopy.ui.toolPage.flow.progressAria.extractionIdle,
    };
  }

  return {
    phase: 'generation',
    variant: 'idle',
    ariaLabel: appCopy.ui.toolPage.flow.progressAria.waitingStart,
  };
};

// ─── main component ──────────────────────────────────────────────────────────

export const ToolGenerationFlowVertical = ({
  canonicalState,
  projectName,
  errorMessage,
  inputFilePayload = [],
  generationProgress,
  primaryActionCta,
}: ToolGenerationFlowVerticalProps) => {
  const statusText = STATUS_TEXT[canonicalState];
  const progressBarModel = deriveProgressBarModel(canonicalState);
  const barVariant = progressBarModel.variant;
  const isCompleted = barVariant === 'completed';
  const payloadItems = inputFilePayload;
  const hasProjectSelected = Boolean(projectName && projectName.trim().length > 0);
  const phaseTitle = progressBarModel.phase === 'extraction'
    ? appCopy.ui.toolPage.flow.phaseExtractionLabel
    : appCopy.ui.toolPage.flow.phaseGenerationLabel;
  const completedCount = generationProgress?.completedCount ?? 0;
  const totalCount = generationProgress?.totalCount ?? 0;
  const extractionProgress = generationProgress?.extractionProgress;
  const progressValue = isCompleted
    ? 100
    : progressBarModel.phase === 'extraction'
      ? (extractionProgress?.totalCount ?? 0) > 0
        ? Math.min(100, Math.round(((extractionProgress?.completedCount ?? 0) / (extractionProgress?.totalCount ?? 1)) * 100))
        : barVariant === 'active'
          ? 50
          : 0
      : totalCount > 0
        ? Math.min(100, Math.round((completedCount / totalCount) * 100))
        : barVariant === 'active' || barVariant === 'paused'
          ? 50
          : 0;
  const extractionMetricText =
    extractionProgress?.statusLabel
    ?? (canonicalState === 'processing-briefing'
      ? appCopy.ui.toolPage.extraction.inProgressStatusLabel
      : canonicalState === 'draft-ready'
        ? appCopy.ui.toolPage.extraction.completedStatusLabel
        : appCopy.ui.toolPage.extraction.idleStatusLabel);

  const primaryProgressMetric =
    progressBarModel.phase === 'generation'
      ? generationProgress?.currentStepLabel
        ? `${appCopy.ui.toolPage.flow.currentStepPrefix}${generationProgress.currentStepLabel}`
        : null
      : `${appCopy.ui.toolPage.flow.currentStepPrefix}${extractionProgress?.currentStepLabel ?? appCopy.ui.toolPage.flow.defaultExtractionStepLabel}`;

  const secondaryProgressMetric =
    progressBarModel.phase === 'generation'
      ? generationProgress
        ? `${generationProgress.completedCount} / ${generationProgress.totalCount} ${appCopy.ui.toolPage.flow.stepsCompletedSuffix}`
        : null
      : extractionMetricText;

  return (
    <div className="ui-fv-root" role="region" aria-label={appCopy.ui.toolPage.flow.ariaRegionLabel}>
      <div className="ui-fv-dashboard">
        <section className="ui-fv-card ui-fv-card--progress" aria-labelledby="workflow-progress-title">
          <div className="ui-fv-card-header">
            <span className="ui-fv-label" id="workflow-progress-title">{phaseTitle}</span>
            <p className="workflow-status-text" aria-live="polite">{statusText}</p>
          </div>

          {primaryProgressMetric ? (
            <span className="ui-fv-progress-metric">{primaryProgressMetric}</span>
          ) : null}

          <div
            className={`workflow-preload-bar is-${barVariant}`}
            role={barVariant !== 'hidden' ? 'progressbar' : undefined}
            aria-label={barVariant !== 'hidden' ? progressBarModel.ariaLabel : undefined}
            aria-valuenow={barVariant === 'hidden' ? undefined : progressValue}
            aria-valuemin={barVariant === 'hidden' ? undefined : 0}
            aria-valuemax={barVariant === 'hidden' ? undefined : 100}
          />

          {secondaryProgressMetric ? (
            <p className="ui-fv-progress-metric" aria-live="polite">
              {secondaryProgressMetric}
            </p>
          ) : null}

          {primaryActionCta ? (
            <button
              type="button"
              className={cx(uiPrimitives.button, 'ui-fv-session-button')}
              onClick={primaryActionCta.onClick}
              disabled={primaryActionCta.disabled}
              title={primaryActionCta.tooltip}
            >
              {primaryActionCta.isLoading ? appCopy.ui.toolPage.flow.loadingActionLabel : primaryActionCta.label}
            </button>
          ) : null}
        </section>

        <section className="ui-fv-card" aria-labelledby="workflow-context-title">
          <div className="ui-fv-card-header">
            <span className="ui-fv-label" id="workflow-context-title">{appCopy.ui.toolPage.flow.contextLoadedTitle}</span>
          </div>

          <div className={`ui-fv-context-project ${hasProjectSelected ? 'is-done' : ''}`.trim()}>
            <span className="ui-fv-project-title">{appCopy.ui.toolPage.flow.projectLabel}</span>
            <p className="ui-fv-project-name">{projectName ?? appCopy.ui.toolPage.flow.noProjectSelected}</p>
          </div>

          <div className="ui-fv-payload-list" aria-label={appCopy.ui.toolPage.flow.ariaContextFilesLabel}>
            {hasProjectSelected && payloadItems.length > 0 ? payloadItems.map((item) => (
              <div className={`ui-fv-payload-item is-${item.status}`} key={item.key} data-status={item.status}>
                <div className="ui-fv-payload-item-main">
                  <span className="ui-fv-payload-label">{item.label}</span>
                  <span className="ui-fv-payload-filename">{item.fileName ?? appCopy.ui.toolPage.flow.notUploaded}</span>
                </div>
                <span className="ui-fv-payload-pill">{REQUIREDNESS_LABEL[item.requiredness]}</span>
              </div>
            )) : hasProjectSelected ? (
              <p className="ui-fv-empty-state">
                {appCopy.ui.toolPage.flow.noFilesUploaded}
              </p>
            ) : null}
          </div>

        </section>
      </div>
      {errorMessage && <p className="ui-fv-error" role="alert">{errorMessage}</p>}
    </div>
  );
};
