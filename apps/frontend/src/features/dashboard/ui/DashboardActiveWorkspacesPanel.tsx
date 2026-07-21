import { Link } from 'react-router-dom';
import { DashboardPanel } from '../../workspace/ui/dashboard/DashboardPanel';
import { appCopy } from '../../../app/copy/system';
import { uiPrimitives } from '../../../app/ui/primitives';
import type { DashboardOverviewData } from '../runtime/useDashboardOverview';

interface DashboardActiveWorkspacesPanelProps {
  activeWorkspaces: DashboardOverviewData['activeWorkspaces'];
  loading: boolean;
  error: string | null;
}

const STATUS_CLASS: Record<string, string> = {
  healthy: 'dashboard-workspace-chip__status--healthy',
  'needs-attention': 'dashboard-workspace-chip__status--needs-attention',
  blocked: 'dashboard-workspace-chip__status--blocked',
};

export const DashboardActiveWorkspacesPanel: React.FC<DashboardActiveWorkspacesPanelProps> = ({
  activeWorkspaces,
  loading,
  error,
}) => {
  const footer = (
    <Link to="/workspaces" className={uiPrimitives.button}>
      {appCopy.ui.dashboard.activeWorkspacesFooterLink}
    </Link>
  );

  if (loading) {
    return (
      <DashboardPanel
        title={appCopy.ui.dashboard.activeWorkspacesTitle}
        loading
        footer={footer}
      />
    );
  }

  if (error) {
    return (
      <DashboardPanel
        title={appCopy.ui.dashboard.activeWorkspacesTitle}
        error={error}
        footer={footer}
      />
    );
  }

  if (activeWorkspaces.length === 0) {
    return (
      <DashboardPanel
        title={appCopy.ui.dashboard.activeWorkspacesTitle}
        empty="No active workspaces."
        footer={footer}
      />
    );
  }

  return (
    <DashboardPanel
      title={appCopy.ui.dashboard.activeWorkspacesTitle}
      footer={footer}
    >
      <div className="dashboard-workspace-chip-row">
        {activeWorkspaces.map(ws => (
          <Link
            key={ws.id}
            to={`/workspaces/${ws.id}`}
            className="dashboard-workspace-chip"
          >
            {ws.name}
            <span className={STATUS_CLASS[ws.qualityGateStatus] ?? ''}>
              {ws.qualityGateStatus === 'healthy' ? ' \u2713' : ' \u26a0'}
            </span>
          </Link>
        ))}
      </div>
    </DashboardPanel>
  );
};
