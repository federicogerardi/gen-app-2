import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { Surface, TopBar, uiPrimitives } from '../../../app/ui/primitives';
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
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>Projects</h2>
        <Link to="/dashboard/projects/new" className={uiPrimitives.inlineLink}>Nuovo progetto</Link>
      </TopBar>

      {error ? <p className={uiPrimitives.error}>{error}</p> : null}

      {!error && projects.length === 0 ? (
        <p className="meta-line">Nessun progetto disponibile.</p>
      ) : null}

      <ul className={uiPrimitives.listClean}>
        {projects.map((project) => (
          <Surface as="li" key={project.id}>
            <h3>{project.name}</h3>
            <p>{project.description}</p>
            <p className="meta-line">{new Date(project.updatedAt).toLocaleString()}</p>
            <Link to={`/dashboard/projects/${project.id}`} className={uiPrimitives.inlineLink}>Apri dettaglio</Link>
          </Surface>
        ))}
      </ul>
    </Surface>
  );
};
