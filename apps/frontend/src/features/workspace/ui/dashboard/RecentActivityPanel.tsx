import { Chip, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { useSessionsQuery } from '../../../../app/runtime/queries/useSessionsQuery';
import { useApiConfig } from '../../../../app/providers/AuthSessionProvider';
import { toolFormRegistry } from '../../../tools/runtime/tool-form-architecture';
import { DashboardPanel } from './DashboardPanel';
import { formatRelativeTime } from '../../../../app/ui/format-utils';
import { appCopy } from '../../../../app/copy/system';

interface RecentActivityPanelProps {
  workspaceId: string;
}

const STATUS_CONFIG = {
  completed: { color: 'success' as const, label: appCopy.ui.statusLabels.completed },
  generating: { color: 'primary' as const, label: appCopy.ui.statusLabels.generating },
  failed: { color: 'error' as const, label: appCopy.ui.statusLabels.failed },
};

export const RecentActivityPanel: React.FC<RecentActivityPanelProps> = ({ workspaceId }) => {
  const { apiBaseUrl, capabilities } = useApiConfig();
  const sessionsQuery = useSessionsQuery({
    projectId: workspaceId,
    apiBaseUrl,
    capabilities,
  });
  const copy = appCopy.ui.workspace.dashboard;

  const footer = (
    <Link to={`/workspaces/${workspaceId}/sessions`} className="ui-inline-link">
      {copy.viewAllSessionsArrow}
    </Link>
  );

  if (sessionsQuery.loading) {
    return (
      <DashboardPanel title={copy.recentActivityTitle} loading footer={footer} />
    );
  }

  if (sessionsQuery.error) {
    return (
      <DashboardPanel title={copy.recentActivityTitle} error={sessionsQuery.error} footer={footer} />
    );
  }

  const sessions = (sessionsQuery.data ?? []).slice(0, 5);

  if (sessions.length === 0) {
    return (
      <DashboardPanel
        title={copy.recentActivityTitle}
        empty={copy.noSessionsStartTool}
        footer={footer}
      />
    );
  }

  return (
    <DashboardPanel title={copy.recentActivityTitle} footer={footer}>
      <div className="recent-activity__list">
        {sessions.map(session => {
          const toolLabel = session.toolKey
            ? toolFormRegistry[session.toolKey as keyof typeof toolFormRegistry]?.displayName || session.toolKey
            : appCopy.ui.actions.unknownTool;
          const statusCfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.completed;
          return (
            <div key={session.sessionId} className="activity-item">
              <span className="activity-item__tool-name">{toolLabel}</span>
              <div className="activity-item__meta">
                <Chip label={statusCfg.label} color={statusCfg.color} size="small" variant="outlined" />
                <Typography variant="caption" className="activity-item__time">
                  {copy.artifactCountLabel(session.artifactCount)}
                </Typography>
                <Typography variant="caption" className="activity-item__time">
                  {formatRelativeTime(session.updatedAt)}
                </Typography>
              </div>
            </div>
          );
        })}
      </div>
    </DashboardPanel>
  );
};
