import type { JSX } from 'react';
import { Button as MuiButton, Chip } from '@mui/material';
import { appCopy } from '../../../app/copy/system';
import { StatusBadge } from '../../../app/ui/StatusBadge';
import { ListingTableSection, type ListingTableColumn } from '../../../app/ui/ListingTableSection';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useAdminToolWorkflowJobsQuery, type AdminToolWorkflowJob } from '../runtime/useAdminToolWorkflowJobsQuery';
import { AdminToolWorkflowJobsToolbar } from '../ui/AdminToolWorkflowJobsToolbar';
import { AdminPageContainer } from '../ui/AdminPageContainer';

const adminCopy = appCopy.ui.toolWorkflowJob.admin;

const COLUMNS: ListingTableColumn[] = [
  { key: 'jobId', header: adminCopy.tableJobId },
  { key: 'status', header: adminCopy.tableStatus },
  { key: 'toolKey', header: adminCopy.tableTool },
  { key: 'progress', header: adminCopy.tableProgress },
  { key: 'user', header: adminCopy.tableUser },
  { key: 'created', header: adminCopy.tableCreated },
  { key: 'actions', header: '' },
];

const COST_COLUMNS: ListingTableColumn[] = [
  { key: 'model', header: 'Model' },
  { key: 'costUsd', header: 'Cost' },
  { key: 'tokens', header: 'Tokens' },
];

const formatCost = (costUsd: number): string => {
  if (costUsd === 0) return '—';
  return `$${costUsd.toFixed(3)}`;
};

const formatTokens = (inputTokens: number, outputTokens: number): string => {
  if (inputTokens === 0 && outputTokens === 0) return '—';
  const formatNum = (n: number) => n.toLocaleString('en-US');
  return `${formatNum(inputTokens)} / ${formatNum(outputTokens)}`;
};

const renderCell = (row: AdminToolWorkflowJob, columnKey: string): React.ReactNode => {
  switch (columnKey) {
    case 'jobId':
      return <code>{row.jobId.slice(0, 8)}</code>;
    case 'status':
      return <StatusBadge status={row.status} />;
    case 'toolKey':
      return row.toolKey;
    case 'progress':
      if (row.status === 'queued') return '—';
      return `${row.completedSteps}/${row.totalSteps}`;
    case 'user':
      return row.userId.slice(0, 8);
    case 'created':
      return new Date(row.createdAt).toLocaleString();
    case 'model':
      return row.model ?? '—';
    case 'costUsd':
      return formatCost(row.costUsd);
    case 'tokens':
      return formatTokens(row.inputTokens, row.outputTokens);
    case 'actions':
      return (
        <Chip
          label={adminCopy.actionInspect}
          size="small"
          variant="outlined"
          component="a"
          href={`/artifacts?sessionId=${row.jobId}`}
          clickable
        />
      );
    default:
      return null;
  }
};

export const AdminToolWorkflowJobsPage = (): JSX.Element => {
  const { apiBaseUrl, capabilities } = useApiConfig();
  const jobsQuery = useAdminToolWorkflowJobsQuery({ apiBaseUrl, capabilities });
  const showCosts = false; // TODO: toggle behind toolbar button

  const allColumns = showCosts
    ? [...COLUMNS.slice(0, 4), ...COST_COLUMNS, ...COLUMNS.slice(4)]
    : COLUMNS;

  const totalPages = Math.ceil(jobsQuery.data.total / jobsQuery.data.limit);

  return (
    <AdminPageContainer
      title={adminCopy.pageTitle}
      description={adminCopy.toolbarDescription}
    >
      <ListingTableSection
        title={adminCopy.pageTitle}
        loading={jobsQuery.loading}
        error={jobsQuery.error}
        isEmpty={jobsQuery.data.jobs.length === 0}
        emptyMessage={adminCopy.emptyList}
        columns={allColumns}
        rows={jobsQuery.data.jobs}
        rowKey={(row) => row.jobId}
        renderCell={renderCell}
        toolbarNode={
          <AdminToolWorkflowJobsToolbar
            isLoading={jobsQuery.loading}
            onReload={jobsQuery.reload}
            filters={jobsQuery.filters}
            onStatusChange={jobsQuery.setStatusFilter}
            onToolKeyChange={jobsQuery.setToolKeyFilter}
          />
        }
        paginationNode={
          totalPages > 1 ? (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '16px 0' }}>
              <MuiButton
                size="small"
                disabled={jobsQuery.page === 0}
                onClick={() => jobsQuery.setPage(jobsQuery.page - 1)}
              >
                Previous
              </MuiButton>
              <span style={{ alignSelf: 'center', fontSize: '0.875rem' }}>
                Page {jobsQuery.page + 1} of {totalPages}
              </span>
              <MuiButton
                size="small"
                disabled={jobsQuery.page >= totalPages - 1}
                onClick={() => jobsQuery.setPage(jobsQuery.page + 1)}
              >
                Next
              </MuiButton>
            </div>
          ) : null
        }
      />
    </AdminPageContainer>
  );
};
