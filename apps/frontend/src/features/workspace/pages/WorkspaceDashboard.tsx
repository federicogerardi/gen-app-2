import { useParams, Link } from 'react-router-dom';
import { Button, Typography } from '@mui/material';
import { ArrowRight, Play } from 'lucide-react';
import { useWorkspaceContext } from '../runtime/useWorkspaceContext';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useProjectDetailQuery } from '../../../app/runtime/queries/useProjectDetailQuery';
import { WorkspaceKnowledgeOverview } from '../ui/dashboard/WorkspaceKnowledgeOverview';
import { ContextualToolsPanel } from '../ui/dashboard/ContextualToolsPanel';
import { FoundationToolsPanel } from '../ui/dashboard/FoundationToolsPanel';
import { AssetLibraryAccordion } from '../ui/dashboard/AssetLibraryAccordion';
import { LoadingStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';
import { appCopy } from '../../../app/copy/system';
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
              ? appCopy.ui.workspace.dashboard.heroSuggestionsReady(suggestedNext.length)
              : hasAssets
                ? appCopy.ui.workspace.dashboard.heroAssetsReady(ctx.assets.length)
                : appCopy.ui.workspace.dashboard.heroFirstAsset}
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
            {firstSuggestedTool
              ? appCopy.ui.workspace.dashboard.heroStartGenerating
              : appCopy.ui.workspace.dashboard.heroChooseTool}
          </Button>
        </div>
      </div>

      {/* ── Knowledge overview ── */}
      <WorkspaceKnowledgeOverview workspaceId={workspaceId} />

      {/* ── Foundation Tools ── */}
      <FoundationToolsPanel workspaceId={workspaceId} />

      {/* ── Asset Library ── */}
      <AssetLibraryAccordion workspaceId={workspaceId} />

      {/* ── Available Tools ── */}
      <ContextualToolsPanel workspaceId={workspaceId} />
    </section>
  );
};
