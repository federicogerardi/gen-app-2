import { Link } from 'react-router-dom';
import { useWorkspaceContext } from '../../runtime/useWorkspaceContext';
import { QualityScoreBadge } from '../QualityScoreBadge';
import { AssetTypeIcon } from '../AssetTypeIcon';
import { DashboardPanel } from './DashboardPanel';
import { uiPrimitives } from '../../../../app/ui/primitives';
import { appCopy } from '../../../../app/copy/system';

interface AssetLibraryQuickAccessProps {
  workspaceId: string;
}

export const AssetLibraryQuickAccess: React.FC<AssetLibraryQuickAccessProps> = ({ workspaceId }) => {
  const ctx = useWorkspaceContext(workspaceId);
  const copy = appCopy.ui.workspace.dashboard;

  const footer = (
    <Link to={`/workspaces/${workspaceId}/assets`} className={uiPrimitives.inlineLink}>
      {copy.viewAllAssetsArrow}
    </Link>
  );

  if (ctx.loading) {
    return (
      <DashboardPanel title={copy.recentAssetsTitle} loading footer={footer} />
    );
  }

  if (ctx.error) {
    return (
      <DashboardPanel title={copy.recentAssetsTitle} error={ctx.error} footer={footer} />
    );
  }

  const recentAssets = ctx.assets.slice(0, 6);

  if (recentAssets.length === 0) {
    return (
      <DashboardPanel
        title={copy.recentAssetsTitle}
        empty={copy.recentAssetsEmpty}
        footer={footer}
      />
    );
  }

  return (
    <DashboardPanel title={copy.recentAssetsTitle} footer={footer}>
      <div className="asset-quick-access__grid">
        {recentAssets.map(asset => (
          <div key={asset.id} className="asset-mini-card">
            <AssetTypeIcon type={asset.assetType} size={16} />
            <span className="asset-mini-card__label" title={asset.label}>{asset.label}</span>
            <QualityScoreBadge score={asset.qualityScore} size="small" />
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
};
