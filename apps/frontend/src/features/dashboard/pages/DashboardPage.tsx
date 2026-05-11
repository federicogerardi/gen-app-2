
import { Link, useSearchParams } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { Surface, TopBar, uiPrimitives } from '../../../app/ui/primitives';
import { toolFormRegistry } from '../../tools/runtime/tool-form-architecture';
import { AppButton } from '../../../components/AppButton';
import { AppCard } from '../../../components/AppCard';

export const DashboardPage = () => {
  const auth = useAuthSession();
  const [searchParams] = useSearchParams();
  const generation = useGenerationWorkspace();
  const projectsQuery = useProjectsQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
  });

  const recentArtifacts = generation.artifacts.slice(0, 5);
  const artifactCount = generation.artifacts.length;
  const toolsCount = Object.keys(toolFormRegistry).length;
  const completedCount = generation.artifacts.filter((a) => a.status === 'completed').length;

  const hasNoProjects = !projectsQuery.loading && !projectsQuery.error && projectsQuery.data.length === 0;
  const previewZeroState = searchParams.get('preview') === 'zero-state';

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
      <p className={uiPrimitives.metaLine}>{appCopy.editorial.dashboard.eyebrow}</p>
      <h2>{appCopy.editorial.dashboard.headline}</h2>
      <p>{appCopy.editorial.dashboard.body}</p>

      <TopBar as="section" className={uiPrimitives.surface}>
        <div>
          <h3>{artifactCount}</h3>
          <p>{appCopy.editorial.dashboard.stats[0]}</p>
        </div>
        <div>
          <h3>{toolsCount}</h3>
          <p>{appCopy.editorial.dashboard.stats[1]}</p>
        </div>
        <div>
          <h3>{completedCount}</h3>
          <p>{appCopy.editorial.dashboard.stats[2]}</p>
        </div>
      </TopBar>

      <section className={uiPrimitives.dashboardGrid}>
        <AppCard title={appCopy.editorial.dashboard.cards.projects.title}>
          <p>{appCopy.editorial.dashboard.cards.projects.body}</p>
          <Link to="/dashboard/projects" style={{ textDecoration: 'none' }}>
            <AppButton sx={{ mt: 1 }}>
              {appCopy.ui.actions.openProjects}
            </AppButton>
          </Link>
        </AppCard>

        <AppCard title={appCopy.editorial.dashboard.cards.tools.title}>
          <p>{appCopy.editorial.dashboard.cards.tools.body}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <Link to="/tools/funnel-pages" style={{ textDecoration: 'none' }}>
              <AppButton size="small">
                {appCopy.ui.navigation.funnelPages}
              </AppButton>
            </Link>
            <Link to="/tools/nextland" style={{ textDecoration: 'none' }}>
              <AppButton size="small">
                {appCopy.ui.navigation.nextland}
              </AppButton>
            </Link>
            <Link to="/tools/youtube-lf-script" style={{ textDecoration: 'none' }}>
              <AppButton size="small">
                {appCopy.ui.navigation.youtubeLfScript}
              </AppButton>
            </Link>
          </div>
        </AppCard>

        <AppCard title={appCopy.editorial.dashboard.cards.recentArtifacts.title}>
          {recentArtifacts.length === 0 ? (
            <p className={uiPrimitives.metaLine}>{appCopy.ui.states.noArtifactsAvailable}</p>
          ) : (
            <ul className={uiPrimitives.listClean}>
              {recentArtifacts.map((artifact) => (
                <li key={artifact.artifactId}>
                  <Link to={`/artifacts/${artifact.artifactId}`} style={{ textDecoration: 'none' }}>
                    <AppButton color="inherit" size="small">
                      {artifact.artifactType} · {new Date(artifact.updatedAt).toLocaleDateString('it-IT')}
                    </AppButton>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </AppCard>
      </section>
    </Surface>
  );
};
