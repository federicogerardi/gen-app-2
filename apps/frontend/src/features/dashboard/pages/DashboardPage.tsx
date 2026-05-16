
import { Link, useSearchParams } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import { useSessionsQuery } from '../../../app/runtime/queries/useSessionsQuery';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { ErrorStateMessage, Surface, TopBar, uiPrimitives } from '../../../app/ui/primitives';
import { getEnabledToolKeys } from '../../tools/runtime/tool-form-architecture';
import type { SupportedTool } from '../../tools/machines/tool-flow.machine';
import { AppButton } from '../../../components/AppButton';
import { AppCard } from '../../../components/AppCard';

const formatSessionToolName = (toolKey: string | null): string => {
  if (toolKey === 'funnel-pages') return appCopy.ui.navigation.funnelPages;
  if (toolKey === 'nextland') return appCopy.ui.navigation.nextland;
  if (toolKey === 'youtube-lf-script') return appCopy.ui.navigation.youtubeLfScript;
  return toolKey ?? 'Tool non disponibile';
};

export const DashboardPage = () => {
  const auth = useAuthSession();
  const [searchParams] = useSearchParams();
  const generation = useGenerationWorkspace();
  const projectsQuery = useProjectsQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
  });
  const sessionsQuery = useSessionsQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
  });

  const artifactCount = generation.artifacts.length;
  const projectsCount = projectsQuery.data.length;
  const sessionsCount = sessionsQuery.data.length;

  const hasNoProjects = !projectsQuery.loading && !projectsQuery.error && projectsQuery.data.length === 0;
  const previewZeroState = searchParams.get('preview') === 'zero-state';
  const projectNameById = new Map(projectsQuery.data.map((project) => [project.id, project.name]));
  const recentSessions = sessionsQuery.data.slice(0, 5);

  if (hasNoProjects || previewZeroState) {
    return (
      <Surface as="section" className="ui-dashboard-zero-state">
        <div className="ui-dashboard-zero-state-inner">
          <p className={uiPrimitives.metaLine}>{appCopy.editorial.dashboard.zeroState.eyebrow}</p>
          <h2>{appCopy.editorial.dashboard.zeroState.headline}</h2>
          <p>{appCopy.editorial.dashboard.zeroState.body}</p>
          <Link to="/dashboard/projects/new" style={{ textDecoration: 'none' }}>
            <AppButton>
              {appCopy.editorial.dashboard.zeroState.cta}
            </AppButton>
          </Link>
        </div>
      </Surface>
    );
  }

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <h2>{appCopy.editorial.dashboard.headline}</h2>
      <p>{appCopy.editorial.dashboard.body}</p>

      <TopBar as="section" className={uiPrimitives.surface}>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 4px 0', lineHeight: 1 }}>
            {projectsCount}
          </h3>
          <p style={{ fontSize: '0.875rem', margin: '0', fontWeight: 500, opacity: 0.8 }}>
            {appCopy.editorial.dashboard.stats[0]}
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 4px 0', lineHeight: 1 }}>
            {sessionsCount}
          </h3>
          <p style={{ fontSize: '0.875rem', margin: '0', fontWeight: 500, opacity: 0.8 }}>
            {appCopy.editorial.dashboard.stats[1]}
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 4px 0', lineHeight: 1 }}>
            {artifactCount}
          </h3>
          <p style={{ fontSize: '0.875rem', margin: '0', fontWeight: 500, opacity: 0.8 }}>
            {appCopy.editorial.dashboard.stats[2]}
          </p>
        </div>
      </TopBar>

      <section className={uiPrimitives.dashboardGrid}>
        <AppCard title={appCopy.editorial.dashboard.cards.projects.title}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
            <p>{appCopy.editorial.dashboard.cards.projects.body}</p>
            <Link to="/dashboard/projects" style={{ textDecoration: 'none' }}>
              <AppButton sx={{ mt: 2, width: '100%' }}>
                {appCopy.ui.actions.openProjects}
              </AppButton>
            </Link>
          </div>
        </AppCard>

        <AppCard title={appCopy.editorial.dashboard.cards.tools.title}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
            <p>{appCopy.editorial.dashboard.cards.tools.body}</p>
            <Link to="/tools/funnel-pages" style={{ textDecoration: 'none' }}>
              <AppButton sx={{ mt: 2, width: '100%' }}>
                {appCopy.ui.navigation.funnelPages}
              </AppButton>
            </Link>
          </div>
        </AppCard>

        <AppCard title={appCopy.editorial.dashboard.cards.recentSessions.title}>
          {sessionsQuery.loading ? (
            <p className={uiPrimitives.metaLine}>Caricamento sessioni...</p>
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
                    <Link to={`/sessionsummary/${session.sessionId}`} style={{ textDecoration: 'none' }}>
                    <AppButton color="inherit" size="small">
                        {projectName} · {formatSessionToolName(session.toolKey)} · {createdAt}
                    </AppButton>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </AppCard>
      </section>
    </Surface>
  );
};
