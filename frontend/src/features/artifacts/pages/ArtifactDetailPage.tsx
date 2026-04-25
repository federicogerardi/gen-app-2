import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
        <h2>Artifact detail</h2>
        <p className="meta-line">Artifact non trovato.</p>
        <Link to="/artifacts" className={uiPrimitives.inlineLink}>Torna all'archivio</Link>
      </Surface>
    );
  }

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>Artifact detail</h2>
        <Link to="/artifacts" className={uiPrimitives.inlineLink}>Torna all'archivio</Link>
      </TopBar>

      <p className="meta-line">artifactId: {artifact.artifactId}</p>
      <p className="meta-line">projectId: {artifact.projectId}</p>
      <p className="meta-line">status: {artifact.status}</p>
      <p className="meta-line">type: {artifact.artifactType}</p>
      <pre className="artifact-content">{artifact.content || 'Contenuto non disponibile.'}</pre>

      <div className={uiPrimitives.actions}>
        <Button type="button" onClick={() => generation.relaunch(artifact, 'primary')} disabled={relaunchDisabled}>
          Relaunch primario
        </Button>
        <Button type="button" onClick={() => generation.relaunch(artifact, 'secondary')} disabled={relaunchDisabled}>
          Relaunch secondario
        </Button>
        <Button type="button" disabled={!isDeleteEnabled}>
          Delete (UI only)
        </Button>
      </div>

      {!isDeleteEnabled ? <p className="meta-line">ARTIFACT_DELETE_ENABLED=false</p> : null}
    </Surface>
  );
};
