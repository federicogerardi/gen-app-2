import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { Surface, uiPrimitives } from '../../../app/ui/primitives';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { listArtifacts, type ArtifactQuery } from '../runtime/artifacts-client';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';

const defaultFilters: ArtifactQuery = {
  type: 'all',
  status: 'all',
  projectId: 'all',
};

export const ArtifactsPage = () => {
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();
  const [filters, setFilters] = useState<ArtifactQuery>(defaultFilters);
  const [items, setItems] = useState<GenerationArtifact[]>([]);

  useEffect(() => {
    void (async () => {
      const next = await listArtifacts(filters, {
        apiBaseUrl: auth.apiBaseUrl,
        capabilities: auth.capabilities,
        localArtifacts: generation.artifacts,
      });
      setItems(next);
    })();
  }, [auth.apiBaseUrl, auth.capabilities, filters, generation.artifacts]);

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <h2>Artifacts archive</h2>

      <div className="artifact-filters">
        <label>
          Tipo
          <select
            value={filters.type}
            onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value as ArtifactQuery['type'] }))}
          >
            <option value="all">all</option>
            <option value="content">content</option>
            <option value="seo">seo</option>
            <option value="code">code</option>
            <option value="extraction">extraction</option>
          </select>
        </label>

        <label>
          Stato
          <select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value as ArtifactQuery['status'] }))}
          >
            <option value="all">all</option>
            <option value="generating">generating</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
          </select>
        </label>

        <label>
          Progetto
          <input
            value={filters.projectId === 'all' ? '' : filters.projectId}
            onChange={(event) => {
              const value = event.target.value.trim();
              setFilters((prev) => ({ ...prev, projectId: value.length > 0 ? value : 'all' }));
            }}
            placeholder="project-id"
          />
        </label>
      </div>

      <ul className={uiPrimitives.listClean}>
        {items.map((artifact) => (
          <Surface as="li" key={artifact.artifactId}>
            <p><strong>{artifact.artifactType}</strong> | {artifact.status}</p>
            <p className="meta-line">project: {artifact.projectId}</p>
            <p className="meta-line">updated: {new Date(artifact.updatedAt).toLocaleString()}</p>
            <Link to={`/artifacts/${artifact.artifactId}`} className={uiPrimitives.inlineLink}>Apri dettaglio</Link>
          </Surface>
        ))}
      </ul>
    </Surface>
  );
};
