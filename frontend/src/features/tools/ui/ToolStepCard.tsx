/**
 * ToolStepCard: Display a single step in the generation workflow
 * Shows step metadata, status badge, and preview of generated content
 */

import { Surface, uiPrimitives } from '../../../app/ui/primitives';
import type { ToolStep, ToolStepStatus, SupportedTool } from '../machines/tool-flow.machine';
import { mapToolStepToCardConfig } from '../runtime/tool-form-architecture';

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
      return { label: 'In attesa', className: 'ui-badge-idle' };
    case 'running':
      return { label: 'In generazione...', className: 'ui-badge-running' };
    case 'done':
      return { label: 'Completato', className: 'ui-badge-completed' };
    case 'error':
      return { label: 'Errore', className: 'ui-badge-error' };
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
            <p className={uiPrimitives.metaLine}>Formato: {config.expectedOutputFormat}</p>
            {isStreaming && <span className="ui-badge ui-badge-streaming">Streaming</span>}
          </div>
          <div className="ui-tool-step-preview-content">
            {previewContent.slice(0, 500)}
            {previewContent.length > 500 && '...'}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="ui-tool-step-actions">
        {artifactId && onViewArtifact && status === 'done' && (
          <button
            className={uiPrimitives.button}
            onClick={onViewArtifact}
            title="Apri l'artefatto completo"
          >
            Visualizza
          </button>
        )}
        {status === 'error' && (
          <p className={uiPrimitives.error}>Generazione non riuscita per questo step.</p>
        )}
      </div>
    </Surface>
  );
};
