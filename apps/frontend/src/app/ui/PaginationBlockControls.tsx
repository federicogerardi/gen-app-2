import { useMemo } from 'react';
import { appCopy } from '../copy/system';
import { cx, uiPrimitives } from './primitives';

type PaginationBlockControlsProps = {
  page: number;
  totalPages: number;
  isLoading?: boolean;
  maxVisiblePages?: number;
  onPageChange: (nextPage: number) => void;
};

export const PaginationBlockControls = ({
  page,
  totalPages,
  isLoading = false,
  maxVisiblePages = 10,
  onPageChange,
}: PaginationBlockControlsProps) => {
  const hasPreviousPage = page > 1;
  const hasNextPage = page < totalPages;
  const currentBlockIndex = useMemo(
    () => Math.floor((page - 1) / maxVisiblePages),
    [page, maxVisiblePages],
  );
  const visiblePageStart = useMemo(
    () => currentBlockIndex * maxVisiblePages + 1,
    [currentBlockIndex, maxVisiblePages],
  );
  const visiblePageEnd = useMemo(
    () => Math.min(totalPages, visiblePageStart + maxVisiblePages - 1),
    [totalPages, visiblePageStart, maxVisiblePages],
  );
  const hasPreviousBlock = visiblePageStart > 1;
  const hasNextBlock = visiblePageEnd < totalPages;
  const previousBlockDisabled = !hasPreviousBlock || isLoading;
  const nextBlockDisabled = !hasNextBlock || isLoading;
  const pageNumbers = useMemo(
    () => Array.from(
      { length: Math.max(0, visiblePageEnd - visiblePageStart + 1) },
      (_, index) => visiblePageStart + index,
    ),
    [visiblePageEnd, visiblePageStart],
  );

  return (
    <div className={cx(uiPrimitives.clusterRow, uiPrimitives.artifactTablePagination)}>
      <button
        type="button"
        className={uiPrimitives.paginationControl}
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={!hasPreviousPage || isLoading}
      >
        {appCopy.ui.actions.previousPage}
      </button>

      <div className={uiPrimitives.clusterRow}>
        <button
          type="button"
          className={uiPrimitives.paginationControl}
          onClick={() => {
            if (previousBlockDisabled) return;
            onPageChange(Math.max(1, visiblePageStart - maxVisiblePages));
          }}
          disabled={previousBlockDisabled}
          aria-disabled={previousBlockDisabled}
          aria-label="Mostra le 10 pagine precedenti"
          title="Mostra le 10 pagine precedenti"
        >
          -10
        </button>

        {pageNumbers.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            className={cx(
              uiPrimitives.paginationControl,
              uiPrimitives.paginationPage,
              pageNumber === page ? uiPrimitives.paginationPageActive : null,
            )}
            onClick={() => onPageChange(pageNumber)}
            disabled={isLoading}
            aria-current={pageNumber === page ? 'page' : undefined}
            aria-label={`${appCopy.ui.labels.page} ${pageNumber}`}
          >
            {pageNumber}
          </button>
        ))}

        <button
          type="button"
          className={uiPrimitives.paginationControl}
          onClick={() => {
            if (nextBlockDisabled) return;
            onPageChange(Math.min(totalPages, visiblePageEnd + 1));
          }}
          disabled={nextBlockDisabled}
          aria-disabled={nextBlockDisabled}
          aria-label="Mostra le 10 pagine successive"
          title="Mostra le 10 pagine successive"
        >
          +10
        </button>
      </div>

      <button
        type="button"
        className={uiPrimitives.paginationControl}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={!hasNextPage || isLoading}
      >
        {appCopy.ui.actions.nextPage}
      </button>
    </div>
  );
};