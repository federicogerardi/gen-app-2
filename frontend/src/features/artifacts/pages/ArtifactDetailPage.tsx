import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { appCopy, formatMeta } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import {
  Button,
  EmptyStateMessage,
  ErrorStateMessage,
  LoadingStateMessage,
  Surface,
  TopBar,
  uiPrimitives,
} from '../../../app/ui/primitives';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { useArtifactDetailQuery } from '../../../app/runtime/queries/useArtifactDetailQuery';
import {
  buildToolEntryPathFromArtifact,
} from '../../generation/ui/artifact-history';

const isDeleteEnabled = (import.meta.env.VITE_ARTIFACT_DELETE_ENABLED as string | undefined) === 'true';

export const ArtifactDetailPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();
  const artifactQuery = useArtifactDetailQuery({
    artifactId: id,
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    localArtifacts: generation.artifacts,
    enabled: id.length > 0,
  });

  const artifact = artifactQuery.data;

  const resumePath = useMemo(
    () => (artifact ? buildToolEntryPathFromArtifact(artifact, 'resume') : null),
    [artifact],
  );
  const regeneratePath = useMemo(
    () => (artifact ? buildToolEntryPathFromArtifact(artifact, 'regenerate') : null),
    [artifact],
  );
  const relaunchDisabled = useMemo(
    () => generation.isStreamActive || !artifact || !resumePath || !regeneratePath,
    [artifact, generation.isStreamActive, regeneratePath, resumePath],
  );

  if (!artifact) {
    return (
      <Surface as="section" className={uiPrimitives.stack}>
        <h2>{appCopy.editorial.artifacts.detailTitle}</h2>
        {artifactQuery.loading ? <LoadingStateMessage>Caricamento artifact...</LoadingStateMessage> : null}
        {artifactQuery.error ? <ErrorStateMessage>{artifactQuery.error}</ErrorStateMessage> : null}
        <EmptyStateMessage>{appCopy.ui.states.noArtifactFound}</EmptyStateMessage>
        <Link to="/artifacts" className={uiPrimitives.inlineLink}>{appCopy.ui.actions.openArchive}</Link>
      </Surface>
    );
  }

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{appCopy.editorial.artifacts.detailTitle}</h2>
        <Link to="/artifacts" className={uiPrimitives.inlineLink}>{appCopy.ui.actions.openArchive}</Link>
      </TopBar>

      <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.artifactId, artifact.artifactId)}</p>
      <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.projectId, artifact.projectId)}</p>
      <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.status, artifact.status)}</p>
      <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.type, artifact.artifactType)}</p>
      <pre className={uiPrimitives.artifactContent}>{artifact.content || 'Contenuto non disponibile.'}</pre>

      <div className={uiPrimitives.actions}>
        <Button
          type="button"
          onClick={() => {
            if (resumePath) {
              navigate(resumePath);
            }
          }}
          disabled={relaunchDisabled}
        >
          {appCopy.ui.actions.relaunchPrimary}
        </Button>
        <Button
          type="button"
          onClick={() => {
            if (regeneratePath) {
              navigate(regeneratePath);
            }
          }}
          disabled={relaunchDisabled}
        >
          {appCopy.ui.actions.relaunchSecondary}
        </Button>
        <Button type="button" disabled={!isDeleteEnabled}>
          {appCopy.ui.actions.deleteUiOnly}
        </Button>
      </div>

      {!isDeleteEnabled ? <p className={uiPrimitives.metaLine}>{appCopy.ui.states.artifactDeleteDisabled}</p> : null}
    </Surface>
  );
};
