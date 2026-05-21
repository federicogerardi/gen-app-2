/**
 * ToolStepCard: Display a single step in the generation workflow
 * Shows step metadata, status badge, and preview of generated content
 */

import { Surface, uiPrimitives } from '../../../app/ui/primitives';
import { Button } from '@mui/material';
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

const getStatusBadge = (status: ToolStepStatus): { label: string; className: string } => {
  switch (status) {
    case 'idle':
      return { label: appCopy.ui.statusLabels.idle, className: 'ui-badge-idle' };
    case 'running':
      return { label: appCopy.ui.statusLabels.running, className: 'ui-badge-running' };
    case 'done':
      return { label: appCopy.ui.statusLabels.done, className: 'ui-badge-completed' };
    case 'error':
      return { label: appCopy.ui.statusLabels.error, className: 'ui-badge-error' };
  }
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
  const badge = getStatusBadge(status);

  return (
    <Surface className="ui-tool-step-card">
      <div className="ui-tool-step-header">
        <div className="ui-tool-step-title-group">
          <h4>{config.displayName}</h4>
          <span className={`ui-badge ${badge.className}`} title={config.description}>
            {badge.label}
          </span>
        </div>
        <p className={uiPrimitives.metaLine}>{config.description}</p>
      </div>

      {/* Preview area */}
      {previewContent && (
        <div className="ui-tool-step-preview">
          <div className="ui-tool-step-preview-header">
            <p className={uiPrimitives.metaLine}>{appCopy.ui.labels.format}: {config.expectedOutputFormat}</p>
            {isStreaming && <span className="ui-badge ui-badge-streaming">{appCopy.ui.badges.streaming}</span>}
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
          <p className={uiPrimitives.error}>{appCopy.ui.toolStep.stepGenerationFailed}</p>
        )}
      </div>
    </Surface>
  );
};
