import { Link } from 'react-router-dom';
import { Skeleton, IconButton, Tooltip } from '@mui/material';
import { FileText, Mic, Users, Plus, AlertTriangle, CheckCircle } from 'lucide-react';
import { useWorkspaceContext } from '../../runtime/useWorkspaceContext';
import { appCopy } from '../../../../app/copy/system';
import type { FoundationToolStatus } from '../../runtime/useWorkspaceContext';

interface FoundationToolsPanelProps {
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

export const FoundationToolsPanel: React.FC<FoundationToolsPanelProps> = ({ workspaceId }) => {
  const ctx = useWorkspaceContext(workspaceId);

  if (ctx.loading) {
    return (
      <div className="dashboard-panel">
        <div className="dashboard-panel__header">
          <Skeleton variant="text" width={100} />
        </div>
        <div className="dashboard-panel__content">
          <div className="foundation-status">
            {[0, 1].map(i => (
              <div key={i} className="foundation-status__item">
                <Skeleton variant="circular" width={24} height={24} />
                <Skeleton variant="text" width={80} />
                <Skeleton variant="text" width={140} />
                <Skeleton variant="circular" width={32} height={32} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (ctx.foundationTools.length === 0) {
    return null;
  }

  const renderStatus = (tool: FoundationToolStatus) => {
    const toolRoute = `/workspaces/${workspaceId}/tools/${tool.toolKey}`;
    const label = FOUNDATION_TOOL_LABELS[tool.toolKey] ?? tool.toolKey;
    const icon = FOUNDATION_TOOL_ICONS[tool.toolKey] ?? <FileText size={16} />;
    const count = tool.existingAssets.length;

    return (
      <div key={tool.toolKey} className="foundation-status__item">
        <span className="foundation-status__icon">{icon}</span>
        <span className="foundation-status__label">{label}</span>
        {tool.hasAssets ? (
          <span className="foundation-status__indicator foundation-status__indicator--present">
            <CheckCircle size={14} />
            <span>{appCopy.ui.workspace.dashboard.foundationStatusPresent(count)}</span>
          </span>
        ) : (
          <span className="foundation-status__indicator foundation-status__indicator--missing">
            <AlertTriangle size={14} />
            <span>{appCopy.ui.workspace.dashboard.foundationStatusMissing}</span>
          </span>
        )}
        <Tooltip
          title={
            tool.hasAssets
              ? appCopy.ui.workspace.dashboard.foundationToolsRegenerate
              : appCopy.ui.workspace.dashboard.foundationActionGenerate
          }
        >
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
    <div className="dashboard-panel">
      <div className="dashboard-panel__header">
        <span className="dashboard-panel__title">
          {appCopy.ui.workspace.dashboard.foundationToolsTitle}
        </span>
      </div>
      <div className="dashboard-panel__content">
        <div className="foundation-status">
          {ctx.foundationTools.map(renderStatus)}
        </div>
      </div>
    </div>
  );
};
