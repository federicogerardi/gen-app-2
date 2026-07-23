import { appCopy } from '../../../app/copy/system';

type StepItem = {
  key: string;
  label: string;
  status: 'idle' | 'running' | 'done' | 'error';
};

type ToolWorkflowJobStepTrackerProps = {
  steps: StepItem[];
};

const statusIcon: Record<StepItem['status'], string> = {
  idle: '\u25CB',
  running: '\u25CF',
  done: '\u2713',
  error: '\u2717',
};

const statusCopy = appCopy.ui.toolWorkflowJob.stepTracker;

export const ToolWorkflowJobStepTracker = ({ steps }: ToolWorkflowJobStepTrackerProps) => {
  return (
    <ul className="ui-twjob-step-tracker" role="list" aria-live="polite">
      {steps.map((step) => (
        <li
          key={step.key}
          className={`ui-twjob-step ui-twjob-step--${step.status}`}
          aria-label={`${step.label}: ${statusCopy[step.status]}`}
          {...(step.status === 'running' ? { 'aria-current': 'step' as const } : {})}
        >
          <span className="ui-twjob-step-icon" aria-hidden="true">
            {statusIcon[step.status]}
          </span>
          <span className="ui-twjob-step-label">{step.label}</span>
          <span className="ui-twjob-step-status">{statusCopy[step.status]}</span>
        </li>
      ))}
    </ul>
  );
};
