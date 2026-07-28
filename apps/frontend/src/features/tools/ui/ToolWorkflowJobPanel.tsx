import { Link } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { cx, uiPrimitives } from '../../../app/ui/primitives';
import { PreFlightReadiness } from './PreFlightReadiness';

type StepStatus = 'idle' | 'running' | 'done' | 'error';

type StepItem = {
  key: string;
  label: string;
  status: StepStatus;
};

type ToolWorkflowJobPanelProps = {
  jobId: string;
  toolKey: string;
  stepItems: StepItem[];
  stepLabels: Record<string, string>;
  currentRunningStep: string | null;
  completedSteps: string[];
  errorMessage: string | null;
  isStreamActive: boolean;
  /* Phase 1: pre-flight readiness */
  workspaceName: string | null;
  briefingFileName: string | null;
  isBriefingReady: boolean;
  /* Phase 2: action bar */
  sessionId: string | null;
  onCancel?: () => void;
  onRetry?: () => void;
};

const statusCopy = appCopy.ui.toolWorkflowJob.status;
const cancelCopy = appCopy.ui.toolWorkflowJob.cancel;
const streamCopy = appCopy.ui.toolWorkflowJob.stream;
const fpCopy = appCopy.ui.toolPage.feedbackPanel;

const resolvePanelStatus = (
  isStreamActive: boolean,
  currentRunningStep: string | null,
  completedSteps: string[],
  totalSteps: number,
  errorMessage: string | null,
): 'queued' | 'running' | 'completed' | 'failed' => {
  if (errorMessage) return 'failed';
  if (completedSteps.length >= totalSteps && totalSteps > 0) return 'completed';
  if (isStreamActive || currentRunningStep) return 'running';
  return 'queued';
};

type BarVariant = 'hidden' | 'idle' | 'active' | 'completed';
const barVariantByStatus: Record<string, BarVariant> = {
  queued: 'active',
  running: 'active',
  completed: 'completed',
  failed: 'idle',
};

/**
 * Derive a human-readable activity description for the current step.
 * Falls back to the step status label if no per-step copy exists.
 */
const deriveActivityText = (
  panelStatus: 'queued' | 'running' | 'completed' | 'failed',
  currentStepLabel: string | null,
): string | null => {
  if (panelStatus === 'running' && currentStepLabel) {
    return `${currentStepLabel}…`;
  }
  if (panelStatus === 'completed') {
    return fpCopy.completedSummary
      ? fpCopy.completedSummary(0) /* count injected by parent */
      : statusCopy.completed;
  }
  return null;
};

export const ToolWorkflowJobPanel = ({
  jobId,
  stepItems,
  stepLabels,
  currentRunningStep,
  completedSteps,
  errorMessage,
  isStreamActive,
  workspaceName,
  briefingFileName,
  isBriefingReady,
  sessionId,
  onCancel,
  onRetry,
}: ToolWorkflowJobPanelProps) => {
  const totalSteps = stepItems.length;
  const panelStatus = resolvePanelStatus(isStreamActive, currentRunningStep, completedSteps, totalSteps, errorMessage);
  const barVariant = barVariantByStatus[panelStatus] ?? 'idle';

  const currentStepLabel = currentRunningStep
    ? (stepLabels[currentRunningStep] ?? currentRunningStep)
    : null;

  const completedCount = completedSteps.length;
  const activityText = deriveActivityText(panelStatus, currentStepLabel);

  return (
    <div className="ui-fv-dashboard" role="region" aria-label={`Tool workflow job ${jobId}`}>
      {/* ── Pre-flight readiness (Phase 1): workspace + briefing confirmed ── */}
      {panelStatus === 'queued' && (
        <PreFlightReadiness
          workspaceName={workspaceName}
          briefingFileName={briefingFileName}
          isBriefingReady={isBriefingReady}
        />
      )}

      {/* ── Phase label ── */}
      <p className="ui-fv-progress-metric">
        {appCopy.ui.toolPage.flow.phaseGenerationLabel}
      </p>

      {/* ── Card: progress bar + status ── */}
      <div className={cx('ui-fv-card', 'ui-fv-card--progress')}>
        <div className="ui-fv-card-header">
          <p className={`workflow-preload-bar is-${barVariant}`}>
            <span className="sr-only">
              {completedCount} {appCopy.ui.toolPage.flow.stepsCompletedSuffix}
            </span>
          </p>
        </div>

        <p className="ui-fv-progress-metric">
          <span className={`ui-twjob-status-text ui-twjob-status-text--${panelStatus}`}>
            {statusCopy[panelStatus]}
          </span>
          {currentStepLabel && panelStatus === 'running' && (
            <>
              {' — '}
              <span className="ui-twjob-current-step">{currentStepLabel}</span>
            </>
          )}
        </p>
      </div>

      {/* ── Current activity (Phase 2): human-readable "what's happening NOW" ── */}
      {activityText && (
        <p
          className="ui-twjob-activity"
          role="status"
          aria-live="polite"
        >
          {activityText}
        </p>
      )}

      {/* ── Step counter ── */}
      <p className="ui-fv-progress-metric">
        {appCopy.ui.toolPage.flow.currentStepPrefix}
        <strong>{completedCount}</strong> / {totalSteps}{' '}
        {appCopy.ui.toolPage.flow.stepsCompletedSuffix}
      </p>

      {/* ── Step tracker ── */}
      <div className={cx('ui-fv-card', 'ui-twjob-step-card')}>
        <ul className="ui-twjob-step-list" role="list" aria-live="polite">
          {stepItems.map((step, index) => (
            <li
              key={step.key}
              className={cx(
                'ui-twjob-step',
                `ui-twjob-step--${step.status}`,
              )}
              aria-label={`${step.label}: ${appCopy.ui.toolWorkflowJob.stepTracker[step.status]}`}
              {...(step.status === 'running' ? { 'aria-current': 'step' as const } : {})}
            >
              <span className="ui-twjob-step-icon" aria-hidden="true" />
              <span className="ui-twjob-step-label">{step.label}</span>
              <span className="ui-twjob-step-count">
                {step.status === 'done' ? '✓' : step.status === 'running' ? `${index + 1}/${totalSteps}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Error + Retry (Phase 2) ── */}
      {errorMessage && panelStatus === 'failed' && (
        <div className="ui-fv-card" role="alert">
          <p className={cx(uiPrimitives.error)}>{errorMessage}</p>
          {onRetry && (
            <button
              type="button"
              className={cx(uiPrimitives.button, 'ui-twjob-retry-btn')}
              onClick={onRetry}
            >
              {fpCopy.actionRetry ?? 'Retry'}
            </button>
          )}
        </div>
      )}

      {/* ── Reconnecting ── */}
      {!isStreamActive && panelStatus === 'running' && (
        <div className="ui-fv-card" aria-live="polite">
          <p className="ui-twjob-reconnecting">{streamCopy.connectionLost}</p>
        </div>
      )}

      {/* ── Action bar (Phase 2): contextual CTA per state ── */}
      {panelStatus === 'running' && onCancel && (
        <button
          type="button"
          className={cx(uiPrimitives.button, 'ui-twjob-cancel-btn')}
          onClick={onCancel}
        >
          {cancelCopy.label}
        </button>
      )}

      {panelStatus === 'completed' && sessionId && (
        <Link
          to={`/sessions/${sessionId}`}
          className={cx(uiPrimitives.button, 'ui-twjob-view-results-btn')}
        >
          {fpCopy.actionViewResults ?? 'View Results'}
        </Link>
      )}
    </div>
  );
};