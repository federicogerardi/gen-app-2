/**
 * ToolActionButtons: Dynamic CTA buttons based on generation state
 * Renders primary action + secondary action options based on UI derivation
 */

import { PrimaryCtaButton, SecondaryCtaButton } from '../../../app/ui/CtaButtons';
import { appCopy } from '../../../app/copy/system';
import type { PrimaryActionPolicy, SecondaryActionFlags } from '../../generation/ui/tool-ux-state';
import { derivePrimaryActionLabel } from '../../generation/ui/tool-ux-state';

interface ToolActionButtonsProps {
  primaryPolicy: PrimaryActionPolicy;
  primaryOverride?: {
    label: string;
    disabled?: boolean;
    tooltip?: string;
  };
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
  primaryOverride,
  secondaryFlags,
  onPrimaryAction,
  onRetry,
  onSkipStep,
  onCancelGeneration,
  onOpenPreviousArtifact,
  isLoading = false,
}: ToolActionButtonsProps) => {
  const primaryLabel = derivePrimaryActionLabel(primaryPolicy);
  const effectivePrimaryLabel = primaryOverride?.label ?? primaryLabel.label;
  const effectivePrimaryDisabled = (primaryOverride?.disabled ?? primaryLabel.disabled) || isLoading;
  const effectivePrimaryTooltip = primaryOverride?.tooltip ?? primaryLabel.tooltip;

  return (
    <div className="ui-tool-action-buttons">
      <PrimaryCtaButton
        type="button"
        data-testid="primary-cta-btn"
        onClick={onPrimaryAction}
        disabled={effectivePrimaryDisabled}
        title={effectivePrimaryTooltip}
      >
        {isLoading ? appCopy.ui.toolPage.flow.loadingActionLabel : effectivePrimaryLabel}
      </PrimaryCtaButton>

      <div className="ui-tool-secondary-actions">
        {secondaryFlags.canRetry && onRetry && (
          <SecondaryCtaButton
            type="button"
            onClick={onRetry}
            disabled={isLoading}
            title={appCopy.ui.toolActions.retryStepTooltip}
          >
            {appCopy.ui.toolActions.retryStepLabel}
          </SecondaryCtaButton>
        )}

        {secondaryFlags.canSkipStep && onSkipStep && (
          <SecondaryCtaButton
            type="button"
            onClick={onSkipStep}
            disabled={isLoading}
            title={appCopy.ui.toolActions.skipToNextStepTooltip}
          >
            {appCopy.ui.toolActions.skipToNextStepLabel}
          </SecondaryCtaButton>
        )}

        {secondaryFlags.canCancelGeneration && onCancelGeneration && (
          <SecondaryCtaButton
            type="button"
            onClick={onCancelGeneration}
            title={appCopy.ui.toolActions.cancelGenerationTooltip}
          >
            {appCopy.ui.toolActions.cancelGenerationLabel}
          </SecondaryCtaButton>
        )}

        {secondaryFlags.canOpenPreviousArtifact && onOpenPreviousArtifact && (
          <SecondaryCtaButton
            type="button"
            onClick={onOpenPreviousArtifact}
            disabled={isLoading}
            title={appCopy.ui.toolActions.viewPreviousResultTooltip}
          >
            {appCopy.ui.toolActions.viewPreviousResultLabel}
          </SecondaryCtaButton>
        )}
      </div>
    </div>
  );
};
