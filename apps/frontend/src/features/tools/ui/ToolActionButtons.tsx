/**
 * ToolActionButtons: Dynamic CTA buttons based on generation state
 * Renders primary action + secondary action options based on UI derivation
 */

import { Button } from '@mui/material';
import type { PrimaryActionPolicy, SecondaryActionFlags } from '../runtime/tool-ux-state';
import { derivePrimaryActionLabel } from '../runtime/tool-ux-state';

interface ToolActionButtonsProps {
  primaryPolicy: PrimaryActionPolicy;
  secondaryFlags: SecondaryActionFlags;
  onPrimaryAction: () => void;
  onRetry?: () => void;
  onSkipStep?: () => void;
  onCancelGeneration?: () => void;
  onOpenPreviousArtifact?: () => void;
  isLoading?: boolean;
}

export const ToolActionButtons = ({
  primaryPolicy,
  secondaryFlags,
  onPrimaryAction,
  onRetry,
  onSkipStep,
  onCancelGeneration,
  onOpenPreviousArtifact,
  isLoading = false,
}: ToolActionButtonsProps) => {
  const primaryLabel = derivePrimaryActionLabel(primaryPolicy);

  return (
    <div className="ui-tool-action-buttons">
      <Button
        type="button"
        onClick={onPrimaryAction}
        disabled={primaryLabel.disabled || isLoading}
        title={primaryLabel.tooltip}
        variant="contained"
      >
        {isLoading ? 'In elaborazione...' : primaryLabel.label}
      </Button>

      <div className="ui-tool-secondary-actions">
        {secondaryFlags.canRetry && onRetry && (
          <Button
            type="button"
            onClick={onRetry}
            disabled={isLoading}
            title="Riprova questo step"
            variant="outlined"
          >
            Riprova
          </Button>
        )}

        {secondaryFlags.canSkipStep && onSkipStep && (
          <Button
            type="button"
            onClick={onSkipStep}
            disabled={isLoading}
            title="Salta allo step successivo"
            variant="outlined"
          >
            Salta step
          </Button>
        )}

        {secondaryFlags.canCancelGeneration && onCancelGeneration && (
          <Button
            type="button"
            onClick={onCancelGeneration}
            title="Interrompi la generazione in corso"
            variant="outlined"
            color="error"
          >
            Annulla
          </Button>
        )}

        {secondaryFlags.canOpenPreviousArtifact && onOpenPreviousArtifact && (
          <Button
            type="button"
            onClick={onOpenPreviousArtifact}
            disabled={isLoading}
            title="Visualizza il risultato dello step precedente"
            variant="outlined"
          >
            Artefatto precedente
          </Button>
        )}
      </div>
    </div>
  );
};
