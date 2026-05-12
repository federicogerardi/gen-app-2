/**
 * ToolActionButtons: Dynamic CTA buttons based on generation state
 * Renders primary action + secondary action options based on UI derivation
 */

import { PrimaryCtaButton, SecondaryCtaButton } from '../../../app/ui/CtaButtons';
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
      <PrimaryCtaButton
        type="button"
        data-testid="primary-cta-btn"
        onClick={onPrimaryAction}
        disabled={primaryLabel.disabled || isLoading}
        title={primaryLabel.tooltip}
      >
        {isLoading ? 'In elaborazione...' : primaryLabel.label}
      </PrimaryCtaButton>

      <div className="ui-tool-secondary-actions">
        {secondaryFlags.canRetry && onRetry && (
          <SecondaryCtaButton
            type="button"
            onClick={onRetry}
            disabled={isLoading}
            title="Riprova questo step"
          >
            Riprova
          </SecondaryCtaButton>
        )}

        {secondaryFlags.canSkipStep && onSkipStep && (
          <SecondaryCtaButton
            type="button"
            onClick={onSkipStep}
            disabled={isLoading}
            title="Salta allo step successivo"
          >
            Salta step
          </SecondaryCtaButton>
        )}

        {secondaryFlags.canCancelGeneration && onCancelGeneration && (
          <SecondaryCtaButton
            type="button"
            onClick={onCancelGeneration}
            title="Interrompi la generazione in corso"
          >
            Annulla
          </SecondaryCtaButton>
        )}

        {secondaryFlags.canOpenPreviousArtifact && onOpenPreviousArtifact && (
          <SecondaryCtaButton
            type="button"
            onClick={onOpenPreviousArtifact}
            disabled={isLoading}
            title="Visualizza il risultato dello step precedente"
          >
            Artefatto precedente
          </SecondaryCtaButton>
        )}
      </div>
    </div>
  );
};
