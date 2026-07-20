import { Link } from 'react-router-dom';
import { useWorkspaceContext } from '../../runtime/useWorkspaceContext';
import { QualityScoreBadge } from '../QualityScoreBadge';
import { AssetTypeIcon } from '../AssetTypeIcon';
import { LoadingStateMessage, EmptyStateMessage, ErrorStateMessage, uiPrimitives } from '../../../../app/ui/primitives';
import { appCopy } from '../../../../app/copy/system';

interface AssetLibraryQuickAccessProps {
  workspaceId: string;
}

export const AssetLibraryQuickAccess: React.FC<AssetLibraryQuickAccessProps> = ({ workspaceId }) => {
  const ctx = useWorkspaceContext(workspaceId);
  const copy = appCopy.ui.workspace.dashboard;

  if (ctx.loading) return <LoadingStateMessage>{copy.loadingAssets}</LoadingStateMessage>;
  if (ctx.error) return <ErrorStateMessage>{ctx.error}</ErrorStateMessage>;

  const recentAssets = ctx.assets.slice(0, 6);

  if (recentAssets.length === 0) {
    return (
      <div className="dashboard-panel">
        <div className="dashboard-panel__header">
          <span className="dashboard-panel__title">{copy.recentAssetsTitle}</span>
        </div>
        <div className="dashboard-panel__content">
          <EmptyStateMessage>{copy.recentAssetsEmpty}</EmptyStateMessage>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel__header">
        <span className="dashboard-panel__title">{copy.recentAssetsTitle}</span>
      </div>
      <div className="dashboard-panel__content">
        <div className="asset-quick-access__grid">
          {recentAssets.map(asset => (
            <div key={asset.id} className="asset-mini-card">
              <AssetTypeIcon type={asset.assetType} size={16} />
              <span className="asset-mini-card__label" title={asset.label}>{asset.label}</span>
              <QualityScoreBadge score={asset.qualityScore} size="small" />
            </div>
          ))}
        </div>
        <div className="asset-quick-access__footer">
          <Link to={`/workspaces/${workspaceId}/assets`} className={uiPrimitives.inlineLink}>
            {copy.viewAllAssetsArrow}
          </Link>
        </div>
      </div>
    </div>
  );
};
