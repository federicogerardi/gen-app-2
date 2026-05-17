import { ListingTableSection } from '../../../app/ui/ListingTableSection';
import { uiPrimitives } from '../../../app/ui/primitives';
import type { ProductChangelogDto } from '../../feedback-center/contracts/feedback-center-contract';
import { AdminChangelogTableRow } from '../ui/AdminChangelogTableRow';
import { formatAdminDateTime } from '../runtime/admin-date-format';

const CHANGELOG_COLUMNS = [
  { key: 'title', header: 'Titolo' },
  { key: 'status', header: 'Stato' },
  { key: 'publishedAt', header: 'Pubblicato il' },
  { key: 'updatedAt', header: 'Aggiornato il' },
  { key: 'actions', header: 'Azioni' },
] as const;

type ChangelogTableProps = {
  rows: ProductChangelogDto[];
  loading: boolean;
  error: string | null;
  busyAction: string | null;
  onArchive: (changelogId: string) => void;
};

export const ChangelogTable = ({ rows, loading, error, busyAction, onArchive }: ChangelogTableProps) => {
  return (
    <ListingTableSection<ProductChangelogDto>
      title="Voci pubblicate"
      loading={loading}
      error={error}
      isEmpty={!loading && rows.length === 0}
      emptyMessage="Nessuna voce pubblicata al momento."
      columns={[...CHANGELOG_COLUMNS]}
      rows={rows}
      rowKey={(row) => row.id}
      renderCell={(row, columnKey) => {
        if (columnKey === 'title') {
          return (
            <>
              <strong>{row.title}</strong>
              <p className={uiPrimitives.metaLine}>{row.id}</p>
            </>
          );
        }

        if (columnKey === 'status') {
          return row.status;
        }

        if (columnKey === 'publishedAt') {
          return formatAdminDateTime(row.publishedAt);
        }

        if (columnKey === 'updatedAt') {
          return formatAdminDateTime(row.updatedAt);
        }

        if (columnKey === 'actions') {
          return <AdminChangelogTableRow row={row} busyAction={busyAction} onArchive={onArchive} />;
        }

        return null;
      }}
    />
  );
};