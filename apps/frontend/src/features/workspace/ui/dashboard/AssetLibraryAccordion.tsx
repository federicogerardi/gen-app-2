import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspaceContext } from '../../runtime/useWorkspaceContext';
import { ASSET_TYPE_LABELS, getProducerToolsForAsset } from '../../runtime/toolAssetRegistry';
import { AssetGroupSection } from '../AssetGroupSection';
import { EmptyStateMessage } from '../../../../app/ui/primitives';
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
    <div className="dashboard-panel">
      <div className="dashboard-panel__header">
        <span className="dashboard-panel__title">Asset Library</span>
      </div>
      <div className="dashboard-panel__content" style={{ padding: 0 }}>
        {allAssetTypes.length === 0 ? (
          <div style={{ padding: '16px 20px' }}>
            <EmptyStateMessage>No assets yet. Use a tool to generate your first asset.</EmptyStateMessage>
          </div>
        ) : (
          allAssetTypes.map(assetType => (
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
          ))
        )}
      </div>
      <div className="asset-accordion__footer">
        <Link to={`/workspaces/${workspaceId}/assets`} className="ui-inline-link">
          View all assets →
        </Link>
      </div>
    </div>
  );
};
