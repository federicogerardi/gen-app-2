import { useState } from 'react';
import { appCopy } from '../../../app/copy/system';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { uiPrimitives } from '../../../app/ui/primitives';
import { ReportsTable } from '../reports/ReportsTable';
import { useAdminUserReportsQuery } from '../runtime/useAdminUserReportsQuery';
import { useAdminUserReportsMutations } from '../runtime/useAdminUserReportsMutations';
import { useAdminUserReportsFilters } from '../runtime/useAdminUserReportsFilters';
import { AdminUserReportsToolbar } from '../ui/AdminUserReportsToolbar';
import { AdminPageContainer } from '../ui/AdminPageContainer';

export const AdminUserReportsPage = () => {
  const auth = useAuthSession();

  const { statusFilter, categoryFilter, setStatusFilter, setCategoryFilter } = useAdminUserReportsFilters();
  const reportsQuery = useAdminUserReportsQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    statusFilter,
    categoryFilter,
  });

  const { busyAction, publishedIssueUrls, handleStatusTransition, handlePublishIssue } = useAdminUserReportsMutations({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
    reloadReports: reportsQuery.reload,
  });

  return (
    <AdminPageContainer
      title={appCopy.editorial.admin.userReportsTitle}
      description="Data Table View canonica per triage UserReport e IssuePublicationPolicy."
    >

      <AdminUserReportsToolbar
        statusFilter={statusFilter}
        categoryFilter={categoryFilter}
        loading={reportsQuery.loading}
        busyAction={busyAction}
        onStatusFilterChange={setStatusFilter}
        onCategoryFilterChange={setCategoryFilter}
        onReload={reportsQuery.reload}
      />

      <ReportsTable
        rows={reportsQuery.data}
        loading={reportsQuery.loading}
        error={reportsQuery.error}
        busyAction={busyAction}
        publishedIssueUrls={publishedIssueUrls}
        onStatusTransition={(reportId, status) => { void handleStatusTransition(reportId, status); }}
        onPublishIssue={(reportId) => { void handlePublishIssue(reportId); }}
      />
    </AdminPageContainer>
  );
};
