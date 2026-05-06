import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { appCopy, formatMeta } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import {
  EmptyStateMessage,
  ErrorStateMessage,
  LoadingStateMessage,
  Surface,
  uiPrimitives,
} from '../../../app/ui/primitives';
import { useArtifactsQuery } from '../../../app/runtime/queries/useArtifactsQuery';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { type ArtifactQuery } from '../runtime/artifacts-client';

const pageSize = 10;

type ArtifactsListingSectionProps = {
  title: string;
  emptyStateMessage?: string;
  fixedProjectId?: string;
  enabled?: boolean;
  headingLevel?: 'h2' | 'h3';
};

const normalizeFixedProjectId = (projectId: string | undefined): string | null => {
  if (typeof projectId !== 'string') {
    return null;
  }

  const trimmed = projectId.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildDefaultFilters = (fixedProjectId: string | null): ArtifactQuery => ({
  type: 'all',
  status: 'all',
  projectId: fixedProjectId ?? 'all',
});

export const ArtifactsListingSection = ({
  title,
  emptyStateMessage,
  fixedProjectId,
  enabled,
  headingLevel = 'h3',
}: ArtifactsListingSectionProps) => {
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();
  const normalizedFixedProjectId = useMemo(() => normalizeFixedProjectId(fixedProjectId), [fixedProjectId]);
  const [filters, setFilters] = useState<ArtifactQuery>(() => buildDefaultFilters(normalizedFixedProjectId));
  const [page, setPage] = useState(1);

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      projectId: normalizedFixedProjectId ?? prev.projectId,
    }));
    setPage(1);
  }, [normalizedFixedProjectId]);

  useEffect(() => {
    setPage(1);
  }, [filters.type, filters.status, filters.projectId, filters.from, filters.to]);

  const artifactsQuery = useArtifactsQuery({
    filters: {
      ...filters,
      projectId: normalizedFixedProjectId ?? filters.projectId,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    },
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    localArtifacts: generation.artifacts,
    ...(enabled !== undefined ? { enabled } : {}),
  });

  const items = artifactsQuery.data;
  const hasPreviousPage = page > 1;
  const hasNextPage = items.length === pageSize;

  const HeadingTag = headingLevel;

  return (
    <section className={uiPrimitives.stack}>
      <HeadingTag>{title}</HeadingTag>

      {artifactsQuery.loading ? <LoadingStateMessage>Caricamento artifact...</LoadingStateMessage> : null}
      {artifactsQuery.error ? <ErrorStateMessage>{artifactsQuery.error}</ErrorStateMessage> : null}

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
            value={(normalizedFixedProjectId ?? filters.projectId) === 'all' ? '' : (normalizedFixedProjectId ?? filters.projectId)}
            onChange={(event) => {
              const value = event.target.value.trim();
              setFilters((prev) => ({ ...prev, projectId: value.length > 0 ? value : 'all' }));
            }}
            placeholder={appCopy.ui.placeholders.projectId}
            disabled={normalizedFixedProjectId !== null}
          />
        </label>
      </div>

      {!artifactsQuery.loading && items.length === 0 ? (
        <EmptyStateMessage>{emptyStateMessage ?? appCopy.ui.states.noArtifactsAvailable}</EmptyStateMessage>
      ) : (
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
      )}

      <div className={uiPrimitives.clusterRow}>
        <button
          type="button"
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={!hasPreviousPage || artifactsQuery.loading}
        >
          {appCopy.ui.actions.previousPage}
        </button>
        <span className={uiPrimitives.metaLine}>{appCopy.ui.labels.page} {page}</span>
        <button
          type="button"
          onClick={() => setPage((prev) => prev + 1)}
          disabled={!hasNextPage || artifactsQuery.loading}
        >
          {appCopy.ui.actions.nextPage}
        </button>
      </div>
    </section>
  );
};
