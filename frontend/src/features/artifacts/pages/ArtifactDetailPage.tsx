import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { appCopy, formatMeta } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { Button, Surface, TopBar, uiPrimitives } from '../../../app/ui/primitives';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { getArtifactById } from '../runtime/artifacts-client';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';

const isDeleteEnabled = (import.meta.env.VITE_ARTIFACT_DELETE_ENABLED as string | undefined) === 'true';

export const ArtifactDetailPage = () => {
  const { id = '' } = useParams();
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();
  const [artifact, setArtifact] = useState<GenerationArtifact | null>(null);

  useEffect(() => {
    void (async () => {
      const next = await getArtifactById(id, {
        apiBaseUrl: auth.apiBaseUrl,
        capabilities: auth.capabilities,
        localArtifacts: generation.artifacts,
      });
      setArtifact(next);
    })();
  }, [auth.apiBaseUrl, auth.capabilities, generation.artifacts, id]);

  const relaunchDisabled = useMemo(() => generation.isStreamActive || !artifact, [artifact, generation.isStreamActive]);

  if (!artifact) {
    return (
      <Surface as="section" className={uiPrimitives.stack}>
        <h2>{appCopy.editorial.artifacts.detailTitle}</h2>
        <p className={uiPrimitives.metaLine}>{appCopy.ui.states.noArtifactFound}</p>
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
        <Button type="button" onClick={() => generation.relaunch(artifact, 'primary')} disabled={relaunchDisabled}>
          {appCopy.ui.actions.relaunchPrimary}
        </Button>
        <Button type="button" onClick={() => generation.relaunch(artifact, 'secondary')} disabled={relaunchDisabled}>
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
