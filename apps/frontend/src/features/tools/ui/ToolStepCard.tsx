/**
 * ToolStepCard: Display a single step in the generation workflow
 * Shows step metadata, status badge, and preview of generated content
 */

import { Surface, uiPrimitives } from '../../../app/ui/primitives';
import { Button } from '@mui/material';
import { StatusBadge } from '../../../app/ui/StatusBadge';
import type { ToolStep, ToolStepStatus, SupportedTool } from '../machines/tool-flow.machine';
import { mapToolStepToCardConfig } from '../runtime/tool-form-architecture';
import { appCopy } from '../../../app/copy/system';
import { UI_CONFIG } from '../../../app/config/ui-config';

interface ToolStepCardProps {
  toolKey: SupportedTool;
  step: ToolStep;
  status: ToolStepStatus;
  previewContent?: string | null;
  artifactId?: string | null;
  onViewArtifact?: () => void;
  isStreaming?: boolean;
}

const STEP_STATUS_TO_BADGE: Record<ToolStepStatus, string> = {
  idle: 'neutral',
  running: 'info',
  done: 'completed',
  error: 'failed',
};

export const ToolStepCard = ({
  toolKey,
  step,
  status,
  previewContent,
  artifactId,
  onViewArtifact,
  isStreaming = false,
}: ToolStepCardProps) => {
  const config = mapToolStepToCardConfig(toolKey, step);

  return (
    <Surface className="ui-tool-step-card">
      <div className="ui-tool-step-header">
        <div className="ui-tool-step-title-group">
          <h4>{config.displayName}</h4>
          <StatusBadge status={STEP_STATUS_TO_BADGE[status]} />
        </div>
        <p className={uiPrimitives.metaLine}>{config.description}</p>
      </div>

      {/* Preview area */}
      {previewContent && (
        <div className="ui-tool-step-preview">
          <div className="ui-tool-step-preview-header">
            <p className={uiPrimitives.metaLine}>{appCopy.ui.labels.format}: {config.expectedOutputFormat}</p>
            {isStreaming && <StatusBadge status="generating" label={appCopy.ui.badges.streaming} />}
          </div>
          <div className="ui-tool-step-preview-content">
            {previewContent.slice(0, UI_CONFIG.preview.toolStepPreviewMaxChars)}
            {previewContent.length > UI_CONFIG.preview.toolStepPreviewMaxChars && '...'}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="ui-tool-step-actions">
        {artifactId && onViewArtifact && status === 'done' && (
          <Button
            type="button"
            variant="outlined"
            onClick={onViewArtifact}
            title={appCopy.ui.toolStep.viewArtifactTitle}
          >
            {appCopy.ui.actions.viewArtifact}
          </Button>
        )}
        {status === 'error' && (
          <p className={uiPrimitives.error} role="alert">{appCopy.ui.toolStep.stepGenerationFailed}</p>
        )}
      </div>
    </Surface>
  );
};
