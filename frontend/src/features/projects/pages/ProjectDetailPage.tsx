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
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { useProjectDetailQuery } from '../../../app/runtime/queries/useProjectDetailQuery';
import { useArtifactsQuery } from '../../../app/runtime/queries/useArtifactsQuery';

export const ProjectDetailPage = () => {
  const { id = '' } = useParams();
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();
  const projectQuery = useProjectDetailQuery({
    projectId: id,
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    enabled: id.length > 0,
  });

  const project = projectQuery.data;

  const artifactsQuery = useArtifactsQuery({
    filters: { type: 'all', status: 'all', projectId: id },
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    localArtifacts: generation.artifacts,
    enabled: id.length > 0,
  });

  const projectArtifacts = artifactsQuery.data;

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
        </>
      ) : null}

      <h3>{appCopy.editorial.projects.contextualArtifacts}</h3>
      {artifactsQuery.loading ? <LoadingStateMessage>Caricamento artifact...</LoadingStateMessage> : null}
      {artifactsQuery.error ? <ErrorStateMessage>{artifactsQuery.error}</ErrorStateMessage> : null}
      {!artifactsQuery.loading && projectArtifacts.length === 0 ? (
        <EmptyStateMessage>{appCopy.ui.states.noProjectArtifacts}</EmptyStateMessage>
      ) : (
        <ul className={uiPrimitives.listClean}>
          {projectArtifacts.map((artifact) => (
            <Surface as="li" key={artifact.artifactId}>
              <p><strong>{artifact.artifactType}</strong> | {artifact.status}</p>
              <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.model, artifact.model)}</p>
              <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.date, new Date(artifact.updatedAt).toLocaleString())}</p>
              <Link to={`/artifacts/${artifact.artifactId}`} className={uiPrimitives.inlineLink}>{appCopy.ui.actions.openArtifact}</Link>
            </Surface>
          ))}
        </ul>
      )}
    </Surface>
  );
};
