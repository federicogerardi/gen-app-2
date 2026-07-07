import { appCopy } from '../../../app/copy/system';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { ReportsTable } from '../reports/ReportsTable';
import { useAdminUserReportsQuery } from '../runtime/useAdminUserReportsQuery';
import { useAdminUserReportsMutations } from '../runtime/useAdminUserReportsMutations';
import { useAdminUserReportsFilters } from '../runtime/useAdminUserReportsFilters';
import { AdminUserReportsToolbar } from '../ui/AdminUserReportsToolbar';
import { AdminPageContainer } from '../ui/AdminPageContainer';

export const AdminUserReportsPage = () => {
  const { apiBaseUrl, capabilities } = useApiConfig();

  const { statusFilter, categoryFilter, setStatusFilter, setCategoryFilter } = useAdminUserReportsFilters();
  const reportsQuery = useAdminUserReportsQuery({
    apiBaseUrl,
    capabilities,
    statusFilter,
    categoryFilter,
  });

  const { busyAction, publishedIssueUrls, handleStatusTransition, handlePublishIssue } = useAdminUserReportsMutations({
    apiBaseUrl,
    capabilities,
    reloadReports: reportsQuery.reload,
  });

  return (
    <AdminPageContainer
      title={appCopy.editorial.admin.userReportsTitle}
      description={appCopy.ui.adminUserReports.pageDescription}
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
