import { useParams, Link } from 'react-router-dom';
import { Button, Typography } from '@mui/material';
import { ArrowRight, Play } from 'lucide-react';
import { useWorkspaceContext } from '../runtime/useWorkspaceContext';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useProjectDetailQuery } from '../../../app/runtime/queries/useProjectDetailQuery';
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
  const { apiBaseUrl, capabilities } = useApiConfig();
  const { data: project } = useProjectDetailQuery({
    projectId: workspaceId ?? '',
    apiBaseUrl,
    capabilities,
    enabled: Boolean(workspaceId),
  });

  if (ctx.loading) return <LoadingStateMessage>Loading workspace...</LoadingStateMessage>;
  if (ctx.error) return <ErrorStateMessage>{ctx.error}</ErrorStateMessage>;
  if (!workspaceId) return null;

  const projectName = project?.name ?? workspaceId;
  const suggestedNext = ctx.workflowPosition?.suggestedNext ?? [];
  const firstSuggestedTool = suggestedNext[0];
  const hasAssets = ctx.assets.length > 0;

  return (
    <section className="workspace-dashboard">
      {/* ── Hero section ── */}
      <div className="workspace-dashboard__hero">
        <div className="workspace-dashboard__hero-content">
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            {projectName}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            {suggestedNext.length > 0
              ? `${suggestedNext.length} tool suggestion${suggestedNext.length > 1 ? 's' : ''} ready`
              : hasAssets
                ? `${ctx.assets.length} asset${ctx.assets.length > 1 ? 's' : ''} · select a tool to continue`
                : 'Start by creating your first asset'}
          </Typography>
        </div>

        <div className="workspace-dashboard__hero-cta">
          <Button
            component={Link}
            to={firstSuggestedTool ? `/workspaces/${workspaceId}/tools/${firstSuggestedTool}` : '#available-tools'}
            variant="contained"
            size="large"
            startIcon={firstSuggestedTool ? <Play size={18} /> : <ArrowRight size={18} />}
          >
            {firstSuggestedTool ? 'Start generating' : 'Choose a tool'}
          </Button>
        </div>
      </div>

      {/* ── Knowledge overview ── */}
      <WorkspaceKnowledgeOverview workspaceId={workspaceId} />

      {/* ── Two-column: Suggestions + Tools ── */}
      <div className="dashboard-grid" id="available-tools">
        <SuggestedActionsPanel workspaceId={workspaceId} />
        <ContextualToolsPanel workspaceId={workspaceId} />
      </div>

      {/* ── Two-column: Assets + Activity ── */}
      <div className="dashboard-grid">
        <AssetLibraryQuickAccess workspaceId={workspaceId} />
        <RecentActivityPanel workspaceId={workspaceId} />
      </div>
    </section>
  );
};
