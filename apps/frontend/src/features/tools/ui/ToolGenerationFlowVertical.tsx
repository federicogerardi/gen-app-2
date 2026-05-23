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

type GenerationProgressSnapshot = {
  completedCount: number;
  totalCount: number;
  currentStepLabel: string | null;
  sessionId: string | null;
  extractionProgress?: {
    completedCount: number;
    totalCount: number;
    currentStepLabel: string | null;
    statusLabel: string;
  };
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

type ProgressPhase = 'extraction' | 'generation';

type ProgressBarModel = {
  phase: ProgressPhase;
  variant: BarVariant;
  ariaLabel: string;
};

const deriveProgressBarModel = (s: CanonicalToolUiState): ProgressBarModel => {
  if (s === 'processing-briefing') {
    return {
      phase: 'extraction',
      variant: 'active',
      ariaLabel: 'Estrazione in corso',
    };
  }

  if (s === 'running') {
    return {
      phase: 'generation',
      variant: 'active',
      ariaLabel: 'Generazione in corso',
    };
  }

  if (s === 'completed') {
    return {
      phase: 'generation',
      variant: 'completed',
      ariaLabel: 'Generazione completata',
    };
  }

  if (s === 'paused-with-checkpoint') {
    return {
      phase: 'generation',
      variant: 'idle',
      ariaLabel: 'Generazione in pausa',
    };
  }

  if (s === 'draft-ready') {
    return {
      phase: 'extraction',
      variant: 'idle',
      ariaLabel: 'Estrazione completata',
    };
  }

  if (s === 'draft-empty' || s === 'resume-needs-briefing') {
    return {
      phase: 'extraction',
      variant: 'idle',
      ariaLabel: 'Estrazione in attesa',
    };
  }

  return {
    phase: 'generation',
    variant: 'idle',
    ariaLabel: 'In attesa di avvio',
  };
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
  const progressBarModel = deriveProgressBarModel(canonicalState);
  const barVariant = progressBarModel.variant;
  const isCompleted = barVariant === 'completed';
  const payloadItems = inputFilePayload;
  const hasProjectSelected = Boolean(projectName && projectName.trim().length > 0);
  const phaseTitle = progressBarModel.phase === 'extraction' ? 'Fase: Estrazione' : 'Fase: Generazione';
  const completedCount = generationProgress?.completedCount ?? 0;
  const totalCount = generationProgress?.totalCount ?? 0;
  const extractionProgress = generationProgress?.extractionProgress;
  const progressValue = isCompleted
    ? 100
    : progressBarModel.phase === 'extraction'
      ? (extractionProgress?.totalCount ?? 0) > 0
        ? Math.min(100, Math.round(((extractionProgress?.completedCount ?? 0) / (extractionProgress?.totalCount ?? 1)) * 100))
        : barVariant === 'active'
          ? 50
          : 0
      : totalCount > 0
        ? Math.min(100, Math.round((completedCount / totalCount) * 100))
        : barVariant === 'active' || barVariant === 'paused'
          ? 50
          : 0;
  const extractionMetricText =
    extractionProgress?.statusLabel
    ?? (canonicalState === 'processing-briefing'
      ? 'Estrazione briefing in corso'
      : canonicalState === 'draft-ready'
        ? 'Estrazione briefing completata'
        : 'Estrazione briefing in attesa');

  const primaryProgressMetric =
    progressBarModel.phase === 'generation'
      ? generationProgress?.currentStepLabel
        ? `Step corrente: ${generationProgress.currentStepLabel}`
        : null
      : `Step corrente: ${extractionProgress?.currentStepLabel ?? 'Estrazione briefing'}`;

  const secondaryProgressMetric =
    progressBarModel.phase === 'generation'
      ? generationProgress
        ? `${generationProgress.completedCount} / ${generationProgress.totalCount} step completati`
        : null
      : extractionMetricText;

  const showSessionSummaryLink = Boolean(generationProgress?.sessionId) && canonicalState === 'completed';

  return (
    <div className="ui-fv-root" role="region" aria-label="Generation flow">
      <div className="ui-fv-dashboard">
        <section className="ui-fv-card" aria-labelledby="workflow-progress-title">
          <div className="ui-fv-card-header">
            <span className="ui-fv-label" id="workflow-progress-title">{phaseTitle}</span>
            <p className="workflow-status-text" aria-live="polite">{statusText}</p>
          </div>

          {primaryProgressMetric ? (
            <span className="ui-fv-progress-metric">{primaryProgressMetric}</span>
          ) : null}

          <div
            className={`workflow-preload-bar is-${barVariant}`}
            role={barVariant !== 'hidden' ? 'progressbar' : undefined}
            aria-label={barVariant !== 'hidden' ? progressBarModel.ariaLabel : undefined}
            aria-valuenow={barVariant === 'hidden' ? undefined : progressValue}
            aria-valuemin={barVariant === 'hidden' ? undefined : 0}
            aria-valuemax={barVariant === 'hidden' ? undefined : 100}
          />

          {secondaryProgressMetric ? (
            <p className="ui-fv-progress-metric" aria-live="polite">
              {secondaryProgressMetric}
            </p>
          ) : null}
        </section>

        <section className="ui-fv-card" aria-labelledby="workflow-context-title">
          <div className="ui-fv-card-header">
            <span className="ui-fv-label" id="workflow-context-title">Contesto caricato</span>
          </div>

          <div className={`ui-fv-context-project ${hasProjectSelected ? 'is-done' : ''}`.trim()}>
            <span className="ui-fv-project-title">Progetto</span>
            <p className="ui-fv-project-name">{projectName ?? 'Nessun progetto selezionato'}</p>
          </div>

          <div className="ui-fv-payload-list" aria-label="Context files">
            {hasProjectSelected && payloadItems.length > 0 ? payloadItems.map((item) => (
              <div className={`ui-fv-payload-item is-${item.status}`} key={item.key} data-status={item.status}>
                <div className="ui-fv-payload-item-main">
                  <span className="ui-fv-payload-label">{item.label}</span>
                  <span className="ui-fv-payload-filename">{item.fileName ?? 'Non caricato'}</span>
                </div>
                <span className="ui-fv-payload-pill">{item.requiredness}</span>
              </div>
            )) : (
              <p className="ui-fv-empty-state">
                {hasProjectSelected
                  ? 'Nessun file caricato'
                  : 'Seleziona un progetto per visualizzare i file del contesto'}
              </p>
            )}
          </div>

          {showSessionSummaryLink && generationProgress?.sessionId ? (
            <Link className="ui-fv-session-link" to={`/sessionsummary/${generationProgress.sessionId}`}>
              Apri sessione →
            </Link>
          ) : null}
        </section>
      </div>
      {errorMessage && <p className="ui-fv-error" role="alert">{errorMessage}</p>}
    </div>
  );
};
