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
