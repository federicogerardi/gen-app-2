import { Link } from 'react-router-dom';
import { appCopy, formatMeta } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { Surface, TopBar, uiPrimitives } from '../../../app/ui/primitives';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';

export const ProjectsListPage = () => {
  const auth = useAuthSession();
  const projectsQuery = useProjectsQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
  });

  const projects = projectsQuery.data;
  const error = projectsQuery.error;

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{appCopy.editorial.projects.listTitle}</h2>
        <Link to="/dashboard/projects/new" className={uiPrimitives.inlineLink}>{appCopy.ui.actions.newProject}</Link>
      </TopBar>

      {projectsQuery.loading ? <p className={uiPrimitives.metaLine}>{appCopy.ui.states.loadingProjects}</p> : null}

      {error ? <p className={uiPrimitives.error}>{error}</p> : null}

      {!error && projects.length === 0 ? <p className={uiPrimitives.metaLine}>{appCopy.ui.states.noProjectsAvailable}</p> : null}

      <ul className={uiPrimitives.listClean}>
        {projects.map((project) => (
          <Surface as="li" key={project.id}>
            <h3>{project.name}</h3>
            <p>{project.description}</p>
            <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.updated, new Date(project.updatedAt).toLocaleString())}</p>
            <Link to={`/dashboard/projects/${project.id}`} className={uiPrimitives.inlineLink}>{appCopy.ui.actions.openDetail}</Link>
          </Surface>
        ))}
      </ul>
    </Surface>
  );
};
