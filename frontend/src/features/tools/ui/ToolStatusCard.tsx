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

import type { ReactNode } from 'react';
import { Surface, uiPrimitives } from '../../../app/ui/primitives';
import type { CanonicalToolUiState } from '../runtime/tool-ux-state';

type StatusItemStatus = 'todo' | 'active' | 'done' | 'error';

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
      label: 'Project',
      status: projectName ? 'done' : 'todo',
      detail: projectName ?? 'Select a project',
    },
    {
      label: 'Briefing',
      status: briefingFileName
        ? 'done'
        : canonicalState === 'processing-briefing'
          ? 'active'
          : 'todo',
      detail: briefingFileName ?? 'Upload briefing file',
    },
    {
      label: `Steps (${completedStepsCount}/${totalStepsCount})`,
      status: completedStepsCount === totalStepsCount ? 'done' : 'active',
      detail: canonicalState === 'completed'
        ? 'All steps completed'
        : `${totalStepsCount - completedStepsCount} remaining`,
    },
    {
      label: 'Status',
      status: canonicalState === 'running'
        ? 'active'
        : errorMessage
          ? 'error'
          : canonicalState === 'draft-ready'
            ? 'todo'
            : 'done',
      detail: errorMessage ?? statusMessage ?? canonicalState,
    },
  ];

  return (
    <Surface className="ui-tool-status-card">
      <div className="ui-tool-status-header">
        <h3>Generation Status</h3>
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
