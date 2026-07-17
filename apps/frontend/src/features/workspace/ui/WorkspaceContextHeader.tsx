import { Breadcrumbs, Chip, Typography } from '@mui/material';
import { ChevronRight, Folder, FolderOpen, Database, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SupportedTool } from '../../tools/machines/tool-flow.machine';
import { toolFormRegistry } from '../../tools/runtime/tool-form-architecture';
import { appCopy } from '../../../app/copy/system';
import './WorkspaceContextHeader.css';

interface WorkflowPosition {
  currentStep: string;
  totalSteps: number;
  completedSteps: string[];
  suggestedNext?: SupportedTool[];
  estimatedCompletion?: number;
}

interface WorkspaceContextHeaderProps {
  workspaceId: string;
  workspaceName: string;
  currentTool: SupportedTool;
  assetCount: number;
  qualityGateStatus: 'healthy' | 'needs-attention' | 'blocked';
  crossToolPosition?: WorkflowPosition;
}

const QUALITY_GATE_CONFIG = {
  healthy: { icon: CheckCircle, color: 'success' as const, label: 'Ready' },
  'needs-attention': { icon: AlertTriangle, color: 'warning' as const, label: 'Needs Review' },
  blocked: { icon: XCircle, color: 'error' as const, label: 'Blocked' },
};

export const WorkspaceContextHeader: React.FC<WorkspaceContextHeaderProps> = ({
  workspaceId,
  workspaceName,
  currentTool,
  assetCount,
  qualityGateStatus,
  crossToolPosition,
}) => {
  const qualityConfig = QUALITY_GATE_CONFIG[qualityGateStatus];
  const QualityIcon = qualityConfig.icon;

  return (
    <div className="workspace-context-header">
      <div className="workspace-context-header__breadcrumb">
        <Breadcrumbs separator={<ChevronRight size={14} />} className="workspace-context-header__breadcrumbs">
          <Link
            to="/workspaces"
            className="workspace-context-header__breadcrumb-link"
          >
            <Folder size={16} />
            {appCopy.ui.workspace?.contextHeader?.breadcrumbWorkspaces || 'Workspaces'}
          </Link>
          <Link
            to={`/workspaces/${workspaceId}`}
            className="workspace-context-header__breadcrumb-link"
          >
            <FolderOpen size={16} />
            {workspaceName}
          </Link>
          <Typography variant="body2" color="text.primary">
            {toolFormRegistry[currentTool]?.displayName || currentTool}
          </Typography>
        </Breadcrumbs>
      </div>

      <div className="workspace-context-header__status">
        <Chip
          icon={<Database size={14} />}
          label={`${assetCount} ${appCopy.ui.workspace?.contextHeader?.assetCountLabel || 'assets'}`}
          variant="outlined"
          size="small"
          className="workspace-context-header__asset-chip"
        />

        <Chip
          icon={<QualityIcon size={14} />}
          label={qualityConfig.label}
          color={qualityConfig.color}
          size="small"
          className="workspace-context-header__quality-chip"
        />

        {crossToolPosition && (
          <div className="workspace-context-header__workflow">
            <Typography variant="caption" className="workspace-context-header__workflow-text">
              {crossToolPosition.currentStep} ({crossToolPosition.estimatedCompletion || 0}%)
            </Typography>

            {crossToolPosition.suggestedNext && crossToolPosition.suggestedNext.length > 0 && (
              <div className="workspace-context-header__next-tools">
                <Typography variant="caption">
                  {appCopy.ui.workspace?.contextHeader?.suggestedNextLabel || 'Next:'}
                </Typography>
                {crossToolPosition.suggestedNext.slice(0, 2).map(toolKey => (
                  <Chip
                    key={toolKey}
                    label={toolFormRegistry[toolKey]?.displayName || toolKey}
                    size="small"
                    variant="outlined"
                    component={Link}
                    to={`/workspaces/${workspaceId}/tools/${toolKey}`}
                    className="workspace-context-header__next-tool-chip"
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
