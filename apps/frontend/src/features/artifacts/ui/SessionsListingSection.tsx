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
import { useSessionsQuery } from '../../../app/runtime/queries/useSessionsQuery';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import type { SessionSummary } from '../../tools/runtime/session-client';

const pageSize = 10;

type SessionsListingSectionProps = {
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

const statusLabel = (status: SessionSummary['status']): string => {
  if (status === 'generating') return 'In corso';
  if (status === 'failed') return 'Con errore';
  return 'Completata';
};

const toolLabel = (toolKey: string | null): string => {
  if (!toolKey) return '—';
  if (toolKey === 'funnel-pages') return 'Funnel Pages';
  if (toolKey === 'nextland') return 'Nextland';
  if (toolKey === 'youtube-lf-script') return 'YouTube LF Script';
  return toolKey;
};

export const SessionsListingSection = ({
  title,
  emptyStateMessage,
  fixedProjectId,
  fixedProjectName,
  enabled,
  headingLevel = 'h3',
}: SessionsListingSectionProps) => {
  const auth = useAuthSession();
  const normalizedFixedProjectId = useMemo(() => normalizeFixedProjectId(fixedProjectId), [fixedProjectId]);

  const projectsQuery = useProjectsQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    ...(enabled !== undefined ? { enabled } : {}),
  });

  const sessionsQuery = useSessionsQuery({
    ...(normalizedFixedProjectId ? { projectId: normalizedFixedProjectId } : {}),
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    ...(enabled !== undefined ? { enabled } : {}),
  });

  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [normalizedFixedProjectId]);

  const projectNameById = useMemo(() => {
    return projectsQuery.data.reduce<Record<string, string>>((acc, project) => {
      acc[project.id] = project.name;
      return acc;
    }, {});
  }, [projectsQuery.data]);

  const allItems = sessionsQuery.data;
  const totalPages = Math.max(1, Math.ceil(allItems.length / pageSize));
  const items = useMemo(
    () => allItems.slice((page - 1) * pageSize, page * pageSize),
    [allItems, page],
  );
  const hasPreviousPage = page > 1;
  const hasNextPage = page < totalPages;
  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, i) => i + 1),
    [totalPages],
  );

  const HeadingTag = headingLevel;

  return (
    <section className={uiPrimitives.stack}>
      <HeadingTag>{title}</HeadingTag>

      {sessionsQuery.loading ? (
        <LoadingStateMessage>{appCopy.editorial.sessions.loadingState}</LoadingStateMessage>
      ) : null}
      {sessionsQuery.error ? <ErrorStateMessage>{sessionsQuery.error}</ErrorStateMessage> : null}

      {!sessionsQuery.loading && items.length === 0 ? (
        <EmptyStateMessage>
          {emptyStateMessage ?? appCopy.editorial.sessions.emptyState}
        </EmptyStateMessage>
      ) : (
        <div className={uiPrimitives.artifactTableWrap}>
          <table className={uiPrimitives.artifactTable}>
            <thead>
              <tr>
                <th scope="col">Tool</th>
                <th scope="col">{appCopy.ui.labels.status}</th>
                <th scope="col">{appCopy.ui.labels.project}</th>
                <th scope="col">Output</th>
                <th scope="col">{appCopy.ui.meta.updated}</th>
                <th scope="col">{appCopy.ui.actions.openDetail}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((session) => {
                const resolvedProjectName =
                  (normalizedFixedProjectId !== null && session.projectId === normalizedFixedProjectId
                    ? fixedProjectName
                    : null)
                  ?? projectNameById[session.projectId]
                  ?? 'Progetto non disponibile';

                return (
                  <tr key={session.sessionId}>
                    <td><strong>{toolLabel(session.toolKey)}</strong></td>
                    <td>{statusLabel(session.status)}</td>
                    <td>{resolvedProjectName}</td>
                    <td>
                      {session.artifactCount}{' '}
                      {appCopy.editorial.sessions.artifactCountLabel}
                    </td>
                    <td>{new Date(session.updatedAt).toLocaleString()}</td>
                    <td>
                      <Link
                        to={`/artifacts/${session.sessionId}`}
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

      {totalPages > 1 ? (
        <div className={cx(uiPrimitives.clusterRow, uiPrimitives.artifactTablePagination)}>
          <button
            type="button"
            className={uiPrimitives.paginationControl}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!hasPreviousPage}
          >
            {appCopy.ui.actions.previousPage}
          </button>
          <div className={uiPrimitives.clusterRow}>
            {pageNumbers.map((n) => (
              <button
                key={n}
                type="button"
                className={cx(
                  uiPrimitives.paginationControl,
                  uiPrimitives.paginationPage,
                  n === page ? uiPrimitives.paginationPageActive : null,
                )}
                onClick={() => setPage(n)}
                aria-current={n === page ? 'page' : undefined}
                aria-label={`${appCopy.ui.labels.page} ${n}`}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={uiPrimitives.paginationControl}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={!hasNextPage}
          >
            {appCopy.ui.actions.nextPage}
          </button>
        </div>
      ) : null}
    </section>
  );
};
