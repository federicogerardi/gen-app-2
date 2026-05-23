import type { CanonicalToolUiState } from '../../generation/ui/tool-ux-state';
import { Link } from 'react-router-dom';

// ─── DDD-084: simplified Workflow Panel contract (supersedes DDD-082, DDD-083) ─

type InputFilePayloadStatus = {
  key: string;
  label: string;
  requiredness: 'always-required' | 'required-by-tool-setting' | 'optional-by-tool-setting';
  status: 'todo' | 'active' | 'done' | 'error';
  fileName: string | null;
};

type ToolStepRailItem = {
  key: string;
  label: string;
  status: 'idle' | 'running' | 'done' | 'error';
};

type GenerationProgressSnapshot = {
  completedCount: number;
  totalCount: number;
  currentStepLabel: string | null;
  stepItems: ToolStepRailItem[];
  sessionId: string | null;
};

export interface ToolGenerationFlowVerticalProps {
  canonicalState: CanonicalToolUiState;
  projectName: string | null;
  errorMessage: string | null;
  inputFilePayload?: InputFilePayloadStatus[];
  generationProgress?: GenerationProgressSnapshot;
}

// ─── STATUS_TEXT map (DDD-084) ───────────────────────────────────────────────

const STATUS_TEXT: Record<CanonicalToolUiState, string> = {
  'draft-empty':            '',
  'processing-briefing':    'Estrazione in corso…',
  'draft-ready':            'Pronto per la generazione',
  'resume-needs-briefing':  'Carica un nuovo briefing per continuare',
  'prefilled-regenerate':   'Pronto per rigenerare',
  'paused-with-checkpoint': 'Generazione in pausa',
  running:                  'Generazione in corso…',
  completed:                'Generazione completata',
};

type BarVariant = 'hidden' | 'idle' | 'active' | 'paused' | 'completed';

const deriveBarVariant = (s: CanonicalToolUiState): BarVariant => {
  if (s === 'draft-empty') return 'hidden';
  if (s === 'running') return 'active';
  if (s === 'paused-with-checkpoint') return 'paused';
  if (s === 'completed') return 'completed';
  return 'idle';
};

// ─── main component ──────────────────────────────────────────────────────────

export const ToolGenerationFlowVertical = ({
  canonicalState,
  projectName,
  errorMessage,
  inputFilePayload = [],
  generationProgress,
}: ToolGenerationFlowVerticalProps) => {
  const statusText = STATUS_TEXT[canonicalState];
  const barVariant = deriveBarVariant(canonicalState);
  const isCompleted = barVariant === 'completed';
  const payloadItems = inputFilePayload;
  const completedCount = generationProgress?.completedCount ?? 0;
  const totalCount = generationProgress?.totalCount ?? 0;
  const progressValue = isCompleted
    ? 100
    : totalCount > 0
      ? Math.min(100, Math.round((completedCount / totalCount) * 100))
      : barVariant === 'active' || barVariant === 'paused'
        ? 50
        : 0;
  const showSessionSummaryLink = Boolean(generationProgress?.sessionId) && (canonicalState === 'draft-ready' || canonicalState === 'completed');

  return (
    <div className="ui-fv-root" role="region" aria-label="Generation flow">
      <div className="ui-fv-header">
        <span className="ui-fv-label">Progetto</span>
        <p className="ui-fv-project-name">{projectName ?? 'Nessun progetto selezionato'}</p>
      </div>
      <div className="ui-fv-dashboard">
        <section className="ui-fv-card" aria-labelledby="workflow-payload-title">
          <div className="ui-fv-card-header">
            <span className="ui-fv-label" id="workflow-payload-title">Payload caricato</span>
            <p className="workflow-status-text" aria-live="polite">{statusText}</p>
          </div>

          <div className="ui-fv-payload-list" aria-label="Payload files">
            {payloadItems.length > 0 ? payloadItems.map((item) => (
              <div className={`ui-fv-payload-item is-${item.status}`} key={item.key} data-status={item.status}>
                <div className="ui-fv-payload-item-main">
                  <span className="ui-fv-payload-label">{item.label}</span>
                  <span className="ui-fv-payload-filename">{item.fileName ?? 'Non caricato'}</span>
                </div>
                <span className="ui-fv-payload-pill">{item.requiredness}</span>
              </div>
            )) : (
              <p className="ui-fv-empty-state">Nessun file caricato</p>
            )}
          </div>

          {showSessionSummaryLink && generationProgress?.sessionId ? (
            <Link className="ui-fv-session-link" to={`/sessionsummary/${generationProgress.sessionId}`}>
              Apri sessione →
            </Link>
          ) : null}
        </section>

        <section className="ui-fv-card" aria-labelledby="workflow-progress-title">
          <div className="ui-fv-card-header">
            <span className="ui-fv-label" id="workflow-progress-title">Progressione</span>
            {generationProgress?.currentStepLabel ? (
              <span className="ui-fv-progress-metric">Step corrente: {generationProgress.currentStepLabel}</span>
            ) : null}
          </div>

          <div
            className={`workflow-preload-bar is-${barVariant}`}
            role={barVariant !== 'hidden' ? 'progressbar' : undefined}
            aria-label={
              barVariant === 'active' ? 'Generazione in corso' :
              barVariant === 'paused' ? 'Generazione in pausa' :
              barVariant === 'completed' ? 'Generazione completata' :
              barVariant === 'idle' ? 'In attesa di avvio' :
              undefined
            }
            aria-valuenow={barVariant === 'hidden' ? undefined : progressValue}
            aria-valuemin={barVariant === 'hidden' ? undefined : 0}
            aria-valuemax={barVariant === 'hidden' ? undefined : 100}
          />

          {generationProgress ? (
            <p className="ui-fv-progress-metric" aria-live="polite">
              {generationProgress.completedCount} / {generationProgress.totalCount} step completati
            </p>
          ) : null}
        </section>

        {generationProgress?.stepItems?.length ? (
          <section className="ui-fv-card" aria-labelledby="workflow-step-title">
            <div className="ui-fv-card-header">
              <span className="ui-fv-label" id="workflow-step-title">Step rail</span>
            </div>

            <ol className="ui-fv-step-rail">
              {generationProgress.stepItems.map((item) => (
                <li
                  className={`ui-fv-step-item is-${item.status}`}
                  key={item.key}
                  aria-current={item.status === 'running' ? 'step' : undefined}
                  data-status={item.status}
                >
                  <span className="ui-fv-step-label">{item.label}</span>
                  <span className="ui-fv-step-status">{item.status}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
      {errorMessage && <p className="ui-fv-error" role="alert">{errorMessage}</p>}
    </div>
  );
};
