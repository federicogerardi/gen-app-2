import type { CanonicalToolUiState } from '../../generation/ui/tool-ux-state';

// ─── DDD-084: simplified Workflow Panel contract (supersedes DDD-082, DDD-083) ─

export interface ToolGenerationFlowVerticalProps {
  canonicalState: CanonicalToolUiState;
  projectName: string | null;
  errorMessage: string | null;
}

// ─── STATUS_TEXT map (DDD-084) ───────────────────────────────────────────────

const STATUS_TEXT: Record<CanonicalToolUiState, string> = {
  'draft-empty':            '',
  'processing-briefing':    'Elaborazione briefing…',
  'draft-ready':            'Pronto per la generazione',
  'resume-needs-briefing':  'Carica un nuovo briefing per continuare',
  'prefilled-regenerate':   'Pronto per rigenerare',
  'paused-with-checkpoint': 'In pausa',
  running:                  'Generazione in corso…',
  completed:                'Completato',
};

type BarVariant = 'hidden' | 'idle' | 'active' | 'paused' | 'done';

const deriveBarVariant = (s: CanonicalToolUiState): BarVariant => {
  if (s === 'draft-empty') return 'hidden';
  if (s === 'running') return 'active';
  if (s === 'paused-with-checkpoint') return 'paused';
  if (s === 'completed') return 'done';
  return 'idle';
};

// ─── main component ──────────────────────────────────────────────────────────

export const ToolGenerationFlowVertical = ({
  canonicalState,
  projectName,
  errorMessage,
}: ToolGenerationFlowVerticalProps) => {
  const statusText = STATUS_TEXT[canonicalState];
  const barVariant = deriveBarVariant(canonicalState);
  const isDone = barVariant === 'done';

  return (
    <div className="ui-fv-root" role="region" aria-label="Generation flow">
      <div className="ui-fv-header">
        <span className="ui-fv-label">Progetto</span>
        <p className="ui-fv-project-name">{projectName ?? 'Nessun progetto selezionato'}</p>
      </div>
      <div
        className={`workflow-preload-bar is-${barVariant}`}
        role={barVariant !== 'hidden' ? 'progressbar' : undefined}
        aria-label={
          barVariant === 'active' ? 'Generazione in corso' :
          barVariant === 'paused' ? 'Generazione in pausa' :
          undefined
        }
        aria-valuenow={isDone ? 100 : undefined}
        aria-valuemin={isDone ? 0 : undefined}
        aria-valuemax={isDone ? 100 : undefined}
      />
      {statusText && (
        <p className="workflow-status-text" aria-live="polite">{statusText}</p>
      )}
      {errorMessage && (
        <p className="ui-fv-error" role="alert">{errorMessage}</p>
      )}
    </div>
  );
};
