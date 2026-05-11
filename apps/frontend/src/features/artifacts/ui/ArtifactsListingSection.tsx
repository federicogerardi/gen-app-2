import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import {
  cx,
  EmptyStateMessage,
  ErrorStateMessage,
  LoadingStateMessage,
  uiPrimitives,
} from '../../../app/ui/primitives';
import { PaginationBlockControls } from '../../../app/ui/PaginationBlockControls';
import { useArtifactsQuery } from '../../../app/runtime/queries/useArtifactsQuery';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { type ArtifactQuery } from '../runtime/artifacts-client';

const pageSize = 10;
const queryPageSize = pageSize + 1;

type ArtifactsListingSectionProps = {
  title: string;
  emptyStateMessage?: string;
  fixedProjectId?: string;
  fixedProjectName?: string;
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
  fixedProjectName,
  enabled,
  headingLevel = 'h3',
}: ArtifactsListingSectionProps) => {
  const auth = useAuthSession();
  const generation = useGenerationWorkspace();
  const projectsQuery = useProjectsQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    ...(enabled !== undefined ? { enabled } : {}),
  });
  const normalizedFixedProjectId = useMemo(() => normalizeFixedProjectId(fixedProjectId), [fixedProjectId]);
  const normalizedFixedProjectName = useMemo(() => {
    if (typeof fixedProjectName !== 'string') {
      return null;
    }

    const trimmed = fixedProjectName.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [fixedProjectName]);
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
      limit: queryPageSize,
      offset: (page - 1) * pageSize,
    },
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    localArtifacts: generation.artifacts,
    ...(enabled !== undefined ? { enabled } : {}),
  });

  const items = useMemo(
    () => artifactsQuery.data.slice(0, pageSize),
    [artifactsQuery.data],
  );
  const projectNameById = useMemo(() => {
    return projectsQuery.data.reduce<Record<string, string>>((acc, project) => {
      acc[project.id] = project.name;
      return acc;
    }, {});
  }, [projectsQuery.data]);
  const totalPages = useMemo(() => {
    return artifactsQuery.totalResults === 0 ? 0 : Math.ceil(artifactsQuery.totalResults / pageSize);
  }, [artifactsQuery.totalResults]);

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
        <div className={uiPrimitives.artifactTableWrap}>
          <table className={uiPrimitives.artifactTable}>
            <thead>
              <tr>
                <th scope="col">{appCopy.ui.labels.type}</th>
                <th scope="col">{appCopy.ui.labels.status}</th>
                <th scope="col">{appCopy.ui.labels.project}</th>
                <th scope="col">{appCopy.ui.meta.updated}</th>
                <th scope="col">{appCopy.ui.actions.openDetail}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((artifact) => {
                const resolvedProjectName =
                  (normalizedFixedProjectId !== null && artifact.projectId === normalizedFixedProjectId
                    ? normalizedFixedProjectName
                    : null)
                  ?? projectNameById[artifact.projectId]
                  ?? 'Progetto non disponibile';

                return (
                  <tr key={artifact.artifactId}>
                    <td><strong>{artifact.artifactType}</strong></td>
                    <td>{artifact.status}</td>
                    <td>{resolvedProjectName}</td>
                    <td>{new Date(artifact.updatedAt).toLocaleString()}</td>
                    <td>
                      <Link
                        to={`/artifacts/${artifact.artifactId}`}
                        className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
                      >
                        {appCopy.ui.actions.openDetail}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PaginationBlockControls
        page={page}
        totalPages={totalPages}
        isLoading={artifactsQuery.loading}
        onPageChange={setPage}
      />
    </section>
  );
};
