import { cx, uiPrimitives } from '../../../app/ui/primitives';
import { ListingTableSection } from '../../../app/ui/ListingTableSection';
import type {
  UserReportDto,
  UserReportStatus,
} from '../../feedback-center/contracts/feedback-center-contract';

const USER_REPORT_COLUMNS = [
  { key: 'title', header: 'Segnalazione' },
  { key: 'category', header: 'Categoria' },
  { key: 'status', header: 'Stato' },
  { key: 'createdAt', header: 'Creata il' },
  { key: 'actions', header: 'Azioni' },
] as const;

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

type ReportsTableProps = {
  rows: UserReportDto[];
  loading: boolean;
  error: string | null;
  busyAction: string | null;
  onStatusTransition: (reportId: string, status: Extract<UserReportStatus, 'triaged' | 'closed'>) => void;
  onPublishIssue: (reportId: string) => void;
};

export const ReportsTable = ({ rows, loading, error, busyAction, onStatusTransition, onPublishIssue }: ReportsTableProps) => {
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
              onClick={() => onStatusTransition(row.id, 'triaged')}
              disabled={busyAction !== null || row.status !== 'submitted'}
            >
              Triage
            </button>

            <button
              type="button"
              className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
              onClick={() => onStatusTransition(row.id, 'closed')}
              disabled={busyAction !== null || row.status === 'closed'}
            >
              Chiudi
            </button>

            <button
              type="button"
              className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
              onClick={() => onPublishIssue(row.id)}
              disabled={busyAction !== null || !canPublishIssue(row)}
            >
              Pubblica issue
            </button>
          </div>
        );
      }}
    />
  );
};