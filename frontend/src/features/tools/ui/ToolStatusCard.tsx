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

import { Surface, uiPrimitives } from '../../../app/ui/primitives';
import type { CanonicalToolUiState } from '../runtime/tool-ux-state';

type StatusItemStatus = 'todo' | 'active' | 'done' | 'error';

const CANONICAL_STATE_LABEL: Record<string, string> = {
  'draft-empty': 'In attesa di configurazione',
  'processing-briefing': 'Elaborazione brief in corso',
  'draft-ready': 'Pronto per avviare',
  'prefilled-regenerate': 'Contesto caricato — pronto a rigenerare',
  'paused-with-checkpoint': 'In pausa — riprendi dal checkpoint',
  'resume-needs-briefing': 'Carica un brief per continuare',
  'running': 'Generazione in corso',
  'completed': 'Completato',
};

const toReadableState = (state: string): string =>
  CANONICAL_STATE_LABEL[state] ?? state;

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
      label: 'Progetto',
      status: projectName ? 'done' : 'todo',
      detail: projectName ?? 'Seleziona un progetto',
    },
    {
      label: 'Brief',
      status: briefingFileName
        ? 'done'
        : canonicalState === 'processing-briefing'
          ? 'active'
          : 'todo',
      detail: briefingFileName ?? 'Carica il documento di brief',
    },
    {
      label: `Step (${completedStepsCount}/${totalStepsCount})`,
      status: completedStepsCount === totalStepsCount ? 'done' : 'active',
      detail: canonicalState === 'completed'
        ? 'Tutti gli step completati'
        : `${totalStepsCount - completedStepsCount} rimanenti`,
    },
    {
      label: 'Stato',
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
        <h3>Stato della generazione</h3>
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
