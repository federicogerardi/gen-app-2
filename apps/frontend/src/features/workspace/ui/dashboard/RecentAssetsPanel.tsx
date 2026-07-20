import { useMemo } from 'react';
import { Skeleton } from '@mui/material';
import { Link } from 'react-router-dom';
import { useWorkspaceContext } from '../../runtime/useWorkspaceContext';
import { ASSET_TYPE_LABELS } from '../../runtime/toolAssetRegistry';
import { AssetTypeIcon } from '../AssetTypeIcon';
import { QualityScoreBadge } from '../QualityScoreBadge';
import { DashboardPanel } from './DashboardPanel';
import { formatRelativeTime } from '../../../../app/ui/format-utils';
import { appCopy } from '../../../../app/copy/system';
import type { AssetType } from '@gen-app-2/contracts';

interface RecentAssetsPanelProps {
  workspaceId: string;
}

const MAX_ITEMS = 5;

export const RecentAssetsPanel: React.FC<RecentAssetsPanelProps> = ({ workspaceId }) => {
  const ctx = useWorkspaceContext(workspaceId);

  const recentAssets = useMemo(() => {
    return [...ctx.assets]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, MAX_ITEMS);
  }, [ctx.assets]);

  const footer = (
    <Link
      to={`/workspaces/${workspaceId}/assets`}
      className="ui-inline-link"
    >
      {appCopy.ui.workspace.dashboard.viewAllAssetsArrow}
    </Link>
  );

  if (ctx.loading) {
    return (
      <DashboardPanel
        title={appCopy.ui.workspace.dashboard.recentAssetsTitle}
        loading
        footer={footer}
      >
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={52} sx={{ mb: 1 }} />
        ))}
      </DashboardPanel>
    );
  }

  if (ctx.error) {
    return (
      <DashboardPanel
        title={appCopy.ui.workspace.dashboard.recentAssetsTitle}
        error={ctx.error}
        footer={footer}
      />
    );
  }

  if (recentAssets.length === 0) {
    return (
      <DashboardPanel
        title={appCopy.ui.workspace.dashboard.recentAssetsTitle}
        empty={appCopy.ui.workspace.dashboard.recentAssetsEmpty}
        footer={footer}
      />
    );
  }

  return (
    <DashboardPanel
      title={appCopy.ui.workspace.dashboard.recentAssetsTitle}
      footer={footer}
    >
      {recentAssets.map(asset => {
        const typeLabel =
          ASSET_TYPE_LABELS[asset.assetType as AssetType] ?? asset.assetType;

        return (
          <div key={asset.id} className="dashboard-item-row">
            <span className="dashboard-item-row__primary">{asset.label}</span>
            <span className="dashboard-item-row__meta">
              <AssetTypeIcon
                size={14}
                type={asset.assetType}
              />
              {typeLabel}
              {' · '}
              {formatRelativeTime(asset.createdAt)}
            </span>
            <span className="dashboard-item-row__badge">
              <QualityScoreBadge score={asset.qualityScore} size="small" />
            </span>
          </div>
        );
      })}
    </DashboardPanel>
  );
};
