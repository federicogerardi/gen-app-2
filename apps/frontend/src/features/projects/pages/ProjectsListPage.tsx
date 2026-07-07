import { Link } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import {
  cx,
  EmptyStateMessage,
  ErrorStateMessage,
  LoadingStateMessage,
  Surface,
  TopBar,
  uiPrimitives,
} from '../../../app/ui/primitives';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';

export const ProjectsListPage = () => {
  const { apiBaseUrl, capabilities } = useApiConfig();
  const projectsQuery = useProjectsQuery({
    apiBaseUrl,
    capabilities,
  });

  const projects = projectsQuery.data;
  const error = projectsQuery.error;

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{appCopy.editorial.projects.listTitle}</h2>
        <Link to="/dashboard/projects/new" className={uiPrimitives.inlineLink}>{appCopy.ui.actions.newProject}</Link>
      </TopBar>

      {projectsQuery.loading ? <LoadingStateMessage>{appCopy.ui.states.loadingProjects}</LoadingStateMessage> : null}
      {error ? <ErrorStateMessage>{error}</ErrorStateMessage> : null}
      {!error && !projectsQuery.loading && projects.length === 0
        ? <EmptyStateMessage>{appCopy.ui.states.noProjectsAvailable}</EmptyStateMessage>
        : null}

      {!error && projects.length > 0 ? (
        <div className={uiPrimitives.artifactTableWrap}>
          <table className={uiPrimitives.artifactTable}>
            <thead>
              <tr>
                <th scope="col">{appCopy.ui.labels.project ?? 'Progetto'}</th>
                <th scope="col">Descrizione</th>
                <th scope="col">{appCopy.ui.meta.updated}</th>
                <th scope="col">{appCopy.ui.actions.openDetail}</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td><strong>{project.name}</strong></td>
                  <td>{project.description}</td>
                  <td><span className={uiPrimitives.metaLine}>{new Date(project.updatedAt).toLocaleString()}</span></td>
                  <td>
                    <Link
                      to={`/dashboard/projects/${project.id}`}
                      className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
                    >
                      {appCopy.ui.actions.openDetail}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Surface>
  );
};
