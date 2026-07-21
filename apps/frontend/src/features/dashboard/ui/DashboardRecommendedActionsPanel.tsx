import { Link } from 'react-router-dom';
import { DashboardPanel } from '../../workspace/ui/dashboard/DashboardPanel';
import { appCopy } from '../../../app/copy/system';
import { uiPrimitives } from '../../../app/ui/primitives';
import type { WorkspaceToolRecommendation } from '../runtime/useDashboardOverview';

interface DashboardRecommendedActionsPanelProps {
  recommendations: WorkspaceToolRecommendation[];
  loading: boolean;
  error: string | null;
}

export const DashboardRecommendedActionsPanel: React.FC<DashboardRecommendedActionsPanelProps> = ({
  recommendations,
  loading,
  error,
}) => {
  if (loading) {
    return (
      <DashboardPanel
        title={appCopy.ui.dashboard.recommendedActionsTitle}
        loading
      />
    );
  }

  if (error) {
    return (
      <DashboardPanel
        title={appCopy.ui.dashboard.recommendedActionsTitle}
        error={error}
      />
    );
  }

  if (recommendations.length === 0) {
    return (
      <DashboardPanel
        title={appCopy.ui.dashboard.recommendedActionsTitle}
        empty={appCopy.ui.dashboard.recommendedActionsEmpty}
      />
    );
  }

  return (
    <DashboardPanel title={appCopy.ui.dashboard.recommendedActionsTitle}>
      {recommendations.map(rec => (
        <div key={`${rec.workspaceId}-${rec.toolKey}`} className="dashboard-item-row">
          <span className="dashboard-item-row__primary">{rec.label}</span>
          <span className="dashboard-item-row__meta">
            <span className="dashboard-recommendation__reason">{rec.reason}</span>
            <span className="dashboard-recommendation__workspace">
              {appCopy.ui.dashboard.recommendedActionWorkspaceLabel(rec.workspaceName)}
            </span>
          </span>
          <span className="dashboard-item-row__badge">
            <Link to={rec.to} className={uiPrimitives.inlineLink}>
              {appCopy.ui.dashboard.recommendedActionUseLabel}
            </Link>
          </span>
        </div>
      ))}
    </DashboardPanel>
  );
};
