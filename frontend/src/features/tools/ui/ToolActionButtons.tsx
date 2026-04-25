/**
 * ToolActionButtons: Dynamic CTA buttons based on generation state
 * Renders primary action + secondary action options based on UI derivation
 */

import type { ReactNode } from 'react';
import { Button, uiPrimitives } from '../../../app/ui/primitives';
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
      {/* Primary action button */}
      <Button
        onClick={onPrimaryAction}
        disabled={primaryLabel.disabled || isLoading}
        className={`ui-button-primary${isLoading ? ' is-loading' : ''}`}
        title={primaryLabel.tooltip}
      >
        {isLoading ? 'Processing...' : primaryLabel.label}
      </Button>

      {/* Secondary actions */}
      <div className="ui-tool-secondary-actions">
        {secondaryFlags.canRetry && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isLoading}
            className={uiPrimitives.button}
            title="Retry the failed step"
          >
            Retry
          </button>
        )}

        {secondaryFlags.canSkipStep && onSkipStep && (
          <button
            type="button"
            onClick={onSkipStep}
            disabled={isLoading}
            className={uiPrimitives.button}
            title="Skip this step and move to next"
          >
            Skip Step
          </button>
        )}

        {secondaryFlags.canCancelGeneration && onCancelGeneration && (
          <button
            type="button"
            onClick={onCancelGeneration}
            className={`${uiPrimitives.button} ui-button-secondary`}
            title="Cancel ongoing generation"
          >
            Cancel
          </button>
        )}

        {secondaryFlags.canOpenPreviousArtifact && onOpenPreviousArtifact && (
          <button
            type="button"
            onClick={onOpenPreviousArtifact}
            disabled={isLoading}
            className={uiPrimitives.button}
            title="View previous generated artifact"
          >
            Previous Artifact
          </button>
        )}
      </div>
    </div>
  );
};
