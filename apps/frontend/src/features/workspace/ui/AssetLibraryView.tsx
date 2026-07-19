import { useState, useMemo, useCallback } from 'react';
import type { AssetType } from '@gen-app-2/contracts';
import type { WorkspaceAsset } from '../runtime/useWorkspaceContext';
import { ASSET_TYPE_LABELS, getProducerToolsForAsset } from '../runtime/toolAssetRegistry';
import { AssetGroupSection } from './AssetGroupSection';
import './AssetGroupSection.css';

export interface AssetLibraryViewProps {
  /** The workspace/project ID (used as projectId for CreateAssetPrompt). */
  workspaceId: string;
  /** Assets grouped by asset type key. */
  groupedByType: Record<string, WorkspaceAsset[]>;
  /** Called when the user triggers a create action (generate with tool, manual create, or upload). */
  onCreateAction: (assetType: string) => void;
}

/**
 * Unified asset library view.
 *
 * Renders every known asset type as a collapsible {@link AssetGroupSection} in
 * "browse" mode. Used both on the full assets page and inside the dashboard
 * accordion panel.
 */
export const AssetLibraryView: React.FC<AssetLibraryViewProps> = ({
  workspaceId,
  groupedByType,
  onCreateAction,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() =>
    new Set(
      Object.entries(groupedByType)
        .filter(([, assets]) => assets.length > 0)
        .map(([type]) => type),
    ),
  );

  const handleToggleExpanded = useCallback((assetType: string, expanded: boolean) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (expanded) {
        next.add(assetType);
      } else {
        next.delete(assetType);
      }
      return next;
    });
  }, []);

  // Compute the ordered list of asset types to display.
  // We use the canonical ASSET_TYPE_LABELS order (from contracts) so the
  // listing is deterministic and matches the domain glossary.
  const orderedAssetTypes = useMemo(
    () => Object.keys(ASSET_TYPE_LABELS) as AssetType[],
    [],
  );

  return (
    <div className="asset-library-view">
      {orderedAssetTypes.map(type => {
        const assets = groupedByType[type] ?? [];
        const producerTools = getProducerToolsForAsset(type);
        const firstProducerTool: string | null = producerTools[0] ?? null;

        return (
          <AssetGroupSection
            key={type}
            assetType={type}
            label={ASSET_TYPE_LABELS[type]}
            requiredness="optional-by-tool-setting"
            assets={assets}
            isExpanded={expandedGroups.has(type)}
            selectedAssetIds={[]}
            producerTool={firstProducerTool}
            projectId={workspaceId}
            mode="browse"
            onToggleExpanded={expanded =>
              handleToggleExpanded(type, expanded)
            }
            onAssetToggle={() => {
              /* no-op in browse mode */
            }}
            onCreateAction={() => onCreateAction(type)}
          />
        );
      })}
    </div>
  );
};
