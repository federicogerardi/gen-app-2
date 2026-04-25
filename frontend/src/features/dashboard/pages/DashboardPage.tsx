import { Link } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { Surface, TopBar, uiPrimitives } from '../../../app/ui/primitives';

export const DashboardPage = () => {
  const generation = useGenerationWorkspace();
  const recentArtifacts = generation.artifacts.slice(0, 5);
  const artifactCount = generation.artifacts.length;

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
          <h3>2</h3>
          <p>{appCopy.editorial.dashboard.stats[1]}</p>
        </div>
        <div>
          <h3>As-is</h3>
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
          </div>
        </Surface>

        <Surface as="article" className={uiPrimitives.dashboardCard}>
          <h3>{appCopy.editorial.dashboard.cards.recentArtifacts.title}</h3>
          {recentArtifacts.length === 0 ? (
            <p className={uiPrimitives.metaLine}>{appCopy.ui.states.noArtifactsAvailable}</p>
          ) : (
            <ul>
              {recentArtifacts.map((artifact) => (
                <li key={artifact.artifactId}>
                  <Link to={`/artifacts/${artifact.artifactId}`} className={uiPrimitives.inlineLink}>
                    {artifact.artifactType} | {artifact.status} | {artifact.projectId}
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
