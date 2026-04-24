import { Link } from 'react-router-dom';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';

export const DashboardPage = () => {
  const generation = useGenerationWorkspace();
  const recentArtifacts = generation.artifacts.slice(0, 5);

  return (
    <section className="panel page-stack">
      <h2>Dashboard</h2>
      <p>Workspace projects-first con backend as-is e fallback locale.</p>

      <section className="dashboard-grid">
        <article className="panel dashboard-card">
          <h3>Projects</h3>
          <p>Gestisci contesto e nuova creazione progetto.</p>
          <Link to="/dashboard/projects" className="inline-link">Apri projects</Link>
        </article>

        <article className="panel dashboard-card">
          <h3>Tools</h3>
          <p>Avvia funnel-pages o nextland con step guidati.</p>
          <div className="actions">
            <Link to="/tools/funnel-pages" className="inline-link">Funnel Pages</Link>
            <Link to="/tools/nextland" className="inline-link">Nextland</Link>
          </div>
        </article>

        <article className="panel dashboard-card">
          <h3>Recent Artifacts</h3>
          {recentArtifacts.length === 0 ? (
            <p className="meta-line">Nessun artifact disponibile.</p>
          ) : (
            <ul>
              {recentArtifacts.map((artifact) => (
                <li key={artifact.artifactId}>
                  <Link to={`/artifacts/${artifact.artifactId}`} className="inline-link">
                    {artifact.artifactType} | {artifact.status} | {artifact.projectId}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </section>
  );
};
