import { Chip, LinearProgress, Typography } from '@mui/material';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useWorkspaceContext } from '../../runtime/useWorkspaceContext';
import { LoadingStateMessage, ErrorStateMessage } from '../../../../app/ui/primitives';

interface WorkspaceKnowledgeOverviewProps {
  workspaceId: string;
}

const GATE_CONFIG = {
  healthy: { icon: CheckCircle, color: 'success' as const, label: 'Ready' },
  'needs-attention': { icon: AlertTriangle, color: 'warning' as const, label: 'Needs Review' },
  blocked: { icon: XCircle, color: 'error' as const, label: 'Blocked' },
};

export const WorkspaceKnowledgeOverview: React.FC<WorkspaceKnowledgeOverviewProps> = ({ workspaceId }) => {
  const ctx = useWorkspaceContext(workspaceId);

  if (ctx.loading) return <LoadingStateMessage>Loading knowledge overview...</LoadingStateMessage>;
  if (ctx.error) return <ErrorStateMessage>{ctx.error}</ErrorStateMessage>;

  const gateConfig = GATE_CONFIG[ctx.qualityGateStatus];
  const GateIcon = gateConfig.icon;
  const completion = ctx.workflowPosition?.estimatedCompletion ?? 0;
  const toolsCompleted = ctx.workflowPosition?.completedSteps.length ?? 0;
  const toolsTotal = ctx.workflowPosition?.totalSteps ?? 8;

  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel__content">
        <div className="knowledge-overview">
          <div className="knowledge-overview__score">
            <span className="knowledge-overview__score-value">{ctx.overallQualityScore}</span>
            <span className="knowledge-overview__score-label">Quality Score</span>
          </div>

          <div className="knowledge-overview__stats">
            <div className="knowledge-overview__stat-row">
              <Typography variant="body2" color="text.secondary">
                {ctx.assets.length} {ctx.assets.length === 1 ? 'asset' : 'assets'}
              </Typography>
            </div>
            <div className="knowledge-overview__stat-row">
              <Chip
                icon={<GateIcon size={14} />}
                label={gateConfig.label}
                color={gateConfig.color}
                size="small"
              />
            </div>
          </div>

          <div className="knowledge-overview__progress">
            <div className="knowledge-overview__progress-label">
              {toolsCompleted}/{toolsTotal} tools completed
            </div>
            <LinearProgress
              variant="determinate"
              value={completion}
              color={completion >= 80 ? 'success' : completion >= 40 ? 'primary' : 'warning'}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
