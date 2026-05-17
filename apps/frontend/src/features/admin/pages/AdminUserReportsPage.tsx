import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { MenuItem, TextField } from '@mui/material';
import { appCopy } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { useFeedbackMessage } from '../../../app/providers/FeedbackMessageProvider';
import { useAsyncQuery } from '../../../app/runtime/queries/useAsyncQuery';
import {
  cx,
  uiPrimitives,
} from '../../../app/ui/primitives';
import type {
  UserReportCategory,
  UserReportStatus,
} from '../../feedback-center/contracts/feedback-center-contract';
import {
  listAdminUserReports,
  publishUserReportIssue,
  updateUserReportStatus,
} from '../../feedback-center/runtime/feedback-center-client';
import { ReportsTable } from '../reports/ReportsTable';
import { AdminPageContainer } from '../ui/AdminPageContainer';

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

export const AdminUserReportsPage = () => {
  const auth = useAuthSession();
  const { publishSuccess, publishError } = useFeedbackMessage();

  const [statusFilter, setStatusFilter] = useState<UserReportStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<UserReportCategory | 'all'>('all');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const filtersDependency = JSON.stringify([statusFilter, categoryFilter]);

  const listUserReportsQuery = useCallback(async () => {
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

  const reportsQuery = useAsyncQuery({
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
    <AdminPageContainer
      title={appCopy.editorial.admin.userReportsTitle}
      description="Data Table View canonica per triage UserReport e IssuePublicationPolicy."
    >

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

      <ReportsTable
        rows={reportsQuery.data}
        loading={reportsQuery.loading}
        error={reportsQuery.error}
        busyAction={busyAction}
        onStatusTransition={(reportId, status) => { void handleStatusTransition(reportId, status); }}
        onPublishIssue={(reportId) => { void handlePublishIssue(reportId); }}
      />
    </AdminPageContainer>
  );
};
