import { Link } from 'react-router-dom';
import { Button, IconButton, Tooltip } from '@mui/material';
import { ArrowRight, Play, FileText, Mic, Plus, AlertTriangle, CheckCircle } from 'lucide-react';
import { useWorkspaceContext } from '../../runtime/useWorkspaceContext';
import { useWorkspaceProject } from '../../runtime/WorkspaceProjectContext';
import { appCopy } from '../../../../app/copy/system';
import type { FoundationToolStatus } from '../../runtime/useWorkspaceContext';

interface WorkspaceOverviewCardProps {
  workspaceId: string;
}

const FOUNDATION_TOOL_LABELS: Record<string, string> = {
  'brief-generator': 'Brief',
  'tov-generator': 'Brand Voice',
};

const FOUNDATION_TOOL_ICONS: Record<string, React.ReactNode> = {
  'brief-generator': <FileText size={16} />,
  'tov-generator': <Mic size={16} />,
};

const FOUNDATION_TOOL_TOOLTIPS: Record<string, string> = {
  'brief-generator': appCopy.ui.workspace.dashboard.foundationTooltipBrief,
  'tov-generator': appCopy.ui.workspace.dashboard.foundationTooltipTov,
};

export const WorkspaceOverviewCard: React.FC<WorkspaceOverviewCardProps> = ({ workspaceId }) => {
  const ctx = useWorkspaceContext(workspaceId);
  const { projectName, isArchived } = useWorkspaceProject();

  const suggestedNext = ctx.workflowPosition?.suggestedNext ?? [];
  const firstSuggestedTool = suggestedNext[0];
  const staleCount = ctx.assets.filter(a => a.staleUpstream).length;
  const assetTypesWithAssets = Object.keys(ctx.groupedByType)
    .filter(k => (ctx.groupedByType[k]?.length ?? 0) > 0).length;

  const copy = appCopy.ui.workspace.dashboard;

  const renderFoundationItem = (tool: FoundationToolStatus) => {
    const toolRoute = `/workspaces/${workspaceId}/tools/${tool.toolKey}`;
    const label = FOUNDATION_TOOL_LABELS[tool.toolKey] ?? tool.toolKey;
    const icon = FOUNDATION_TOOL_ICONS[tool.toolKey] ?? <FileText size={16} />;
    const count = tool.existingAssets.length;
    const tooltipText = FOUNDATION_TOOL_TOOLTIPS[tool.toolKey] ?? (
      tool.hasAssets ? copy.foundationToolsRegenerate : copy.foundationActionGenerate
    );

    return (
      <div key={tool.toolKey} className="foundation-status__item">
        <span className="foundation-status__icon">{icon}</span>
        <span className="foundation-status__label">{label}</span>
        {tool.hasAssets ? (
          <span className="foundation-status__indicator foundation-status__indicator--present">
            <CheckCircle size={14} />
            <span>{copy.foundationStatusPresent(count)}</span>
          </span>
        ) : (
          <span className="foundation-status__indicator foundation-status__indicator--missing">
            <AlertTriangle size={14} />
            <span>{copy.foundationStatusMissing}</span>
          </span>
        )}
        <Tooltip title={tooltipText}>
          <IconButton
            component={Link}
            to={toolRoute}
            size="small"
            className="foundation-status__action"
          >
            <Plus size={16} />
          </IconButton>
        </Tooltip>
      </div>
    );
  };

  return (
    <div className="workspace-overview">
      {/* Header row */}
      <div className="workspace-overview__header">
        <h4 className="workspace-overview__title">{projectName}</h4>
        <div className="workspace-overview__cta">
          <Button
            component={Link}
            to={firstSuggestedTool
              ? `/workspaces/${workspaceId}/tools/${firstSuggestedTool}`
              : '#available-tools'}
            variant="contained" size="large"
            startIcon={firstSuggestedTool ? <Play size={18} /> : <ArrowRight size={18} />}
            disabled={isArchived}
          >
            {firstSuggestedTool ? copy.heroStartGenerating : copy.heroChooseTool}
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="workspace-overview__stats">
        <span className="workspace-overview__stat">
          {ctx.assets.length > 0
            ? copy.workspaceOverviewStatsAssets(ctx.assets.length)
            : copy.workspaceOverviewStatsNone}
        </span>
        {ctx.assets.length > 0 && (
          <>
            <span className="workspace-overview__stat-sep">&middot;</span>
            <span className="workspace-overview__stat">
              {copy.workspaceOverviewStatsTypes(assetTypesWithAssets)}
            </span>
            {staleCount > 0 && (
              <>
                <span className="workspace-overview__stat-sep">&middot;</span>
                <span className="workspace-overview__stat workspace-overview__stat--warning">
                  {copy.workspaceOverviewStatsStale(staleCount)}
                </span>
              </>
            )}
            {ctx.overallQualityScore > 0 && (
              <>
                <span className="workspace-overview__stat-sep">&middot;</span>
                <span className="workspace-overview__stat">
                  {copy.workspaceOverviewQuality(ctx.overallQualityScore)}
                </span>
              </>
            )}
          </>
        )}
      </div>

      {/* Divider */}
      <hr className="workspace-overview__divider" />

      {/* Foundation section */}
      <div className="workspace-overview__foundation">
        <div className="workspace-overview__foundation-label">
          {copy.workspaceOverviewFoundationLabel}
        </div>
        <div className="workspace-overview__foundation-row">
          {ctx.foundationTools.map(renderFoundationItem)}
        </div>
      </div>
    </div>
  );
};
