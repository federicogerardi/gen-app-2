import { useMemo } from 'react';
import type { AssetType } from '@gen-app-2/contracts';
import type { WorkspaceAsset } from '../runtime/useWorkspaceContext';
import { ASSET_TYPE_LABELS, getProducerToolsForAsset } from '../runtime/toolAssetRegistry';
import { AssetGroupList, type AssetGroupSpec } from './AssetGroupList';
import './AssetGroupSection.css';

export interface AssetLibraryViewProps {
  /** The workspace/project ID. */
  workspaceId: string;
  /** Assets grouped by asset type key. */
  groupedByType: Record<string, WorkspaceAsset[]>;
  /** Called when the user triggers a create action (generate with tool, manual create, or upload). */
  onCreateAction: (assetType: string) => void;
}

/**
 * Unified asset library view — thin adapter over {@link AssetGroupList}.
 *
 * Computes `AssetGroupSpec[]` from the full {@link ASSET_TYPE_LABELS} registry
 * and the workspace's grouped assets, then delegates all rendering to
 * {@link AssetGroupList} in "browse" mode.
 */
export const AssetLibraryView: React.FC<AssetLibraryViewProps> = ({
  workspaceId,
  groupedByType,
  onCreateAction,
}) => {
  const specs: AssetGroupSpec[] = useMemo(
    () =>
      (Object.keys(ASSET_TYPE_LABELS) as AssetType[]).map(type => {
        const producerTools = getProducerToolsForAsset(type);
        return {
          assetType: type,
          label: ASSET_TYPE_LABELS[type],
          requiredness: 'optional-by-tool-setting' as const,
          assets: groupedByType[type] ?? [],
          producerTool: (producerTools[0] ?? null),
        };
      }),
    [groupedByType],
  );

  return (
    <AssetGroupList
      specs={specs}
      mode="browse"
      selectedAssetIds={[]}
      workspaceId={workspaceId}
      onAssetToggle={() => {
        /* no-op in browse mode */
      }}
      onCreateAction={onCreateAction}
    />
  );
};
