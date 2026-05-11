import type { ReactNode } from 'react';
import {
  EmptyStateMessage,
  ErrorStateMessage,
  LoadingStateMessage,
  uiPrimitives,
} from './primitives';

type HeadingLevel = 'h2' | 'h3';

export type ListingTableColumn = {
  key: string;
  header: ReactNode;
};

type ListingTableSectionProps<Row> = {
  title: string;
  headingLevel?: HeadingLevel;
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  emptyMessage: ReactNode;
  columns: ListingTableColumn[];
  rows: Row[];
  rowKey: (row: Row) => string;
  renderCell: (row: Row, columnKey: string) => ReactNode;
  toolbarNode?: ReactNode;
  paginationNode?: ReactNode;
};

export const ListingTableSection = <Row,>({
  title,
  headingLevel = 'h3',
  loading,
  error,
  isEmpty,
  emptyMessage,
  columns,
  rows,
  rowKey,
  renderCell,
  toolbarNode,
  paginationNode,
}: ListingTableSectionProps<Row>) => {
  const HeadingTag = headingLevel;

  return (
    <section className={uiPrimitives.stack}>
      <HeadingTag>{title}</HeadingTag>

      {loading ? <LoadingStateMessage>Caricamento...</LoadingStateMessage> : null}
      {error ? <ErrorStateMessage>{error}</ErrorStateMessage> : null}

      {toolbarNode}

      {!loading && isEmpty ? (
        <EmptyStateMessage>{emptyMessage}</EmptyStateMessage>
      ) : (
        <div className={uiPrimitives.artifactTableWrap}>
          <table className={uiPrimitives.artifactTable}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} scope="col">{column.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((column) => (
                    <td key={column.key}>{renderCell(row, column.key)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paginationNode}
    </section>
  );
};