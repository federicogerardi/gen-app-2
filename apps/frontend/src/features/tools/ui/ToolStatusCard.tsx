/**
 * ToolStatusCard: Global feedback card for tool generation workflow
 * Displays readiness checklist and contextual status messages
 * 
 * Shows:
 * - Project selection status
 * - Briefing upload status
 * - Available steps readiness
 * - Generation workflow state
 */

import { appCopy } from '../../../app/copy/system';
import { Surface, uiPrimitives } from '../../../app/ui/primitives';
import type { CanonicalToolUiState } from '../../generation/ui/tool-ux-state';

type StatusItemStatus = 'todo' | 'active' | 'done' | 'error';

const toReadableState = (state: string): string =>
  appCopy.ui.toolWorkspaceStatus.canonicalStateLabels[state as keyof typeof appCopy.ui.toolWorkspaceStatus.canonicalStateLabels] ?? state;

interface StatusItem {
  label: string;
  status: StatusItemStatus;
  detail?: string;
}

interface ToolStatusCardProps {
  canonicalState: CanonicalToolUiState;
  statusMessage: string | null;
  errorMessage: string | null;
  projectName: string | null;
  briefingFileName: string | null;
  completedStepsCount: number;
  totalStepsCount: number;
}

const getStatusIcon = (status: StatusItemStatus): string => {
  switch (status) {
    case 'todo':
      return '○';
    case 'active':
      return '◐';
    case 'done':
      return '✓';
    case 'error':
      return '✕';
  }
};

const getStatusClass = (status: StatusItemStatus): string => {
  return `ui-tool-status-item is-${status}`;
};

export const ToolStatusCard = ({
  canonicalState,
  statusMessage,
  errorMessage,
  projectName,
  briefingFileName,
  completedStepsCount,
  totalStepsCount,
}: ToolStatusCardProps) => {
  // Build status items based on canonical state
  const items: StatusItem[] = [
    {
      label: appCopy.ui.toolWorkspaceStatus.projectLabel,
      status: projectName ? 'done' : 'todo',
      detail: projectName ?? appCopy.ui.toolWorkspaceStatus.projectMissing,
    },
    {
      label: appCopy.ui.toolWorkspaceStatus.briefingLabel,
      status: briefingFileName
        ? 'done'
        : canonicalState === 'processing-briefing'
          ? 'active'
          : 'todo',
      detail: briefingFileName ?? appCopy.ui.toolWorkspaceStatus.briefingMissing,
    },
    {
      label: appCopy.ui.toolWorkspaceStatus.stepLabel(completedStepsCount, totalStepsCount),
      status: completedStepsCount === totalStepsCount ? 'done' : 'active',
      detail: canonicalState === 'completed'
        ? appCopy.ui.toolWorkspaceStatus.stepCompletedDetail
        : `${totalStepsCount - completedStepsCount} ${appCopy.ui.toolWorkspaceStatus.stepRemainingSuffix}`,
    },
    {
      label: appCopy.ui.toolWorkspaceStatus.stateLabel,
      status: canonicalState === 'running'
        ? 'active'
        : errorMessage
          ? 'error'
          : canonicalState === 'draft-ready'
            ? 'todo'
            : 'done',
      detail: errorMessage ?? statusMessage ?? toReadableState(canonicalState),
    },
  ];

  return (
    <Surface className="ui-tool-status-card">
      <div className="ui-tool-status-header">
        <h3>{appCopy.ui.toolWorkspaceStatus.heading}</h3>
        {errorMessage && (
          <div className={uiPrimitives.error} role="alert">
            {errorMessage}
          </div>
        )}
      </div>

      <ul className={uiPrimitives.listClean}>
        {items.map(item => (
          <li key={item.label} className={getStatusClass(item.status)}>
            <span className="ui-tool-status-icon">{getStatusIcon(item.status)}</span>
            <span className="ui-tool-status-label">{item.label}</span>
            {item.detail && (
              <span className={uiPrimitives.metaLine}>{item.detail}</span>
            )}
          </li>
        ))}
      </ul>

      {statusMessage && !errorMessage && (
        <p className={uiPrimitives.metaLine}>{statusMessage}</p>
      )}
    </Surface>
  );
};
