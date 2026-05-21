import type { CanonicalToolUiState } from '../runtime/tool-ux-state';
import type { ToolStep, ToolStepStatus } from '../machines/tool-flow.machine';
import type { ReadinessReasonCode } from '../machines/tool-page.machine';

type BriefingStatus = 'idle' | 'uploading' | 'extracting' | 'ready';
type ReqStatus = 'todo' | 'active' | 'done' | 'error';

export interface FlowStepProgress {
  step: ToolStep;
  displayName: string;
  status: ToolStepStatus;
  artifactId?: string | null | undefined;
  isStreaming?: boolean | undefined;
  // accepted but unused in this render:
  description?: string | undefined;
  previewContent?: string | null | undefined;
}

export interface ToolGenerationFlowVerticalProps {
  canonicalState: CanonicalToolUiState;
  projectName: string | null;
  briefingFileName: string | null;
  briefingStatus: BriefingStatus;
  readinessReasonCodes: ReadonlyArray<ReadinessReasonCode>;
  briefingError: string | null;
  briefingGuidance?: string | null;
  steps: FlowStepProgress[];
  completedStepsCount: number;
  totalStepsCount: number;
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

const STEP_ICON: Record<ToolStepStatus, string> = {
  idle: '○',
  running: '⟳',
  done: '✓',
  error: '✕',
};

const REQ_ICON: Record<ReqStatus, string> = {
  todo: '○',
  active: '⟳',
  done: '✓',
  error: '✕',
};

const READINESS_DETAIL_BY_REASON: Record<ReadinessReasonCode, string> = {
  missing_project: 'Seleziona un progetto',
  missing_extraction_context: 'Carica o recupera un brief',
  missing_primary_target_step: 'In attesa dello step disponibile',
};

// ─── sub-components ──────────────────────────────────────────────────────────

const Label = ({ children }: { children: string }) => (
  <span className="ui-fv-label">{children}</span>
);

const deriveInstruction = (
  canonicalState: CanonicalToolUiState,
  projectName: string | null,
  briefingStatus: BriefingStatus,
): string => {
  if (canonicalState === 'running') return 'Generazione in corso';
  if (canonicalState === 'paused-with-checkpoint') return 'In pausa — riprendi dal checkpoint';
  if (canonicalState === 'prefilled-regenerate') return 'Contesto caricato — avvia la rigenerazione';
  if (canonicalState === 'resume-needs-briefing') return 'Carica un nuovo briefing per continuare';
  if (canonicalState === 'completed') return 'Tutti gli artefatti sono stati generati';
  // input phase — progressive
  if (!projectName) return 'Seleziona un progetto per iniziare';
  if (briefingStatus === 'uploading') return 'Caricamento briefing in corso...';
  if (briefingStatus === 'extracting') return 'Estrazione contenuto del briefing...';
  if (briefingStatus === 'ready') return 'Avvia la generazione dalla colonna sinistra';
  return 'Carica il file di briefing per proseguire';
};

interface ReqItemProps {
  status: ReqStatus;
  text: string;
  detail?: string | undefined;
  activeLabel?: string | undefined;
}

const ReqItem = ({ status, text, detail, activeLabel }: ReqItemProps) => {
  const isSpinning = status === 'active';
  return (
    <li className={`ui-fv-item is-${status}`}>
      <span className={`ui-fv-icon${isSpinning ? ' is-spinning' : ''}`}>
        {REQ_ICON[status]}
      </span>
      <span className="ui-fv-item-text">{text}</span>
      {detail && <span className="ui-fv-item-detail">{detail}</span>}
      {isSpinning && activeLabel && (
        <span className="ui-fv-status-label">{activeLabel}</span>
      )}
    </li>
  );
};

interface StepRowProps {
  step: FlowStepProgress;
}

const StepRow = ({ step }: StepRowProps) => {
  const isSpinning = step.status === 'running';
  const badge = step.status;

  return (
    <li className={`ui-fv-step is-${badge}`}>
      <span className={`ui-fv-step-icon${isSpinning ? ' is-spinning' : ''}`}>
        {STEP_ICON[step.status]}
      </span>
      <span className="ui-fv-step-name">{step.displayName}</span>
      {step.status === 'running' && (
        <span className="ui-fv-status-label">In esecuzione</span>
      )}
      {step.status === 'error' && (
        <span className="ui-fv-step-error-label">Errore</span>
      )}
    </li>
  );
};

// ─── main component ──────────────────────────────────────────────────────────

export const ToolGenerationFlowVertical = ({
  canonicalState,
  projectName,
  briefingFileName,
  briefingStatus,
  readinessReasonCodes,
  briefingError,
  briefingGuidance = null,
  steps,
  completedStepsCount,
  totalStepsCount,
  errorMessage,
}: ToolGenerationFlowVerticalProps) => {
  const phase = derivePhase(canonicalState);
  const whereLabel = WHERE_LABEL[canonicalState];
  const instruction = deriveInstruction(canonicalState, projectName, briefingStatus);

  // Requirement statuses for input phase
  const projectReqStatus: ReqStatus = projectName ? 'done' : 'todo';

  const briefingReqStatus: ReqStatus = briefingError
    ? 'error'
    : briefingStatus === 'uploading' || briefingStatus === 'extracting'
      ? 'active'
      : briefingStatus === 'ready'
        ? 'done'
        : 'todo';

  const reasonSet = new Set(readinessReasonCodes);

  const readyReqStatus: ReqStatus = (() => {
    if (readinessReasonCodes.length === 0) {
      return 'done';
    }

    if (
      readinessReasonCodes.length === 1
      && reasonSet.has('missing_primary_target_step')
    ) {
      return 'active';
    }

    return 'todo';
  })();

  const readinessDetail = (() => {
    const priority: ReadinessReasonCode[] = [
      'missing_project',
      'missing_extraction_context',
      'missing_primary_target_step',
    ];

    for (const reason of priority) {
      if (reasonSet.has(reason)) {
        return READINESS_DETAIL_BY_REASON[reason];
      }
    }

    return undefined;
  })();

  const briefingActiveLabel =
    briefingStatus === 'uploading'
      ? 'Caricamento'
      : briefingStatus === 'extracting'
        ? 'Estrazione'
        : undefined;

  const guidanceMessage = briefingGuidance ?? null;

  const progressPct = totalStepsCount > 0
    ? (completedStepsCount / totalStepsCount) * 100
    : 0;

  return (
    <div className="ui-fv-root" role="region" aria-label="Generation flow">

      {/* Phase anchor ──────────────────────────────────── */}
      <div className="ui-fv-section">
        <span className="ui-fv-where-value">{whereLabel}</span>
        <span className="ui-fv-where-hint">{instruction}</span>
      </div>

      {/* Global error ──────────────────────────────────── */}
      {errorMessage && (
        <div className="ui-fv-error" role="alert">{errorMessage}</div>
      )}

      {/* INPUT PHASE ───────────────────────────────────── */}
      {phase === 'input' && (
        <div className="ui-fv-section">
          <Label>Requisiti</Label>
          {guidanceMessage ? (
            <p className="ui-fv-inline-guidance" role="status">
              {guidanceMessage}
            </p>
          ) : null}
          <ul className="ui-fv-checklist">
            <ReqItem
              status={projectReqStatus}
              text="Progetto"
              detail={projectName ?? undefined}
            />
            <ReqItem
              status={briefingReqStatus}
              text="Brief"
              detail={briefingFileName ?? (briefingError ?? undefined)}
              activeLabel={briefingActiveLabel}
            />
            <ReqItem
              status={readyReqStatus}
              text="Pronto per la generazione"
              detail={readinessDetail}
              activeLabel={readyReqStatus === 'active' ? 'In attesa' : undefined}
            />
          </ul>
        </div>
      )}

      {/* MONITORING PHASE ──────────────────────────────── */}
      {phase === 'monitoring' && (
        <>
          <div className="ui-fv-section">
            <Label>Avanzamento</Label>
            <div className="ui-fv-progress-wrap">
              <div className="ui-fv-progress-bar" role="progressbar"
                aria-valuenow={completedStepsCount}
                aria-valuemin={0}
                aria-valuemax={totalStepsCount}
              >
                <div
                  className="ui-fv-progress-fill"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="ui-fv-progress-text">
                {completedStepsCount}&thinsp;/&thinsp;{totalStepsCount}
              </span>
            </div>
          </div>

          <div className="ui-fv-section">
            <Label>Step di generazione</Label>
            <ul className="ui-fv-steps">
              {steps.map((step) => (
                <StepRow key={step.step} step={step} />
              ))}
            </ul>
          </div>
        </>
      )}

      {/* COMPLETION PHASE ──────────────────────────────── */}
      {phase === 'completion' && (
        <>
          <div className="ui-fv-section">
            <Label>Artefatti generati</Label>
            <span className="ui-fv-completion-count">{totalStepsCount}</span>
          </div>

          <div className="ui-fv-section">
            <Label>Step di generazione</Label>
            <ul className="ui-fv-steps">
              {steps.map((step) => (
                <StepRow key={step.step} step={step} />
              ))}
            </ul>
          </div>
        </>
      )}

    </div>
  );
};
