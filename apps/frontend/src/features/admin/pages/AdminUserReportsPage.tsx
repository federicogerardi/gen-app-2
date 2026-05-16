import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { MenuItem, TextField } from '@mui/material';
import { appCopy } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { useFeedbackMessage } from '../../../app/providers/FeedbackMessageProvider';
import { useAsyncQuery } from '../../../app/runtime/queries/useAsyncQuery';
import {
  cx,
  Surface,
  TopBar,
  uiPrimitives,
} from '../../../app/ui/primitives';
import { ListingTableSection, type ListingTableColumn } from '../../../app/ui/ListingTableSection';
import type {
  UserReportCategory,
  UserReportDto,
  UserReportStatus,
} from '../../feedback-center/contracts/feedback-center-contract';
import {
  listAdminUserReports,
  publishUserReportIssue,
  updateUserReportStatus,
} from '../../feedback-center/runtime/feedback-center-client';

const USER_REPORT_COLUMNS: ListingTableColumn[] = [
  { key: 'title', header: 'Segnalazione' },
  { key: 'category', header: 'Categoria' },
  { key: 'status', header: 'Stato' },
  { key: 'createdAt', header: 'Creata il' },
  { key: 'actions', header: 'Azioni' },
];

const USER_REPORT_STATUS_FILTER_OPTIONS: ReadonlyArray<{ value: UserReportStatus | 'all'; label: string }> = [
  { value: 'all', label: 'Tutti gli stati' },
  { value: 'submitted', label: 'submitted' },
  { value: 'triaged', label: 'triaged' },
  { value: 'github-published', label: 'github-published' },
  { value: 'closed', label: 'closed' },
];

const USER_REPORT_CATEGORY_FILTER_OPTIONS: ReadonlyArray<{ value: UserReportCategory | 'all'; label: string }> = [
  { value: 'all', label: 'Tutte le categorie' },
  { value: 'issue', label: 'issue' },
  { value: 'feature-request', label: 'feature-request' },
  { value: 'other', label: 'other' },
];

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

const canPublishIssue = (report: UserReportDto): boolean => {
  const categoryEligibleForGithubPublish = report.category === 'issue' || report.category === 'feature-request';
  return categoryEligibleForGithubPublish && (report.status === 'submitted' || report.status === 'triaged');
};

export const AdminUserReportsPage = () => {
  const auth = useAuthSession();
  const { publishSuccess, publishError } = useFeedbackMessage();

  const [statusFilter, setStatusFilter] = useState<UserReportStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<UserReportCategory | 'all'>('all');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const filtersDependency = JSON.stringify([statusFilter, categoryFilter]);

  const listUserReportsQuery = useCallback(async (): Promise<UserReportDto[]> => {
    const result = await listAdminUserReports(
      {
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
      },
      {
        apiBaseUrl: auth.apiBaseUrl,
        capabilities: auth.capabilities,
      },
    );

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    return result.data;
  }, [auth.apiBaseUrl, auth.capabilities, statusFilter, categoryFilter]);

  const reportsQuery = useAsyncQuery<UserReportDto[]>({
    enabled: true,
    emptyData: [],
    errorMessage: 'Unable to load admin user reports',
    dependencyKey: JSON.stringify([auth.apiBaseUrl, auth.capabilities, filtersDependency]),
    query: listUserReportsQuery,
  });

  const handleStatusTransition = async (
    reportId: string,
    status: Extract<UserReportStatus, 'triaged' | 'closed'>,
  ) => {
    setBusyAction(`${status}:${reportId}`);
    try {
      const result = await updateUserReportStatus(
        reportId,
        { status },
        {
          apiBaseUrl: auth.apiBaseUrl,
          capabilities: auth.capabilities,
        },
      );

      if (!result.ok) {
        publishError(result.error.message, { dedupeKey: `admin-user-reports:${status}:${reportId}:error` });
        return;
      }

      publishSuccess(`Report ${status} aggiornato.`, { dedupeKey: `admin-user-reports:${status}:${reportId}:success` });
      reportsQuery.reload();
    } catch {
      publishError('Aggiornamento stato report non riuscito.', {
        dedupeKey: `admin-user-reports:${status}:${reportId}:unexpected-error`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handlePublishIssue = async (reportId: string) => {
    setBusyAction(`publish-issue:${reportId}`);
    try {
      const result = await publishUserReportIssue(
        reportId,
        {
          owner: '',
          repo: '',
        },
        {
          apiBaseUrl: auth.apiBaseUrl,
          capabilities: auth.capabilities,
        },
      );

      if (!result.ok) {
        publishError(result.error.message, { dedupeKey: `admin-user-reports:publish-issue:${reportId}:error` });
        return;
      }

      publishSuccess('Issue GitHub pubblicata.', {
        dedupeKey: `admin-user-reports:publish-issue:${reportId}:success`,
      });
      reportsQuery.reload();
    } catch {
      publishError('Pubblicazione issue non riuscita.', {
        dedupeKey: `admin-user-reports:publish-issue:${reportId}:unexpected-error`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Surface as="section" className={uiPrimitives.stack}>
      <TopBar>
        <h2>{appCopy.editorial.admin.userReportsTitle}</h2>
        <p className={uiPrimitives.metaLine}>Data Table View canonica per triage UserReport e IssuePublicationPolicy.</p>
      </TopBar>

      <div className={cx(uiPrimitives.clusterRow, 'ui-admin-users-toolbar')}>
        <div className={uiPrimitives.actions}>
          <TextField
            select
            label="Filtro stato"
            size="small"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as UserReportStatus | 'all')}
            sx={{ minWidth: 210 }}
          >
            {USER_REPORT_STATUS_FILTER_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Filtro categoria"
            size="small"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as UserReportCategory | 'all')}
            sx={{ minWidth: 230 }}
          >
            {USER_REPORT_CATEGORY_FILTER_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
            ))}
          </TextField>

          <button
            type="button"
            className={uiPrimitives.button}
            onClick={() => reportsQuery.reload()}
            disabled={reportsQuery.loading || busyAction !== null}
          >
            Aggiorna tabella
          </button>

          <Link to="/admin/changelog" className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}>
            Changelog admin
          </Link>
        </div>
      </div>

      <ListingTableSection<UserReportDto>
        title="Inbox segnalazioni"
        loading={reportsQuery.loading}
        error={reportsQuery.error}
        isEmpty={!reportsQuery.loading && reportsQuery.data.length === 0}
        emptyMessage="Nessuna segnalazione trovata con i filtri selezionati."
        columns={USER_REPORT_COLUMNS}
        rows={reportsQuery.data}
        rowKey={(row) => row.id}
        renderCell={(row, columnKey) => {
          if (columnKey === 'title') {
            return (
              <>
                <strong>{row.title}</strong>
                <p className={uiPrimitives.metaLine}>{row.description}</p>
              </>
            );
          }

          if (columnKey === 'category') {
            return row.category;
          }

          if (columnKey === 'status') {
            return row.status;
          }

          if (columnKey === 'createdAt') {
            return formatDateTime(row.createdAt);
          }

          return (
            <div className={cx(uiPrimitives.clusterRow, 'ui-admin-user-table-actions')}>
              <button
                type="button"
                className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
                onClick={() => void handleStatusTransition(row.id, 'triaged')}
                disabled={busyAction !== null || row.status !== 'submitted'}
              >
                Triage
              </button>

              <button
                type="button"
                className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
                onClick={() => void handleStatusTransition(row.id, 'closed')}
                disabled={busyAction !== null || row.status === 'closed'}
              >
                Chiudi
              </button>

              <button
                type="button"
                className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
                onClick={() => void handlePublishIssue(row.id)}
                disabled={busyAction !== null || !canPublishIssue(row)}
              >
                Pubblica issue
              </button>
            </div>
          );
        }}
      />
    </Surface>
  );
};
