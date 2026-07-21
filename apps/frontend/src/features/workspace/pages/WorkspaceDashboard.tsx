import { useParams } from 'react-router-dom';
import { useWorkspaceContext } from '../runtime/useWorkspaceContext';
import { WorkspaceOverviewCard } from '../ui/dashboard/WorkspaceOverviewCard';
import { ContextualToolsPanel } from '../ui/dashboard/ContextualToolsPanel';
import { RecentSessionsPanel } from '../ui/dashboard/RecentSessionsPanel';
import { RecentAssetsPanel } from '../ui/dashboard/RecentAssetsPanel';
import { LoadingStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';
import { appCopy } from '../../../app/copy/system';
import '../ui/dashboard/dashboard-panels.css';

export const WorkspaceDashboard: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const ctx = useWorkspaceContext(workspaceId);

  if (ctx.loading) return <LoadingStateMessage>{appCopy.ui.workspace.dashboard.loadingWorkspace}</LoadingStateMessage>;
  if (ctx.error) return <ErrorStateMessage>{ctx.error}</ErrorStateMessage>;
  if (!workspaceId) return null;

  return (
    <section className="workspace-dashboard">
      <WorkspaceOverviewCard workspaceId={workspaceId} />
      <div className="dashboard-grid">
        <RecentAssetsPanel workspaceId={workspaceId} />
        <RecentSessionsPanel workspaceId={workspaceId} />
      </div>
      <div id="available-tools">
        <ContextualToolsPanel workspaceId={workspaceId} />
      </div>
    </section>
  );
};
