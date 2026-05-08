import { Link, useSearchParams } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { Surface, TopBar, uiPrimitives } from '../../../app/ui/primitives';
import { toolFormRegistry } from '../../tools/runtime/tool-form-architecture';

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
          <Link to="/dashboard/projects/new" className={uiPrimitives.button}>
            {appCopy.editorial.dashboard.zeroState.cta}
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
        <Surface as="article" className={uiPrimitives.dashboardCard}>
          <h3>{appCopy.editorial.dashboard.cards.projects.title}</h3>
          <p>{appCopy.editorial.dashboard.cards.projects.body}</p>
          <Link to="/dashboard/projects" className={uiPrimitives.inlineLink}>{appCopy.ui.actions.openProjects}</Link>
        </Surface>

        <Surface as="article" className={uiPrimitives.dashboardCard}>
          <h3>{appCopy.editorial.dashboard.cards.tools.title}</h3>
          <p>{appCopy.editorial.dashboard.cards.tools.body}</p>
          <div className={uiPrimitives.actions}>
            <Link to="/tools/funnel-pages" className={uiPrimitives.inlineLink}>{appCopy.ui.navigation.funnelPages}</Link>
            <Link to="/tools/nextland" className={uiPrimitives.inlineLink}>{appCopy.ui.navigation.nextland}</Link>
            <Link to="/tools/youtube-lf-script" className={uiPrimitives.inlineLink}>{appCopy.ui.navigation.youtubeLfScript}</Link>
          </div>
        </Surface>

        <Surface as="article" className={uiPrimitives.dashboardCard}>
          <h3>{appCopy.editorial.dashboard.cards.recentArtifacts.title}</h3>
          {recentArtifacts.length === 0 ? (
            <p className={uiPrimitives.metaLine}>{appCopy.ui.states.noArtifactsAvailable}</p>
          ) : (
            <ul className={uiPrimitives.listClean}>
              {recentArtifacts.map((artifact) => (
                <li key={artifact.artifactId}>
                  <Link to={`/artifacts/${artifact.artifactId}`} className={uiPrimitives.inlineLink}>
                    {artifact.artifactType} · {new Date(artifact.updatedAt).toLocaleDateString('it-IT')}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </section>
    </Surface>
  );
};
