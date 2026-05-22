import type { CanonicalToolUiState } from '../../generation/ui/tool-ux-state';

// ─── DDD-082: InputFilePayloadStatus ─────────────────────────────────────────
export type InputFilePayloadStatus = {
  key: string;
  label: string;
  requiredness: 'always-required' | 'required-by-tool-setting' | 'optional-by-tool-setting';
  status: 'todo' | 'active' | 'done' | 'error';
  fileName: string | null;
};

// ─── DDD-063: WorkflowPanelFeedbackItem (FeedbackChannel inline-action) ──────
export type WorkflowPanelFeedbackItem = {
  id: string;
  severity: 'error' | 'info';
  message: string;
  source?: string;
};

export interface ToolGenerationFlowVerticalProps {
  canonicalState: CanonicalToolUiState;
  projectName: string | null;
  inputFilePayload: InputFilePayloadStatus[];
  workflowPanelFeedback: WorkflowPanelFeedbackItem[];
  errorMessage: string | null;
}

// ─── derivation helpers ──────────────────────────────────────────────────────

type FlowPhase = 'input' | 'monitoring' | 'completion';

const derivePhase = (s: CanonicalToolUiState): FlowPhase => {
  if (s === 'completed') return 'completion';
  if (s === 'running' || s === 'paused-with-checkpoint' || s === 'prefilled-regenerate') return 'monitoring';
  return 'input';
};

const WHERE_LABEL: Record<CanonicalToolUiState, string> = {
  'draft-empty': 'Setup',
  'processing-briefing': 'Setup',
  'draft-ready': 'Ready',
  'resume-needs-briefing': 'Resume',
  'prefilled-regenerate': 'Regenerate',
  'paused-with-checkpoint': 'Paused',
  running: 'Generating',
  completed: 'Complete',
};

const PAYLOAD_ICON: Record<InputFilePayloadStatus['status'], string> = {
  todo: '○',
  active: '⟳',
  done: '✓',
  error: '✕',
};

const deriveInstruction = (
  canonicalState: CanonicalToolUiState,
  projectName: string | null,
): string => {
  if (canonicalState === 'running') return 'Generazione in corso';
  if (canonicalState === 'paused-with-checkpoint') return 'In pausa — riprendi dal checkpoint';
  if (canonicalState === 'prefilled-regenerate') return 'Contesto caricato — avvia la rigenerazione';
  if (canonicalState === 'resume-needs-briefing') return 'Carica un nuovo briefing per continuare';
  if (canonicalState === 'completed') return 'Tutti gli artefatti sono stati generati';
  if (!projectName) return 'Seleziona un progetto per iniziare';
  return 'Carica il file di briefing per proseguire';
};

// ─── sub-components ──────────────────────────────────────────────────────────

const Label = ({ children }: { children: string }) => (
  <span className="ui-fv-label">{children}</span>
);

const PayloadRow = ({ item }: { item: InputFilePayloadStatus }) => {
  const isOptional = item.requiredness === 'optional-by-tool-setting';
  const isSpinning = item.status === 'active';
  return (
    <li className={`ui-fv-payload-row is-${item.status}`}>
      <span className={`ui-fv-payload-icon${isSpinning ? ' is-spinning' : ''}`}>
        {PAYLOAD_ICON[item.status]}
      </span>
      <span className="ui-fv-payload-label">{item.label}</span>
      {item.fileName && (
        <span className="ui-fv-payload-filename" title={item.fileName}>{item.fileName}</span>
      )}
      {isOptional && item.status === 'todo' && (
        <span className="ui-fv-payload-optional-badge">opzionale</span>
      )}
      {isSpinning && (
        <span className="ui-fv-status-label">In corso</span>
      )}
    </li>
  );
};

const FeedbackRow = ({ item }: { item: WorkflowPanelFeedbackItem }) => (
  <li
    className={`ui-fv-feedback-item is-${item.severity}`}
    role={item.severity === 'error' ? 'alert' : 'status'}
  >
    <span className="ui-fv-feedback-icon">{item.severity === 'error' ? '✕' : 'ℹ'}</span>
    <span className="ui-fv-feedback-message">{item.message}</span>
  </li>
);

// ─── main component ──────────────────────────────────────────────────────────

export const ToolGenerationFlowVertical = ({
  canonicalState,
  projectName,
  inputFilePayload,
  workflowPanelFeedback,
  errorMessage,
}: ToolGenerationFlowVerticalProps) => {
  const phase = derivePhase(canonicalState);
  const whereLabel = WHERE_LABEL[canonicalState];
  const instruction = deriveInstruction(canonicalState, projectName);
  const isMonitoring = canonicalState === 'running' || canonicalState === 'paused-with-checkpoint';
  const isPaused = canonicalState === 'paused-with-checkpoint';

  return (
    <div className="ui-fv-root" role="region" aria-label="Generation flow">

      {/* Phase anchor ──────────────────────────────────── */}
      <div className="ui-fv-section">
        <span className="ui-fv-where-value">{whereLabel}</span>
        <span className="ui-fv-where-hint">{instruction}</span>
      </div>

      {/* Global error (machine-level) ──────────────────── */}
      {errorMessage && (
        <div className="ui-fv-error" role="alert">{errorMessage}</div>
      )}

      {/* PAYLOAD CARICATO — persistent across all phases ─ */}
      {inputFilePayload.length > 0 && (
        <div className="ui-fv-section">
          <Label>Payload caricato</Label>
          <ul className="ui-fv-payload-list" aria-live="polite">
            {inputFilePayload.map((item) => (
              <PayloadRow key={item.key} item={item} />
            ))}
          </ul>
        </div>
      )}

      {/* MONITORING — indeterminate progress ──────────────
          Guard: running / paused-with-checkpoint only.
          prefilled-regenerate intentionally excluded. */}
      {isMonitoring && (
        <div className="ui-fv-section">
          <div className="ui-fv-progress-wrap">
            <div className="ui-fv-progress-bar">
              <div
                className={`ui-fv-indeterminate-bar${isPaused ? ' is-paused' : ''}`}
                role="progressbar"
                aria-label={isPaused ? 'Generazione in pausa' : 'Generazione in corso'}
              />
            </div>
          </div>
          <div className="ui-fv-reassurance" aria-live="polite">
            {isPaused ? (
              <>
                <strong>In pausa</strong>
                <p>La generazione è in pausa. Riprendi dal checkpoint quando sei pronto.</p>
              </>
            ) : (
              <>
                <strong>Elaborazione attiva</strong>
                <p>Il processo è attivo e richiede alcuni minuti. Puoi tenere la pagina aperta: il risultato apparirà automaticamente.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* COMPLETION ────────────────────────────────────── */}
      {phase === 'completion' && (
        <div className="ui-fv-section">
          <div className="ui-fv-completion-check" role="status">
            <span className="ui-fv-completion-icon">✓</span>
            <span className="ui-fv-completion-text">Generazione completata</span>
          </div>
          <p className="ui-fv-completion-hint" aria-live="polite">
            Apertura riepilogo sessione in corso...
          </p>
        </div>
      )}

      {/* FEEDBACK — conditional, any phase ─────────────── */}
      {workflowPanelFeedback.length > 0 && (
        <div className="ui-fv-section">
          <Label>Feedback</Label>
          <ul className="ui-fv-feedback-list">
            {workflowPanelFeedback.map((item) => (
              <FeedbackRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
      )}

    </div>
  );
};
