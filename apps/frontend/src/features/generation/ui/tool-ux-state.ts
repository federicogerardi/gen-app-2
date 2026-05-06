import type { FrontendStreamStatus } from '../machines/frontend-stream.machine';

export type ToolPhase = 'idle' | 'uploading' | 'extracting' | 'review' | 'generating';
export type ToolIntent = 'new' | 'resume' | 'regenerate';
export type ExtractionLifecycle =
  | 'idle'
  | 'in_progress'
  | 'completed_partial'
  | 'completed_full'
  | 'failed_hard';

export type CanonicalToolUiState =
  | 'draft-empty'
  | 'processing-briefing'
  | 'draft-ready'
  | 'prefilled-regenerate'
  | 'paused-with-checkpoint'
  | 'resume-needs-briefing'
  | 'running'
  | 'completed';

export type PrimaryActionPolicy =
  | 'disabled'
  | 'start-generation'
  | 'resume-checkpoint'
  | 'open-last-artifact'
  | 'regenerate-current-step';

export type SecondaryActionFlags = {
  canRetry: boolean;
  canSkipStep: boolean;
  canCancelGeneration: boolean;
  canOpenPreviousArtifact: boolean;
};

export type ToolUiDerivationInput = {
  phase: ToolPhase;
  intent: ToolIntent;
  extractionLifecycle: ExtractionLifecycle;
  hasProject: boolean;
  hasBriefing: boolean;
  hasCheckpoint: boolean;
  checkpointHasExtractionContext: boolean;
  hasSourceArtifact: boolean;
  streamStatus: FrontendStreamStatus;
};

export const deriveCanonicalToolUiState = (
  input: ToolUiDerivationInput,
): CanonicalToolUiState => {
  if (
    input.streamStatus === 'connecting'
    || input.streamStatus === 'streaming'
    || input.streamStatus === 'reconnecting'
    || input.phase === 'generating'
  ) {
    return 'running';
  }

  if (input.streamStatus === 'completed') {
    return 'completed';
  }

  if (
    input.phase === 'uploading'
    || input.phase === 'extracting'
    || input.extractionLifecycle === 'in_progress'
  ) {
    return 'processing-briefing';
  }

  if (input.intent === 'regenerate' && input.hasSourceArtifact) {
    return 'prefilled-regenerate';
  }

  if (
    input.intent === 'resume'
    && input.hasCheckpoint
    && !input.hasBriefing
    && !input.checkpointHasExtractionContext
  ) {
    return 'resume-needs-briefing';
  }

  if (input.intent === 'resume' && input.hasCheckpoint) {
    return 'paused-with-checkpoint';
  }

  const hasReadyExtraction =
    input.extractionLifecycle === 'completed_partial' || input.extractionLifecycle === 'completed_full';
  if (input.hasProject && input.hasBriefing && (input.phase === 'review' || hasReadyExtraction)) {
    return 'draft-ready';
  }

  return 'draft-empty';
};

export const derivePrimaryActionPolicy = (
  state: CanonicalToolUiState,
): PrimaryActionPolicy => {
  if (state === 'processing-briefing' || state === 'running') {
    return 'disabled';
  }

  if (state === 'draft-ready' || state === 'prefilled-regenerate') {
    return 'start-generation';
  }

  if (state === 'paused-with-checkpoint') {
    return 'resume-checkpoint';
  }

  if (state === 'completed') {
    return 'open-last-artifact';
  }

  return 'disabled';
};

export const derivePrimaryActionLabel = (
  policy: PrimaryActionPolicy,
): { label: string; disabled: boolean; tooltip?: string } => {
  switch (policy) {
    case 'disabled':
      return {
        label: 'Completa il form per iniziare',
        disabled: true,
        tooltip: 'Seleziona un progetto e carica un documento di brief',
      };

    case 'start-generation':
      return {
        label: 'Avvia la generazione',
        disabled: false,
      };

    case 'resume-checkpoint':
      return {
        label: 'Riprendi dal checkpoint',
        disabled: false,
        tooltip: 'Continua dal punto in cui la generazione è stata interrotta',
      };

    case 'open-last-artifact':
      return {
        label: 'Visualizza i risultati',
        disabled: false,
        tooltip: "Apri l'artefatto generato",
      };

    case 'regenerate-current-step':
      return {
        label: 'Rigenera',
        disabled: false,
        tooltip: 'Rigenera con i nuovi parametri',
      };
  }
};
