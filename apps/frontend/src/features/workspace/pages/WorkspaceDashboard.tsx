import { useParams } from 'react-router-dom';
import { useWorkspaceContext } from '../runtime/useWorkspaceContext';
import { WorkspaceKnowledgeOverview } from '../ui/dashboard/WorkspaceKnowledgeOverview';
import { SuggestedActionsPanel } from '../ui/dashboard/SuggestedActionsPanel';
import { ContextualToolsPanel } from '../ui/dashboard/ContextualToolsPanel';
import { AssetLibraryQuickAccess } from '../ui/dashboard/AssetLibraryQuickAccess';
import { RecentActivityPanel } from '../ui/dashboard/RecentActivityPanel';
import { LoadingStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';
import '../ui/dashboard/dashboard-panels.css';

export const WorkspaceDashboard: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const ctx = useWorkspaceContext(workspaceId);

  if (ctx.loading) return <LoadingStateMessage>Loading workspace...</LoadingStateMessage>;
  if (ctx.error) return <ErrorStateMessage>{ctx.error}</ErrorStateMessage>;
  if (!workspaceId) return null;

  return (
    <section className="workspace-dashboard">
      <WorkspaceKnowledgeOverview workspaceId={workspaceId} />
      <div className="dashboard-grid">
        <SuggestedActionsPanel workspaceId={workspaceId} />
        <ContextualToolsPanel workspaceId={workspaceId} />
      </div>
      <div className="dashboard-grid">
        <AssetLibraryQuickAccess workspaceId={workspaceId} />
        <RecentActivityPanel workspaceId={workspaceId} />
      </div>
    </section>
  );
};
