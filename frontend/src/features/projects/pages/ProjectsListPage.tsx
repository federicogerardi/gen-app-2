import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
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
        setError(loadError instanceof Error ? loadError.message : appCopy.ui.fallbackErrors.loadProjects);
      }
    })();
  }, [auth.apiBaseUrl, auth.capabilities]);

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{appCopy.editorial.projects.listTitle}</h2>
        <Link to="/dashboard/projects/new" className={uiPrimitives.inlineLink}>{appCopy.ui.actions.newProject}</Link>
      </TopBar>

      {error ? <p className={uiPrimitives.error}>{error}</p> : null}

      {!error && projects.length === 0 ? <p className={uiPrimitives.metaLine}>{appCopy.ui.states.noProjectsAvailable}</p> : null}

      <ul className={uiPrimitives.listClean}>
        {projects.map((project) => (
          <Surface as="li" key={project.id}>
            <h3>{project.name}</h3>
            <p>{project.description}</p>
            <p className={uiPrimitives.metaLine}>{new Date(project.updatedAt).toLocaleString()}</p>
            <Link to={`/dashboard/projects/${project.id}`} className={uiPrimitives.inlineLink}>{appCopy.ui.actions.openDetail}</Link>
          </Surface>
        ))}
      </ul>
    </Surface>
  );
};
