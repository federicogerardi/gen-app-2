import { useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWorkspaceContext } from '../../runtime/useWorkspaceContext';
import { getProducerToolsForAsset } from '../../runtime/toolAssetRegistry';
import { AssetLibraryView } from '../AssetLibraryView';
import { DashboardPanel } from './DashboardPanel';
import { appCopy } from '../../../../app/copy/system';
import type { AssetType } from '@gen-app-2/contracts';

interface AssetLibraryAccordionProps {
  workspaceId: string;
}

export const AssetLibraryAccordion: React.FC<AssetLibraryAccordionProps> = ({ workspaceId }) => {
  const ctx = useWorkspaceContext(workspaceId);
  const navigate = useNavigate();

  const isEmpty = useMemo(() => {
    const totalAssets = Object.values(ctx.groupedByType).reduce(
      (sum, assets) => sum + assets.length,
      0,
    );
    return totalAssets === 0 && ctx.gaps.length === 0;
  }, [ctx.groupedByType, ctx.gaps]);

  const handleCreateAction = useCallback(
    (assetType: string) => {
      const producerTools = getProducerToolsForAsset(assetType as AssetType);
      const toolKey = producerTools[0] ?? null;
      if (toolKey) {
        navigate(`/workspaces/${workspaceId}/tools/${toolKey}`);
      } else {
        ctx.refetch();
      }
    },
    [navigate, workspaceId, ctx],
  );

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
          View all assets →
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
