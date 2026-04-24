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
  | 'open-last-artifact';

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
