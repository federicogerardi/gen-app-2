import { useMemo } from 'react';
import { Skeleton } from '@mui/material';
import { Link } from 'react-router-dom';
import { useApiConfig } from '../../../../app/providers/AuthSessionProvider';
import { useSessionsQuery } from '../../../../app/runtime/queries/useSessionsQuery';
import { getToolLabel } from '../../../../features/tools/runtime/tool-form-architecture';
import { StatusBadge } from '../../../../app/ui/StatusBadge';
import { DashboardPanel } from './DashboardPanel';
import { UI_CONFIG } from '../../../../app/config/ui-config';
import { formatRelativeTime } from '../../../../app/ui/format-utils';
import { appCopy } from '../../../../app/copy/system';

interface RecentSessionsPanelProps {
  workspaceId: string;
}

export const RecentSessionsPanel: React.FC<RecentSessionsPanelProps> = ({
  workspaceId,
}) => {
  const { apiBaseUrl, capabilities } = useApiConfig();
  const sessionsQuery = useSessionsQuery({
    projectId: workspaceId,
    apiBaseUrl,
    capabilities,
  });

  const recentSessions = useMemo(() => {
    // listSessions already returns newest-first; take the configured count.
    return (sessionsQuery.data ?? []).slice(
      0,
      UI_CONFIG.limits.dashboardRecentSessionsCount,
    );
  }, [sessionsQuery.data]);

  const footer = (
    <Link
      to={`/workspaces/${workspaceId}/sessions`}
      className="ui-inline-link"
    >
      {appCopy.ui.workspace.dashboard.viewAllSessionsArrow}
    </Link>
  );

  if (sessionsQuery.loading) {
    return (
      <DashboardPanel
        title={appCopy.ui.workspace.dashboard.recentSessionsTitle}
        loading
        footer={footer}
      >
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={52} sx={{ mb: 1 }} />
        ))}
      </DashboardPanel>
    );
  }

  if (sessionsQuery.error) {
    return (
      <DashboardPanel
        title={appCopy.ui.workspace.dashboard.recentSessionsTitle}
        error={sessionsQuery.error}
        footer={footer}
      />
    );
  }

  if (recentSessions.length === 0) {
    return (
      <DashboardPanel
        title={appCopy.ui.workspace.dashboard.recentSessionsTitle}
        empty={appCopy.ui.workspace.dashboard.recentSessionsEmpty}
        footer={footer}
      />
    );
  }

  return (
    <DashboardPanel
      title={appCopy.ui.workspace.dashboard.recentSessionsTitle}
      footer={footer}
    >
      {recentSessions.map(session => {
        const toolLabel = getToolLabel(session.toolKey);

        return (
          <div key={session.sessionId} className="dashboard-item-row">
            <span className="dashboard-item-row__primary">{toolLabel}</span>
            <span className="dashboard-item-row__meta">
              {appCopy.ui.workspace.dashboard.artifactCountLabel(session.artifactCount)}
              {' · '}
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
