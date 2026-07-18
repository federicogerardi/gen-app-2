import { Chip, Typography } from '@mui/material';
import { useSessionsQuery } from '../../../../app/runtime/queries/useSessionsQuery';
import { useApiConfig } from '../../../../app/providers/AuthSessionProvider';
import { toolFormRegistry } from '../../../tools/runtime/tool-form-architecture';
import { LoadingStateMessage, EmptyStateMessage, ErrorStateMessage } from '../../../../app/ui/primitives';
import { formatRelativeTime } from '../../../../app/ui/format-utils';

interface RecentActivityPanelProps {
  workspaceId: string;
}

const STATUS_CONFIG = {
  completed: { color: 'success' as const, label: 'Done' },
  generating: { color: 'primary' as const, label: 'Running' },
  failed: { color: 'error' as const, label: 'Failed' },
};

export const RecentActivityPanel: React.FC<RecentActivityPanelProps> = ({ workspaceId }) => {
  const { apiBaseUrl, capabilities } = useApiConfig();
  const sessionsQuery = useSessionsQuery({
    projectId: workspaceId,
    apiBaseUrl,
    capabilities,
  });

  if (sessionsQuery.loading) return <LoadingStateMessage>Loading activity...</LoadingStateMessage>;
  if (sessionsQuery.error) return <ErrorStateMessage>{sessionsQuery.error}</ErrorStateMessage>;

  const sessions = (sessionsQuery.data ?? []).slice(0, 5);

  if (sessions.length === 0) {
    return (
      <div className="dashboard-panel">
        <div className="dashboard-panel__header">
          <span className="dashboard-panel__title">Recent Activity</span>
        </div>
        <div className="dashboard-panel__content">
          <EmptyStateMessage>No sessions yet — start by selecting a tool.</EmptyStateMessage>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel__header">
        <span className="dashboard-panel__title">Recent Activity</span>
      </div>
      <div className="dashboard-panel__content">
        <div className="recent-activity__list">
          {sessions.map(session => {
            const toolLabel = session.toolKey
              ? toolFormRegistry[session.toolKey as keyof typeof toolFormRegistry]?.displayName || session.toolKey
              : 'Unknown tool';
            const statusCfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.completed;
            return (
              <div key={session.sessionId} className="activity-item">
                <span className="activity-item__tool-name">{toolLabel}</span>
                <div className="activity-item__meta">
                  <Chip label={statusCfg.label} color={statusCfg.color} size="small" variant="outlined" />
                  <Typography variant="caption" className="activity-item__time">
                    {session.artifactCount} {session.artifactCount === 1 ? 'artifact' : 'artifacts'}
                  </Typography>
                  <Typography variant="caption" className="activity-item__time">
                    {formatRelativeTime(session.updatedAt)}
                  </Typography>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
