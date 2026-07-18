import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspaceContext } from '../../runtime/useWorkspaceContext';
import { ASSET_TYPE_LABELS, getProducerToolsForAsset } from '../../runtime/toolAssetRegistry';
import { AssetGroupSection } from '../AssetGroupSection';
import { DashboardPanel } from './DashboardPanel';
import { appCopy } from '../../../../app/copy/system';
import type { AssetType } from '@gen-app-2/contracts';

interface AssetLibraryAccordionProps {
  workspaceId: string;
}

export const AssetLibraryAccordion: React.FC<AssetLibraryAccordionProps> = ({ workspaceId }) => {
  const ctx = useWorkspaceContext(workspaceId);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() =>
    new Set(
      Object.entries(ctx.groupedByType)
        .filter(([, assets]) => assets.length > 0)
        .map(([type]) => type),
    ),
  );

  // Collect all asset types: those with assets + those with gaps
  const allAssetTypes = useMemo(() => {
    const types = new Set(Object.keys(ctx.groupedByType));
    for (const gap of ctx.gaps) types.add(gap.assetType);
    return Array.from(types);
  }, [ctx.groupedByType, ctx.gaps]);

  const getProducerTool = (assetType: string): string | null =>
    (getProducerToolsForAsset(assetType as AssetType) as string[])[0] ?? null;

  return (
    <DashboardPanel
      title={appCopy.ui.workspace.dashboard.assetLibraryTitle}
      empty={allAssetTypes.length === 0 ? appCopy.ui.workspace.dashboard.recentAssetsEmpty : undefined}
      footer={
        <Link to={`/workspaces/${workspaceId}/assets`} className="ui-inline-link">
          View all assets →
        </Link>
      }
    >
      <div style={{ padding: 0 }}>
        {allAssetTypes.map(assetType => (
          <AssetGroupSection
            key={assetType}
            assetType={assetType}
            label={ASSET_TYPE_LABELS[assetType as AssetType] ?? assetType}
            requiredness="optional-by-tool-setting"
            assets={ctx.groupedByType[assetType] ?? []}
            isExpanded={expandedGroups.has(assetType)}
            selectedAssetIds={[]}
            producerTool={getProducerTool(assetType)}
            projectId={workspaceId}
            mode="browse"
            onToggleExpanded={(expanded) => {
              setExpandedGroups(prev => {
                const next = new Set(prev);
                expanded ? next.add(assetType) : next.delete(assetType);
                return next;
              });
            }}
            onAssetToggle={() => {}}
            onCreateAction={() => { /* navigate to producer tool */ }}
          />
        ))}
      </div>
    </DashboardPanel>
  );
};
