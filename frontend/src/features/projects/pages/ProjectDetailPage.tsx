import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { appCopy, formatMeta } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { Surface, TopBar, uiPrimitives } from '../../../app/ui/primitives';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { getProjectById, type ProjectSummary } from '../runtime/projects-client';

export const ProjectDetailPage = () => {
  const { id = '' } = useParams();
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();
  const [project, setProject] = useState<ProjectSummary | null>(null);

  useEffect(() => {
    void (async () => {
      const next = await getProjectById(id, {
        apiBaseUrl: auth.apiBaseUrl,
        capabilities: auth.capabilities,
      });
      setProject(next);
    })();
  }, [auth.apiBaseUrl, auth.capabilities, id]);

  const projectArtifacts = useMemo(() => {
    return generation.artifacts.filter((artifact) => artifact.projectId === id);
  }, [generation.artifacts, id]);

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{appCopy.editorial.projects.detailTitle}</h2>
        <Link to="/dashboard/projects" className={uiPrimitives.inlineLink}>{appCopy.ui.actions.backToList}</Link>
      </TopBar>

      {!project ? (
        <p className={uiPrimitives.metaLine}>{appCopy.ui.states.noProjectFound}</p>
      ) : (
        <>
          <h3>{project.name}</h3>
          <p>{project.description}</p>
          <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.updated, new Date(project.updatedAt).toLocaleString())}</p>
        </>
      )}

      <h3>{appCopy.editorial.projects.contextualArtifacts}</h3>
      {projectArtifacts.length === 0 ? (
        <p className={uiPrimitives.metaLine}>{appCopy.ui.states.noProjectArtifacts}</p>
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
