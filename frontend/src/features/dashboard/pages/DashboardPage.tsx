import { Link } from 'react-router-dom';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { Surface, uiPrimitives } from '../../../app/ui/primitives';

export const DashboardPage = () => {
  const generation = useGenerationWorkspace();
  const recentArtifacts = generation.artifacts.slice(0, 5);

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <h2>Dashboard</h2>
      <p>Workspace projects-first con backend as-is e fallback locale.</p>

      <section className="dashboard-grid">
        <Surface as="article" className="dashboard-card">
          <h3>Projects</h3>
          <p>Gestisci contesto e nuova creazione progetto.</p>
          <Link to="/dashboard/projects" className={uiPrimitives.inlineLink}>Apri projects</Link>
        </Surface>

        <Surface as="article" className="dashboard-card">
          <h3>Tools</h3>
          <p>Avvia funnel-pages o nextland con step guidati.</p>
          <div className={uiPrimitives.actions}>
            <Link to="/tools/funnel-pages" className={uiPrimitives.inlineLink}>Funnel Pages</Link>
            <Link to="/tools/nextland" className={uiPrimitives.inlineLink}>Nextland</Link>
          </div>
        </Surface>

        <Surface as="article" className="dashboard-card">
          <h3>Recent Artifacts</h3>
          {recentArtifacts.length === 0 ? (
            <p className="meta-line">Nessun artifact disponibile.</p>
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
