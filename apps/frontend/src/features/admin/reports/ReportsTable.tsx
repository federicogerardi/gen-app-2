import { cx, uiPrimitives } from '../../../app/ui/primitives';
import { StatusBadge } from '../../../app/ui/StatusBadge';
import { ListingTableSection } from '../../../app/ui/ListingTableSection';
import type {
  UserReportDto,
  UserReportStatus,
} from '../../feedback-center/contracts/feedback-center-contract';
import { formatAdminDateTime } from '../runtime/admin-date-format';
import { AdminUserReportsTableActions } from '../ui/AdminUserReportsTableActions';

const USER_REPORT_COLUMNS = [
  { key: 'title', header: 'Segnalazione' },
  { key: 'category', header: 'Categoria' },
  { key: 'status', header: 'Stato' },
  { key: 'createdAt', header: 'Creata il' },
  { key: 'actions', header: 'Azioni' },
] as const;

type ReportsTableProps = {
  rows: UserReportDto[];
  loading: boolean;
  error: string | null;
  busyAction: string | null;
  publishedIssueUrls: Map<string, string>;
  onStatusTransition: (reportId: string, status: Extract<UserReportStatus, 'triaged' | 'closed'>) => void;
  onPublishIssue: (reportId: string) => void;
};

export const ReportsTable = ({ rows, loading, error, busyAction, publishedIssueUrls, onStatusTransition, onPublishIssue }: ReportsTableProps) => {
  return (
    <ListingTableSection<UserReportDto>
      title="Inbox segnalazioni"
      loading={loading}
      error={error}
      isEmpty={!loading && rows.length === 0}
      emptyMessage="Nessuna segnalazione trovata con i filtri selezionati."
      columns={[...USER_REPORT_COLUMNS]}
      rows={rows}
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
          return <StatusBadge status={row.status} />;
        }

        if (columnKey === 'createdAt') {
          return formatAdminDateTime(row.createdAt);
        }

        return (
          <AdminUserReportsTableActions
            row={row}
            busyAction={busyAction}
            publishedIssueUrl={publishedIssueUrls.get(row.id)}
            onStatusTransition={onStatusTransition}
            onPublishIssue={onPublishIssue}
          />
        );
      }}
    />
  );
};