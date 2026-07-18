import { Link } from 'react-router-dom';
import { Button, Chip, Skeleton } from '@mui/material';
import { FileText, Mic, ArrowRight, AlertTriangle } from 'lucide-react';
import { useWorkspaceContext } from '../../runtime/useWorkspaceContext';
import { toolFormRegistry } from '../../../tools/runtime/tool-form-architecture';
import { QualityScoreBadge } from '../QualityScoreBadge';
import type { SupportedTool } from '../../../tools/machines/tool-flow.machine';

interface FoundationToolsPanelProps {
  workspaceId: string;
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  'brief-generator': <FileText size={20} />,
  'tov-generator': <Mic size={20} />,
};

export const FoundationToolsPanel: React.FC<FoundationToolsPanelProps> = ({ workspaceId }) => {
  const ctx = useWorkspaceContext(workspaceId);

  if (ctx.loading) {
    return (
      <div className="foundation-tools">
        <div className="foundation-tools__header">
          <Skeleton variant="text" width={200} />
        </div>
        <div className="foundation-tools__grid">
          <Skeleton variant="rounded" height={160} />
          <Skeleton variant="rounded" height={160} />
        </div>
      </div>
    );
  }

  if (ctx.foundationTools.length === 0) {
    return null;
  }

  return (
    <div className="foundation-tools">
      <div className="foundation-tools__header">
        <span className="foundation-tools__header-title">Foundation</span>
        <span className="foundation-tools__header-subtitle">
          Start here to build your workspace knowledge
        </span>
      </div>
      <div className="foundation-tools__grid">
        {ctx.foundationTools.map(tool => {
          const config = toolFormRegistry[tool.toolKey as SupportedTool];
          const displayName = config?.displayName ?? tool.toolKey;
          const description = config?.defaultPrompt
            ? config.defaultPrompt.slice(0, 80) + (config.defaultPrompt.length > 80 ? '...' : '')
            : '';
          const icon = TOOL_ICONS[tool.toolKey] ?? <FileText size={20} />;
          const toolRoute = `/workspaces/${workspaceId}/tools/${tool.toolKey}`;

          const avgScore = tool.hasAssets
            ? Math.round(
                tool.existingAssets.reduce((sum, a) => sum + a.qualityScore, 0) /
                  tool.existingAssets.length,
              )
            : 0;

          return (
            <div key={tool.toolKey} className="foundation-tools__card">
              <div className="foundation-tools__card-header">
                <span className="foundation-tools__card-icon">{icon}</span>
                <span className="foundation-tools__card-name">{displayName}</span>
              </div>

              {description && (
                <div className="foundation-tools__card-desc">{description}</div>
              )}

              <div className="foundation-tools__card-meta">
                <Chip
                  label={`Produces: ${tool.producedAssetType}`}
                  size="small"
                  variant="outlined"
                />
                {tool.hasAssets && (
                  <Chip
                    label={`${tool.existingAssets.length} asset${tool.existingAssets.length > 1 ? 's' : ''}`}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                )}
              </div>

              <div className="foundation-tools__card-status">
                {tool.hasAssets ? (
                  <span className="foundation-tools__card-status--has-assets">
                    <QualityScoreBadge score={avgScore} size="small" />
                    <span>{tool.existingAssets.length} asset{tool.existingAssets.length > 1 ? 's' : ''}</span>
                  </span>
                ) : (
                  <span className="foundation-tools__card-status--empty">
                    <AlertTriangle size={14} />
                    <span>No {tool.producedAssetType} yet</span>
                  </span>
                )}
              </div>

              <div className="foundation-tools__card-cta">
                <Button
                  component={Link}
                  to={toolRoute}
                  variant={tool.hasAssets ? 'outlined' : 'contained'}
                  size="small"
                  endIcon={<ArrowRight size={14} />}
                  fullWidth
                >
                  {tool.hasAssets ? 'Regenerate' : `Generate ${tool.producedAssetType}`}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
