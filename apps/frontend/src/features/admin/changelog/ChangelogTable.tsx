import { cx, uiPrimitives } from '../../../app/ui/primitives';
import { ListingTableSection } from '../../../app/ui/ListingTableSection';
import type { ProductChangelogDto } from '../../feedback-center/contracts/feedback-center-contract';

const CHANGELOG_COLUMNS = [
  { key: 'title', header: 'Titolo' },
  { key: 'status', header: 'Stato' },
  { key: 'publishedAt', header: 'Pubblicato il' },
  { key: 'updatedAt', header: 'Aggiornato il' },
  { key: 'actions', header: 'Azioni' },
] as const;

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

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
          return formatDateTime(row.publishedAt);
        }

        if (columnKey === 'updatedAt') {
          return formatDateTime(row.updatedAt);
        }

        return (
          <div className={cx(uiPrimitives.clusterRow, 'ui-admin-user-table-actions')}>
            <button
              type="button"
              className={cx(uiPrimitives.inlineLink, uiPrimitives.artifactTableActionLink)}
              onClick={() => onArchive(row.id)}
              disabled={busyAction !== null || row.status !== 'published'}
            >
              Archivia
            </button>
          </div>
        );
      }}
    />
  );
};