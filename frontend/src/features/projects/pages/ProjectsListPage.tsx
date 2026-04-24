import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { listProjects, type ProjectSummary } from '../runtime/projects-client';

export const ProjectsListPage = () => {
  const auth = useAuthSession();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const next = await listProjects({
          apiBaseUrl: auth.apiBaseUrl,
          capabilities: auth.capabilities,
        });
        setProjects(next);
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load projects');
      }
    })();
  }, [auth.apiBaseUrl, auth.capabilities]);

  return (
    <section className="panel page-stack">
      <header className="top-bar">
        <h2>Projects</h2>
        <Link to="/dashboard/projects/new" className="inline-link">Nuovo progetto</Link>
      </header>

      {error ? <p className="error-message">{error}</p> : null}

      {!error && projects.length === 0 ? (
        <p className="meta-line">Nessun progetto disponibile.</p>
      ) : null}

      <ul className="list-clean">
        {projects.map((project) => (
          <li key={project.id} className="panel">
            <h3>{project.name}</h3>
            <p>{project.description}</p>
            <p className="meta-line">{new Date(project.updatedAt).toLocaleString()}</p>
            <Link to={`/dashboard/projects/${project.id}`} className="inline-link">Apri dettaglio</Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
