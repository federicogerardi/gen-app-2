import { useParams, Link } from 'react-router-dom';
import { Button, Typography } from '@mui/material';
import { ArrowRight, Play } from 'lucide-react';
import { useWorkspaceContext } from '../runtime/useWorkspaceContext';
import { useWorkspaceProject } from '../runtime/WorkspaceProjectContext';
import { ContextualToolsPanel } from '../ui/dashboard/ContextualToolsPanel';
import { FoundationToolsPanel } from '../ui/dashboard/FoundationToolsPanel';
import { RecentSessionsPanel } from '../ui/dashboard/RecentSessionsPanel';
import { RecentAssetsPanel } from '../ui/dashboard/RecentAssetsPanel';
import { LoadingStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';
import '../ui/dashboard/dashboard-panels.css';

export const WorkspaceDashboard: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const ctx = useWorkspaceContext(workspaceId);
  const { projectName, isArchived } = useWorkspaceProject();

  if (ctx.loading) return <LoadingStateMessage>Loading workspace...</LoadingStateMessage>;
  if (ctx.error) return <ErrorStateMessage>{ctx.error}</ErrorStateMessage>;
  if (!workspaceId) return null;

  const suggestedNext = ctx.workflowPosition?.suggestedNext ?? [];
  const firstSuggestedTool = suggestedNext[0];
  const staleCount = ctx.assets.filter(a => a.staleUpstream).length;
  const assetTypesWithAssets = Object.keys(ctx.groupedByType)
    .filter(k => (ctx.groupedByType[k]?.length ?? 0) > 0).length;

  return (
    <section className="workspace-dashboard">
      <div className="workspace-dashboard__hero">
        <div className="workspace-dashboard__hero-content">
          <Typography variant="h4" sx={{ fontWeight: 700 }}>{projectName}</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            {ctx.assets.length > 0
              ? `${ctx.assets.length} asset${ctx.assets.length !== 1 ? 's' : ''} · ${assetTypesWithAssets} type${assetTypesWithAssets !== 1 ? 's' : ''}`
              : 'No assets yet'}
            {staleCount > 0 && ` · ${staleCount} stale`}
          </Typography>
        </div>
        <div className="workspace-dashboard__hero-cta">
          <Button
            component={Link}
            to={firstSuggestedTool
              ? `/workspaces/${workspaceId}/tools/${firstSuggestedTool}`
              : '#available-tools'}
            variant="contained" size="large"
            startIcon={firstSuggestedTool ? <Play size={18} /> : <ArrowRight size={18} />}
            disabled={isArchived}
          >
            {firstSuggestedTool ? 'Start generating' : 'Choose a tool'}
          </Button>
        </div>
      </div>

      <div className="dashboard-grid">
        <RecentSessionsPanel workspaceId={workspaceId} />
        <RecentAssetsPanel workspaceId={workspaceId} />
      </div>
      <div id="available-tools">
        <ContextualToolsPanel workspaceId={workspaceId} />
      </div>
      <FoundationToolsPanel workspaceId={workspaceId} />
    </section>
  );
};
