import { appCopy } from '../../../app/copy/system';
import { useState, useMemo } from 'react';
import { Camera, Eye } from 'lucide-react';
import {
  Button,
  Surface,
  cx,
  uiPrimitives,
} from '../../../app/ui/primitives';
import { ListingTableSection, type ListingTableColumn } from '../../../app/ui/ListingTableSection';
import { PaginationBlockControls } from '../../../app/ui/PaginationBlockControls';
import { useAuthSession } from '../../../app/providers/AuthSessionProvider';
import { AdminPageContainer } from '../ui/AdminPageContainer';
import { useAdminGeometricScreenshotsQuery } from '../runtime/useAdminGeometricScreenshotsQuery';
import type { GeometricScreenshotMetadata } from '../runtime/admin-client';
import { formatAdminDateTime } from '../runtime/admin-date-format';
import { UI_CONFIG } from '../../../app/config/ui-config';

const pageSize = UI_CONFIG.pagination.geometricScreenshotsPageSize;

const ConfidenceBadge = ({ confidence }: { confidence: number | null }) => {
  if (confidence === null) {
    return <span className="ui-confidence-badge">{appCopy.ui.adminGeometricScreenshots.confidenceNa}</span>;
  }

  const percentage = (confidence * 100).toFixed(0);
  return (
    <span
      className={cx(
        'ui-confidence-badge',
        confidence >= 0.9 && 'ui-confidence-badge--high',
        confidence >= 0.7 && confidence < 0.9 && 'ui-confidence-badge--medium',
        confidence < 0.7 && 'ui-confidence-badge--low',
      )}
    >
      {percentage}%
    </span>
  );
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const AdminGeometricScreenshotsPage = () => {
  const auth = useAuthSession();
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const screenshotsQuery = useAdminGeometricScreenshotsQuery({
    apiBaseUrl: auth.apiBaseUrl,
    capabilities: auth.capabilities,
  });

  const allScreenshots = useMemo(() => {
    return [...screenshotsQuery.data].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [screenshotsQuery.data]);

  const totalPages = useMemo(() => {
    return allScreenshots.length === 0 ? 0 : Math.ceil(allScreenshots.length / pageSize);
  }, [allScreenshots.length]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return allScreenshots.slice(start, start + pageSize);
  }, [allScreenshots, page]);

  const isLoading = screenshotsQuery.loading;
  const error = screenshotsQuery.error;

  const columns = useMemo<ListingTableColumn[]>(() => [
    { key: 'query', header: appCopy.ui.adminGeometricScreenshots.tableHeaders.query },
    { key: 'type', header: appCopy.ui.adminGeometricScreenshots.tableHeaders.type },
    { key: 'confidence', header: appCopy.ui.adminGeometricScreenshots.tableHeaders.confidence },
    { key: 'size', header: appCopy.ui.adminGeometricScreenshots.tableHeaders.size },
    { key: 'createdAt', header: appCopy.ui.adminGeometricScreenshots.tableHeaders.createdAt },
    { key: 'actions', header: appCopy.ui.adminGeometricScreenshots.tableHeaders.actions },
  ], []);

  return (
    <AdminPageContainer
      title={appCopy.ui.adminGeometricScreenshots.pageTitle}
      description={appCopy.ui.adminGeometricScreenshots.pageDescription}
    >
      <ListingTableSection<GeometricScreenshotMetadata>
        title={appCopy.ui.adminGeometricScreenshots.tableTitle}
        headingLevel="h3"
        loading={isLoading}
        error={error}
        isEmpty={!isLoading && allScreenshots.length === 0}
        emptyMessage={appCopy.ui.adminGeometricScreenshots.emptyList}
        columns={columns}
        rows={paginatedItems}
        rowKey={(screenshot) => screenshot.id}
        renderCell={(screenshot, columnKey) => {
          if (columnKey === 'query') {
            return (
              <>
                <strong>{screenshot.query}</strong>
                <p className={uiPrimitives.metaLine}>
                  Session: {screenshot.sessionId} | Request: {screenshot.requestId}
                </p>
              </>
            );
          }

          if (columnKey === 'type') {
            return screenshot.isPaa ? appCopy.ui.adminGeometricScreenshots.screenshotTypePaa : appCopy.ui.adminGeometricScreenshots.screenshotTypeSERP;
          }

          if (columnKey === 'confidence') {
            return (
              <>
                <ConfidenceBadge confidence={screenshot.aiOverviewConfidence} />
                {screenshot.selectorUsed ? (
                  <p className={uiPrimitives.metaLine}>{screenshot.selectorUsed}</p>
                ) : null}
              </>
            );
          }

          if (columnKey === 'size') {
            return formatFileSize(screenshot.fileSizeBytes);
          }

          if (columnKey === 'createdAt') {
            return formatAdminDateTime(screenshot.createdAt);
          }

          return (
            <div className="ui-admin-screenshot-actions">
              <Button
                onClick={() => setExpandedId(expandedId === screenshot.id ? null : screenshot.id)}
                aria-label={expandedId === screenshot.id ? appCopy.ui.adminGeometricScreenshots.hideScreenshotAria : appCopy.ui.adminGeometricScreenshots.viewScreenshotAria}
              >
                <Eye size={14} aria-hidden="true" />
                {expandedId === screenshot.id ? appCopy.ui.adminGeometricScreenshots.hideScreenshotAction : appCopy.ui.adminGeometricScreenshots.viewScreenshotAction}
              </Button>
            </div>
          );
        }}
        paginationNode={
          totalPages > 0 ? (
            <PaginationBlockControls
              page={page}
              totalPages={totalPages}
              isLoading={isLoading}
              onPageChange={setPage}
            />
          ) : null
        }
      />

      {expandedId && (
        <Surface className="ui-admin-screenshot-preview-panel">
          {(() => {
            const screenshot = allScreenshots.find((s) => s.id === expandedId);
            if (!screenshot) return null;
            return (
              <>
                <div className="ui-admin-screenshot-preview-panel__header">
                  <p className={uiPrimitives.metaLine}>
                    <Camera size={14} aria-hidden="true" /> {screenshot.query}
                  </p>
                  <Button onClick={() => setExpandedId(null)}>
                    {appCopy.ui.adminGeometricScreenshots.closePreviewButton}
                  </Button>
                </div>
                <img
                  src={`${auth.apiBaseUrl}/api/admin/geometric/screenshots/${screenshot.id}`}
                  alt={`${appCopy.ui.adminGeometricScreenshots.screenshotAltPrefix}${screenshot.query}${appCopy.ui.adminGeometricScreenshots.screenshotAltSuffix}`}
                  className="ui-admin-screenshot-image"
                  loading="eager"
                />
              </>
            );
          })()}
        </Surface>
      )}
    </AdminPageContainer>
  );
};
