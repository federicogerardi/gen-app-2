
import { Link, useSearchParams } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import { useSessionsQuery } from '../../../app/runtime/queries/useSessionsQuery';
import { Surface, TopBar, uiPrimitives } from '../../../app/ui/primitives';
import { getToolLabel } from '../../tools/runtime/tool-form-architecture';
import { UI_CONFIG } from '../../../app/config/ui-config';
import { DashboardPanel } from '../../workspace/ui/dashboard/DashboardPanel';

const formatSessionToolName = (toolKey: string | null): string => getToolLabel(toolKey);

export const DashboardPage = () => {
  const { apiBaseUrl, capabilities } = useApiConfig();
  const [searchParams] = useSearchParams();
  const projectsQuery = useProjectsQuery({
    apiBaseUrl,
    capabilities,
  });
  const sessionsQuery = useSessionsQuery({
    apiBaseUrl,
    capabilities,
  });

  const projectsCount = projectsQuery.loading ? '—' : projectsQuery.data.length;
  const sessionsCount = sessionsQuery.loading ? '—' : sessionsQuery.data.length;

  const hasNoProjects = !projectsQuery.loading && !projectsQuery.error && projectsQuery.data.length === 0;
  const previewZeroState = searchParams.get('preview') === 'zero-state';
  const projectNameById = new Map(projectsQuery.data.map((project) => [project.id, project.name]));
  const recentSessions = sessionsQuery.data.slice(0, UI_CONFIG.limits.dashboardRecentSessionsCount);

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

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <h2>{appCopy.editorial.dashboard.headline}</h2>
      <p>{appCopy.editorial.dashboard.body}</p>

      <TopBar
        as="section"
        className={`${uiPrimitives.surface} ui-dashboard-kpi-topbar`}
        role="region"
        aria-label={appCopy.editorial.dashboard.headline}
      >
        <div className="ui-dashboard-kpi-item">
          <h3 className="ui-kpi-value">
            {projectsCount}
          </h3>
          <p className="ui-kpi-label">
            {appCopy.editorial.dashboard.stats[0]}
          </p>
        </div>
        <div className="ui-dashboard-kpi-item">
          <h3 className="ui-kpi-value">
            {sessionsCount}
          </h3>
          <p className="ui-kpi-label">
            {appCopy.editorial.dashboard.stats[1]}
          </p>
        </div>
      </TopBar>

      <section className={uiPrimitives.dashboardGrid}>
        <DashboardPanel
          title={appCopy.editorial.dashboard.cards.projects.title}
          footer={
            <Link to="/workspaces" className={uiPrimitives.inlineLink}>
              {appCopy.ui.actions.openProjects}
            </Link>
          }
        >
          <p>{appCopy.editorial.dashboard.cards.projects.body}</p>
        </DashboardPanel>

        <DashboardPanel
          title={appCopy.editorial.dashboard.cards.tools.title}
          footer={
            <Link to="/workspaces" className={uiPrimitives.inlineLink}>
              {appCopy.ui.navigation.tools}
            </Link>
          }
        >
          <p>{appCopy.editorial.dashboard.cards.tools.body}</p>
        </DashboardPanel>

        <DashboardPanel
          title={appCopy.editorial.dashboard.cards.recentSessions.title}
          loading={sessionsQuery.loading}
          error={sessionsQuery.error}
          empty={recentSessions.length === 0 && !sessionsQuery.loading && !sessionsQuery.error ? appCopy.editorial.sessions.emptyState : undefined}
        >
          <ul className={uiPrimitives.listClean}>
            {recentSessions.map((session) => {
              const projectName = projectNameById.get(session.projectId) ?? `Project ${session.projectId}`;
              const createdAt = new Date(session.createdAt ?? session.updatedAt).toLocaleDateString('it-IT');

              return (
                <li key={session.sessionId}>
                  <Link
                    to={`/workspaces/${session.projectId}/sessions/${session.sessionId}`}
                    className="ui-dashboard-session-link"
                  >
                    {projectName} · {formatSessionToolName(session.toolKey)} · {createdAt}
                  </Link>
                </li>
              );
            })}
          </ul>
        </DashboardPanel>
      </section>
    </Surface>
  );
};
