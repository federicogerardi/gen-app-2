import { useState, useCallback, useEffect } from 'react';
import type { WorkspaceAsset } from '../runtime/useWorkspaceContext';
import { AssetGroupSection } from './AssetGroupSection';
import './AssetGroupSection.css';

/**
 * Specification for a single asset type group to render.
 * Both {@link AssetLibraryView} and {@link AssetKnowledgePanel} compute
 * these specs from their respective data sources and pass them to
 * {@link AssetGroupList}.
 */
export interface AssetGroupSpec {
  assetType: string;
  label: string;
  requiredness: 'always-required' | 'optional-by-tool-setting' | 'never-required';
  assets: WorkspaceAsset[];
  /** The first producer tool for this asset type, or null if none. */
  producerTool: string | null;
}

export interface AssetGroupListProps {
  /** Pre-computed group specifications (ordered as they should appear). */
  specs: AssetGroupSpec[];
  /** Rendering mode: 'select' shows checkboxes, 'browse' shows a simple list. */
  mode: 'select' | 'browse';
  /** Currently selected asset IDs (only meaningful in select mode). */
  selectedAssetIds: string[];
  /** Workspace ID — passed through as `projectId` to {@link AssetGroupSection}. */
  workspaceId: string;
  /** Called when an asset is toggled (select mode) or is a no-op (browse mode). */
  onAssetToggle: (assetId: string, checked: boolean) => void;
  /** Called when the user triggers a create/generate action for an asset type. */
  onCreateAction: (assetType: string) => void;
}

/**
 * Unified asset group list — the shared orchestrator that iterates asset
 * groups and renders {@link AssetGroupSection} for each.
 *
 * Replaces the duplicated iteration logic in {@link AssetLibraryView} and
 * {@link AssetKnowledgePanel}. Both callers become thin adapters that
 * compute `specs` from their domain data and pass them here.
 */
export const AssetGroupList: React.FC<AssetGroupListProps> = ({
  specs,
  mode,
  selectedAssetIds,
  workspaceId,
  onAssetToggle,
  onCreateAction,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    if (mode === 'select') {
      // In tool-page / select mode: auto-expand always-required groups.
      return new Set(
        specs
          .filter(s => s.requiredness === 'always-required')
          .map(s => s.assetType),
      );
    }
    // In browse mode: auto-expand groups that have assets.
    return new Set(specs.filter(s => s.assets.length > 0).map(s => s.assetType));
  });

  const handleGroupToggle = useCallback((assetType: string, expanded: boolean) => {
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

  // Auto-expand always-required groups that have zero assets so the user
  // sees the "missing required" prompt immediately.
  useEffect(() => {
    const requiredMissingTypes = specs
      .filter(s => s.requiredness === 'always-required' && s.assets.length === 0)
      .map(s => s.assetType);

    if (requiredMissingTypes.length > 0) {
      setExpandedGroups(prev => new Set([...prev, ...requiredMissingTypes]));
    }
  }, [specs]);

  if (specs.length === 0) return null;

  return (
    <div className="asset-group-list">
      {specs.map(spec => {
        const isExpanded = expandedGroups.has(spec.assetType);

        return (
          <AssetGroupSection
            key={spec.assetType}
            assetType={spec.assetType}
            label={spec.label}
            requiredness={spec.requiredness}
            assets={spec.assets}
            isExpanded={isExpanded}
            selectedAssetIds={selectedAssetIds}
            producerTool={spec.producerTool}
            projectId={workspaceId}
            mode={mode}
            onToggleExpanded={expanded => handleGroupToggle(spec.assetType, expanded)}
            onAssetToggle={onAssetToggle}
            onCreateAction={() => onCreateAction(spec.assetType)}
          />
        );
      })}
    </div>
  );
};
