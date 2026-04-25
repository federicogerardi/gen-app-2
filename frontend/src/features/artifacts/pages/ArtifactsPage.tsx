import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { appCopy, formatMeta } from '../../../app/copy/system';
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
      <h2>{appCopy.editorial.artifacts.archiveTitle}</h2>

      <div className={uiPrimitives.artifactFilters}>
        <label>
          {appCopy.ui.labels.type}
          <select
            value={filters.type}
            onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value as ArtifactQuery['type'] }))}
          >
            {appCopy.ui.options.artifactTypes.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label>
          {appCopy.ui.labels.status}
          <select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value as ArtifactQuery['status'] }))}
          >
            {appCopy.ui.options.artifactStatuses.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label>
          {appCopy.ui.labels.project}
          <input
            value={filters.projectId === 'all' ? '' : filters.projectId}
            onChange={(event) => {
              const value = event.target.value.trim();
              setFilters((prev) => ({ ...prev, projectId: value.length > 0 ? value : 'all' }));
            }}
            placeholder={appCopy.ui.placeholders.projectId}
          />
        </label>
      </div>

      <ul className={uiPrimitives.listClean}>
        {items.map((artifact) => (
          <Surface as="li" key={artifact.artifactId}>
            <p><strong>{artifact.artifactType}</strong> | {artifact.status}</p>
            <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.project, artifact.projectId)}</p>
            <p className={uiPrimitives.metaLine}>{formatMeta(appCopy.ui.meta.updated, new Date(artifact.updatedAt).toLocaleString())}</p>
            <Link to={`/artifacts/${artifact.artifactId}`} className={uiPrimitives.inlineLink}>{appCopy.ui.actions.openDetail}</Link>
          </Surface>
        ))}
      </ul>
    </Surface>
  );
};
