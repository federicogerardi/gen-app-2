import { appCopy } from '../../../app/copy/system';
import { ToolWorkflowJobStepTracker } from './ToolWorkflowJobStepTracker';

type StepStatus = 'idle' | 'running' | 'done' | 'error';

type ToolWorkflowJobPanelProps = {
  jobId: string;
  toolKey: string;
  stepStatuses: Record<string, StepStatus>;
  stepLabels: Record<string, string>;
  currentRunningStep: string | null;
  completedSteps: string[];
  errorMessage: string | null;
  isStreamActive: boolean;
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

export const ToolWorkflowJobPanel = ({
  jobId,
  stepStatuses,
  stepLabels,
  currentRunningStep,
  completedSteps,
  errorMessage,
  isStreamActive,
  onCancel,
}: ToolWorkflowJobPanelProps) => {
  const totalSteps = Object.keys(stepStatuses).length;
  const panelStatus = resolvePanelStatus(isStreamActive, currentRunningStep, completedSteps, totalSteps, errorMessage);

  const stepItems = Object.entries(stepStatuses).map(([key, status]) => ({
    key,
    label: stepLabels[key] ?? key,
    status,
  }));

  return (
    <div className="ui-twjob-panel" role="region" aria-label={`Tool workflow job ${jobId}`}>
      <header className="ui-twjob-panel-header">
        <span className={`ui-twjob-status-badge ui-twjob-status-badge--${panelStatus}`}>
          {statusCopy[panelStatus]}
        </span>
        {currentRunningStep && (
          <span className="ui-twjob-current-step">
            {stepLabels[currentRunningStep] ?? currentRunningStep}
          </span>
        )}
      </header>

      <div className="ui-twjob-panel-body">
        <ToolWorkflowJobStepTracker steps={stepItems} />
      </div>

      {errorMessage && (
        <div className="ui-twjob-panel-error" role="alert">
          {errorMessage}
        </div>
      )}

      {!isStreamActive && panelStatus === 'running' && (
        <div className="ui-twjob-panel-reconnecting" aria-live="polite">
          {streamCopy.connectionLost}
        </div>
      )}

      {panelStatus === 'running' && onCancel && (
        <footer className="ui-twjob-panel-footer">
          <button
            type="button"
            className="ui-twjob-cancel-btn"
            onClick={onCancel}
          >
            {cancelCopy.label}
          </button>
        </footer>
      )}
    </div>
  );
};
