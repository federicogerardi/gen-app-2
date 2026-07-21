import { Link } from 'react-router-dom';
import { DashboardPanel } from '../../workspace/ui/dashboard/DashboardPanel';
import { StatusBadge } from '../../../app/ui/StatusBadge';
import { getToolLabel } from '../../tools/runtime/tool-form-architecture';
import { formatRelativeTime } from '../../../app/ui/format-utils';
import { appCopy } from '../../../app/copy/system';
import { uiPrimitives } from '../../../app/ui/primitives';
import type { SessionSummary } from '../../tools/runtime/session-client';

interface DashboardRecentActivityPanelProps {
  sessions: SessionSummary[];
  projectNameById: Map<string, string>;
  loading: boolean;
  error: string | null;
}

export const DashboardRecentActivityPanel: React.FC<DashboardRecentActivityPanelProps> = ({
  sessions,
  projectNameById,
  loading,
  error,
}) => {
  const footer = (
    <Link to="/workspaces" className={uiPrimitives.inlineLink}>
      {appCopy.ui.workspace.dashboard.viewAllSessionsArrow}
    </Link>
  );

  if (loading) {
    return (
      <DashboardPanel
        title={appCopy.editorial.dashboard.recentActivityTitle}
        loading
        footer={footer}
      />
    );
  }

  if (error) {
    return (
      <DashboardPanel
        title={appCopy.editorial.dashboard.recentActivityTitle}
        error={error}
        footer={footer}
      />
    );
  }

  if (sessions.length === 0) {
    return (
      <DashboardPanel
        title={appCopy.editorial.dashboard.recentActivityTitle}
        empty={appCopy.editorial.sessions.emptyState}
        footer={footer}
      />
    );
  }

  return (
    <DashboardPanel
      title={appCopy.editorial.dashboard.recentActivityTitle}
      footer={footer}
    >
      {sessions.map(session => {
        const projectName = projectNameById.get(session.projectId) ?? session.projectId;
        return (
          <div key={session.sessionId} className="dashboard-item-row">
            <span className="dashboard-item-row__primary">
              {getToolLabel(session.toolKey)}
            </span>
            <span className="dashboard-item-row__meta">
              {projectName}
              {' \u00b7 '}
              {appCopy.ui.workspace.dashboard.artifactCountLabel(session.artifactCount)}
              {' \u00b7 '}
              {formatRelativeTime(session.updatedAt)}
            </span>
            <span className="dashboard-item-row__badge">
              <StatusBadge status={session.status} />
            </span>
          </div>
        );
      })}
    </DashboardPanel>
  );
};
