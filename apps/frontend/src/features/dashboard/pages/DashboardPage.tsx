
import { Link, useSearchParams } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import { Surface, uiPrimitives, LoadingStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';
import { useDashboardOverview } from '../runtime/useDashboardOverview';
import { DashboardHeroPanel } from '../ui/DashboardHeroPanel';
import { DashboardFoundationSummaryPanel } from '../ui/DashboardFoundationSummaryPanel';
import { DashboardRecommendedActionsPanel } from '../ui/DashboardRecommendedActionsPanel';
import { DashboardRecentActivityPanel } from '../ui/DashboardRecentActivityPanel';
import { DashboardActiveWorkspacesPanel } from '../ui/DashboardActiveWorkspacesPanel';

export const DashboardPage = () => {
  const { apiBaseUrl, capabilities } = useApiConfig();
  const [searchParams] = useSearchParams();
  const projectsQuery = useProjectsQuery({ apiBaseUrl, capabilities });
  const overview = useDashboardOverview();

  const hasNoProjects = !projectsQuery.loading && !projectsQuery.error && projectsQuery.data.length === 0;
  const previewZeroState = searchParams.get('preview') === 'zero-state';

  if (hasNoProjects || previewZeroState) {
    return (
      <Surface as="section" className="ui-dashboard-zero-state">
        <div className="ui-dashboard-zero-state-inner">
          <p className={uiPrimitives.metaLine}>{appCopy.editorial.dashboard.zeroState.eyebrow}</p>
          <h2>{appCopy.editorial.dashboard.zeroState.headline}</h2>
          <p>{appCopy.editorial.dashboard.zeroState.body}</p>
          <Link to="/workspaces" className={uiPrimitives.button}>
            {appCopy.editorial.dashboard.zeroState.cta}
          </Link>
        </div>
      </Surface>
    );
  }

  if (overview.loading) {
    return (
      <Surface as="section" className={uiPrimitives.stack}>
        <LoadingStateMessage>{appCopy.ui.states.loadingDashboard}</LoadingStateMessage>
      </Surface>
    );
  }

  if (overview.error) {
    return (
      <Surface as="section" className={uiPrimitives.stack}>
        <ErrorStateMessage>{overview.error}</ErrorStateMessage>
      </Surface>
    );
  }

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <DashboardHeroPanel
        resumeCandidate={overview.resumeCandidate}
        loading={overview.loading}
      />
      <DashboardFoundationSummaryPanel
        foundationSummary={overview.foundationSummary}
        mostGappedWorkspaceId={overview.mostGappedWorkspaceId}
        loading={overview.loading}
        error={overview.error}
      />
      <section className={uiPrimitives.dashboardGrid}>
        <DashboardRecommendedActionsPanel
          recommendations={overview.recommendations}
          loading={overview.loading}
          error={overview.error}
        />
        <DashboardRecentActivityPanel
          sessions={overview.recentSessions}
          projectNameById={
            new Map(projectsQuery.data.map((p) => [p.id, p.name]))
          }
          loading={overview.loading}
          error={overview.error}
        />
      </section>
      <DashboardActiveWorkspacesPanel
        activeWorkspaces={overview.activeWorkspaces}
        loading={overview.loading}
        error={overview.error}
      />
    </Surface>
  );
};
