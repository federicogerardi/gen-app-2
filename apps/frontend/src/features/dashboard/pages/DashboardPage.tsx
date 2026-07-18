
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Card, CardContent, CardHeader } from '@mui/material';
import { appCopy } from '../../../app/copy/system';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import { useSessionsQuery } from '../../../app/runtime/queries/useSessionsQuery';
import { ErrorStateMessage, LoadingStateMessage, Surface, TopBar, uiPrimitives } from '../../../app/ui/primitives';
import { getToolLabel } from '../../tools/runtime/tool-form-architecture';
import { UI_CONFIG } from '../../../app/config/ui-config';

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
          <Button component={Link} to="/workspaces" variant="contained" color="primary">
            {appCopy.editorial.dashboard.zeroState.cta}
          </Button>
        </div>
      </Surface>
    );
  }

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <h2>{appCopy.editorial.dashboard.headline}</h2>
      <p>{appCopy.editorial.dashboard.body}</p>

      <TopBar as="section" className={`${uiPrimitives.surface} ui-dashboard-kpi-topbar`}>
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
        <Card className="ui-dashboard-card-with-cta">
          <CardHeader title={appCopy.editorial.dashboard.cards.projects.title} />
          <CardContent>
          <div className="ui-dashboard-card-cta-content">
            <p className="ui-dashboard-card-cta-body">{appCopy.editorial.dashboard.cards.projects.body}</p>
            <Link to="/workspaces" className="ui-dashboard-card-cta-link ui-button">
              {appCopy.ui.actions.openProjects}
            </Link>
          </div>
          </CardContent>
        </Card>

        <Card className="ui-dashboard-card-with-cta">
          <CardHeader title={appCopy.editorial.dashboard.cards.tools.title} />
          <CardContent>
          <div className="ui-dashboard-card-cta-content">
            <p className="ui-dashboard-card-cta-body">{appCopy.editorial.dashboard.cards.tools.body}</p>
            <Link to="/workspaces" className="ui-dashboard-card-cta-link ui-button">
              {appCopy.ui.navigation.tools}
            </Link>
          </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title={appCopy.editorial.dashboard.cards.recentSessions.title} />
          <CardContent>
          {sessionsQuery.loading ? (
            <LoadingStateMessage>Caricamento sessioni...</LoadingStateMessage>
          ) : sessionsQuery.error ? (
            <ErrorStateMessage>{sessionsQuery.error}</ErrorStateMessage>
          ) : recentSessions.length === 0 ? (
            <p className={uiPrimitives.metaLine}>{appCopy.editorial.sessions.emptyState}</p>
          ) : (
            <ul className={uiPrimitives.listClean}>
              {recentSessions.map((session) => {
                const projectName = projectNameById.get(session.projectId) ?? `Project ${session.projectId}`;
                const createdAt = new Date(session.createdAt ?? session.updatedAt).toLocaleDateString('it-IT');

                return (
                  <li key={session.sessionId}>
                    <Link to={`/workspaces/${session.projectId}/sessions/${session.sessionId}`} style={{ textDecoration: 'none' }}>
                    <Button color="inherit" size="small" variant="text">
                        {projectName} · {formatSessionToolName(session.toolKey)} · {createdAt}
                    </Button>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          </CardContent>
        </Card>
      </section>
    </Surface>
  );
};
