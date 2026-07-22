import { Link } from 'react-router-dom';
import { useCallback } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { Play, FileText, Mic, Users, Plus, AlertTriangle, CheckCircle } from 'lucide-react';
import { useWorkspaceContext } from '../../runtime/useWorkspaceContext';
import { useWorkspaceProject } from '../../runtime/WorkspaceProjectContext';
import { appCopy } from '../../../../app/copy/system';
import { uiPrimitives } from '../../../../app/ui/primitives';
import type { FoundationToolStatus } from '../../runtime/useWorkspaceContext';

interface WorkspaceOverviewCardProps {
  workspaceId: string;
}

const FOUNDATION_TOOL_LABELS: Record<string, string> = {
  'brief-generator': appCopy.ui.workspace.dashboard.foundationLabelBrief,
  'tov-generator': appCopy.ui.workspace.dashboard.foundationLabelBrandVoice,
  'personas-generator': appCopy.ui.workspace.dashboard.foundationLabelPersonas,
};

const FOUNDATION_TOOL_ICONS: Record<string, React.ReactNode> = {
  'brief-generator': <FileText size={16} />,
  'tov-generator': <Mic size={16} />,
  'personas-generator': <Users size={16} />,
};

const FOUNDATION_TOOL_TOOLTIPS: Record<string, string> = {
  'brief-generator': appCopy.ui.workspace.dashboard.foundationTooltipBrief,
  'tov-generator': appCopy.ui.workspace.dashboard.foundationTooltipTov,
  'personas-generator': appCopy.ui.workspace.dashboard.foundationTooltipPersonas,
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

  const handleScrollToTools = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById('available-tools')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

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
      {/* Header row — title + inline subtitle stats + CTA */}
      <div className="workspace-overview__header">
        <div className="workspace-overview__header-left">
          <h4 className="workspace-overview__title">{projectName}</h4>
          <span className="workspace-overview__subtitle">
            {ctx.assets.length > 0
              ? copy.workspaceOverviewStatsAssets(ctx.assets.length)
              : copy.workspaceOverviewStatsNone}
            {ctx.assets.length > 0 && (
              <>
                <span className="workspace-overview__stat-sep">&middot;</span>
                {copy.workspaceOverviewStatsTypes(assetTypesWithAssets)}
                {staleCount > 0 && (
                  <>
                    <span className="workspace-overview__stat-sep">&middot;</span>
                    <span className="workspace-overview__subtitle--warning">
                      {copy.workspaceOverviewStatsStale(staleCount)}
                    </span>
                  </>
                )}
                {ctx.overallQualityScore > 0 && (
                  <>
                    <span className="workspace-overview__stat-sep">&middot;</span>
                    {copy.workspaceOverviewQuality(ctx.overallQualityScore)}
                  </>
                )}
              </>
            )}
          </span>
        </div>
        <div className="workspace-overview__cta">
          {firstSuggestedTool ? (
            <Link
              to={`/workspaces/${workspaceId}/tools/${firstSuggestedTool}`}
              className={uiPrimitives.button}
              aria-disabled={isArchived || undefined}
            >
              <Play size={18} /> {copy.heroStartGenerating}
            </Link>
          ) : (
            <a
              href="#available-tools"
              className={uiPrimitives.button}
              onClick={handleScrollToTools}
              aria-disabled={isArchived || undefined}
            >
              {copy.heroChooseTool}
            </a>
          )}
        </div>
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
