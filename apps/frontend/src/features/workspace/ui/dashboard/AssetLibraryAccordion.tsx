import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspaceContext } from '../../runtime/useWorkspaceContext';
import { useAssetCreateNavigation } from '../../runtime/useAssetCreateNavigation';
import { AssetLibraryView } from '../AssetLibraryView';
import { DashboardPanel } from './DashboardPanel';
import { appCopy } from '../../../../app/copy/system';

interface AssetLibraryAccordionProps {
  workspaceId: string;
}

export const AssetLibraryAccordion: React.FC<AssetLibraryAccordionProps> = ({ workspaceId }) => {
  const ctx = useWorkspaceContext(workspaceId);

  const isEmpty = useMemo(() => {
    const totalAssets = Object.values(ctx.groupedByType).reduce(
      (sum, assets) => sum + assets.length,
      0,
    );
    return totalAssets === 0 && ctx.gaps.length === 0;
  }, [ctx.groupedByType, ctx.gaps]);

  const handleCreateAction = useAssetCreateNavigation(workspaceId, ctx.refetch);

  return (
    <DashboardPanel
      title={appCopy.ui.workspace.dashboard.assetLibraryTitle}
      empty={
        isEmpty
          ? appCopy.ui.workspace.dashboard.recentAssetsEmpty
          : undefined
      }
      footer={
        <Link
          to={`/workspaces/${workspaceId}/assets`}
          className="ui-inline-link"
        >
          {appCopy.ui.workspace.dashboard.viewAllAssetsArrow}
        </Link>
      }
    >
      <AssetLibraryView
        workspaceId={workspaceId}
        groupedByType={ctx.groupedByType}
        onCreateAction={handleCreateAction}
      />
    </DashboardPanel>
  );
};
