import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { appCopy } from '../../../app/copy/system';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import {
  cx,
  uiPrimitives,
} from '../../../app/ui/primitives';
import { StatusBadge } from '../../../app/ui/StatusBadge';
import { ListingTableSection, type ListingTableColumn } from '../../../app/ui/ListingTableSection';
import { PaginationBlockControls } from '../../../app/ui/PaginationBlockControls';
import { useSessionsQuery } from '../../../app/runtime/queries/useSessionsQuery';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import { getToolLabel } from '../../tools/runtime/tool-form-architecture';
import { UI_CONFIG } from '../../../app/config/ui-config';

const pageSize = UI_CONFIG.pagination.sessionsPageSize;

type SessionLike = {
  sessionId: string;
  projectId: string;
  projectName?: string | null;
  toolKey: string | null;
  status: 'generating' | 'completed' | 'failed';
  artifactCount: number;
  updatedAt: string;
  userId?: string | null;
  userEmail?: string | null;
};

type SessionsListingSectionProps = {
  title: string;
  emptyStateMessage?: string;
  fixedProjectId?: string;
  fixedProjectName?: string;
  enabled?: boolean;
  headingLevel?: 'h2' | 'h3';
  sessions?: SessionLike[];
  loading?: boolean;
  error?: string | null;
  showUserColumn?: boolean;
  projectColumnLabel?: string;
  buildDetailPath?: (session: SessionLike) => string;
};

const normalizeFixedProjectId = (projectId: string | undefined): string | null => {
  if (typeof projectId !== 'string') {
    return null;
  }

  const trimmed = projectId.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const SessionsListingSection = ({
  title,
  emptyStateMessage,
  fixedProjectId,
  fixedProjectName,
  enabled,
  headingLevel = 'h3',
  sessions: externalSessions,
  loading: externalLoading,
  error: externalError,
  showUserColumn = false,
  projectColumnLabel,
  buildDetailPath,
}: SessionsListingSectionProps) => {
  const { apiBaseUrl, capabilities } = useApiConfig();
  const normalizedFixedProjectId = useMemo(() => normalizeFixedProjectId(fixedProjectId), [fixedProjectId]);

  const useExternalData = externalSessions !== undefined;

  // Skip projects query when fixedProjectName is already provided for all items
  const projectsQueryEnabled = fixedProjectName === undefined
    ? (enabled !== undefined ? enabled : undefined)
    : false;

  const projectsQuery = useProjectsQuery({
    apiBaseUrl,
    capabilities,
    ...(projectsQueryEnabled !== undefined ? { enabled: projectsQueryEnabled } : {}),
  });

  const internalSessionsQuery = useSessionsQuery({
    ...(normalizedFixedProjectId ? { projectId: normalizedFixedProjectId } : {}),
    apiBaseUrl,
    capabilities,
    ...(enabled !== undefined ? { enabled } : {}),
  });

  const allItems = useExternalData ? externalSessions : internalSessionsQuery.data;
  const isLoading = useExternalData ? (externalLoading ?? false) : internalSessionsQuery.loading;
  const loadError = useExternalData ? (externalError ?? null) : internalSessionsQuery.error;

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

  const totalPages = Math.max(1, Math.ceil(allItems.length / pageSize));
  const items = useMemo(
    () => allItems.slice((page - 1) * pageSize, page * pageSize),
    [allItems, page],
  );
  const columns = useMemo<ListingTableColumn[]>(() => {
    const cols: ListingTableColumn[] = [
      { key: 'tool', header: appCopy.ui.labels.tool },
      { key: 'status', header: appCopy.ui.labels.status },
      { key: 'project', header: projectColumnLabel ?? appCopy.ui.labels.project },
    ];
    if (showUserColumn) {
      cols.push({ key: 'user', header: appCopy.ui.labels.user });
    }
    cols.push(
      { key: 'output', header: appCopy.ui.labels.output },
      { key: 'updated', header: appCopy.ui.meta.updated },
      { key: 'openDetail', header: appCopy.ui.actions.openDetail },
    );
    return cols;
  }, [showUserColumn]);

  return (
    <ListingTableSection
      title={title}
      headingLevel={headingLevel}
      loading={isLoading}
      error={loadError}
      isEmpty={items.length === 0}
      emptyMessage={emptyStateMessage ?? appCopy.editorial.sessions.emptyState}
      columns={columns}
      rows={items}
      rowKey={(session) => session.sessionId}
      renderCell={(session, columnKey) => {
        const resolvedProjectName =
          (session as SessionLike).projectName
          ?? ((normalizedFixedProjectId !== null && session.projectId === normalizedFixedProjectId
            ? fixedProjectName
            : null)
          ?? projectNameById[session.projectId]
          ?? appCopy.ui.states.projectUnavailable);

        if (columnKey === 'tool') return <strong>{getToolLabel(session.toolKey)}</strong>;
        if (columnKey === 'status') return <StatusBadge status={session.status} />;
        if (columnKey === 'project') return resolvedProjectName;
        if (columnKey === 'user') return (session as SessionLike).userEmail ?? appCopy.ui.states.userUnavailable;
        if (columnKey === 'output') return `${session.artifactCount} ${appCopy.editorial.sessions.artifactCountLabel}`;
        if (columnKey === 'updated') return new Date(session.updatedAt).toLocaleString();

        const detailPath = buildDetailPath
          ? buildDetailPath(session)
          : `/workspaces/${session.projectId}/sessions/${session.sessionId}`;

        return (
          <Link
            to={detailPath}
            className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
          >
            {appCopy.ui.actions.openDetail}
          </Link>
        );
      }}
      paginationNode={totalPages > 1
        ? (
          <PaginationBlockControls
            page={page}
            totalPages={totalPages}
            isLoading={isLoading}
            onPageChange={setPage}
          />
        )
        : null}
    />
  );
};
