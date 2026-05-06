import { Link, useParams } from 'react-router-dom';
import { appCopy, formatMeta } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import {
  EmptyStateMessage,
  ErrorStateMessage,
  LoadingStateMessage,
  Surface,
  TopBar,
  uiPrimitives,
} from '../../../app/ui/primitives';
import { useProjectDetailQuery } from '../../../app/runtime/queries/useProjectDetailQuery';
import { ArtifactsListingSection } from '../../artifacts/ui/ArtifactsListingSection';

export const ProjectDetailPage = () => {
  const { id = '' } = useParams();
  const auth = useAuthSession();
  const projectQuery = useProjectDetailQuery({
    projectId: id,
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    enabled: id.length > 0,
  });

  const project = projectQuery.data;

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{appCopy.editorial.projects.detailTitle}</h2>
        <Link to="/dashboard/projects" className={uiPrimitives.inlineLink}>{appCopy.ui.actions.backToList}</Link>
      </TopBar>

      {projectQuery.loading ? <LoadingStateMessage>{appCopy.ui.states.loadingProjects}</LoadingStateMessage> : null}
      {projectQuery.error ? <ErrorStateMessage>{projectQuery.error}</ErrorStateMessage> : null}

      {!project && !projectQuery.loading ? (
        <EmptyStateMessage>{appCopy.ui.states.noProjectFound}</EmptyStateMessage>
      ) : project ? (
        <>
          <h3>{project.name}</h3>
          <p>{project.description}</p>
          <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.updated, new Date(project.updatedAt).toLocaleString())}</p>

          <ArtifactsListingSection
            title={appCopy.editorial.projects.contextualArtifacts}
            emptyStateMessage={appCopy.ui.states.noProjectArtifacts}
            fixedProjectId={id}
            fixedProjectName={project.name}
            enabled={id.length > 0}
          />
        </>
      ) : null}
    </Surface>
  );
};
