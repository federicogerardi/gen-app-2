import { appCopy } from '../../../app/copy/system';

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

export const derivePrimaryActionLabel = (
  policy: PrimaryActionPolicy,
): { label: string; disabled: boolean; tooltip?: string } => {
  const copy = appCopy.ui.toolPage.primaryActionPolicy;

  switch (policy) {
    case 'disabled':
      return {
        label: copy.disabledLabel,
        disabled: true,
        tooltip: copy.disabledTooltip,
      };

    case 'start-generation':
      return {
        label: copy.startGenerationLabel,
        disabled: false,
      };

    case 'resume-checkpoint':
      return {
        label: copy.resumeCheckpointLabel,
        disabled: false,
        tooltip: copy.resumeCheckpointTooltip,
      };

    case 'open-last-artifact':
      return {
        label: copy.openLastArtifactLabel,
        disabled: false,
        tooltip: copy.openLastArtifactTooltip,
      };

    case 'regenerate-current-step':
      return {
        label: copy.regenerateCurrentStepLabel,
        disabled: false,
        tooltip: copy.regenerateCurrentStepTooltip,
      };
  }
};
