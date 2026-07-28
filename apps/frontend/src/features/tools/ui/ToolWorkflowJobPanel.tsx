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
  /* Pre-flight readiness (Phase 1) */
  workspaceName: string | null;
  briefingFileName: string | null;
  isBriefingReady: boolean;
  onCancel?: () => void;
};

const statusCopy = appCopy.ui.toolWorkflowJob.status;
const cancelCopy = appCopy.ui.toolWorkflowJob.cancel;
const streamCopy = appCopy.ui.toolWorkflowJob.stream;

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
  onCancel,
}: ToolWorkflowJobPanelProps) => {
  const totalSteps = stepItems.length;
  const panelStatus = resolvePanelStatus(isStreamActive, currentRunningStep, completedSteps, totalSteps, errorMessage);
  const barVariant = barVariantByStatus[panelStatus] ?? 'idle';

  const currentStepLabel = currentRunningStep
    ? (stepLabels[currentRunningStep] ?? currentRunningStep)
    : null;

  const completedCount = completedSteps.length;

  return (
    <div className="ui-fv-dashboard" role="region" aria-label={`Tool workflow job ${jobId}`}>
      {/* ── Pre-flight readiness (Phase 1): shows workspace + briefing confirmed ── */}
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
          {currentStepLabel && (
            <>
              {' — '}
              <span className="ui-twjob-current-step">{currentStepLabel}</span>
            </>
          )}
        </p>
      </div>

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

      {/* ── Error ── */}
      {errorMessage && (
        <div className="ui-fv-card" role="alert">
          <p className={cx(uiPrimitives.error)}>{errorMessage}</p>
        </div>
      )}

      {/* ── Reconnecting ── */}
      {!isStreamActive && panelStatus === 'running' && (
        <div className="ui-fv-card" aria-live="polite">
          <p className="ui-twjob-reconnecting">{streamCopy.connectionLost}</p>
        </div>
      )}

      {/* ── Cancel ── */}
      {panelStatus === 'running' && onCancel && (
        <button
          type="button"
          className={cx(uiPrimitives.button, 'ui-twjob-cancel-btn')}
          onClick={onCancel}
        >
          {cancelCopy.label}
        </button>
      )}
    </div>
  );
};