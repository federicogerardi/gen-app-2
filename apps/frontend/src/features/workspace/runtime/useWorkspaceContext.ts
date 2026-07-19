import { useState, useEffect, useMemo, useCallback } from 'react';
import type { AssetDto, ToolKey, AssetType } from '@gen-app-2/contracts';
import { TOOL_ASSET_CONTRACTS, ASSET_TYPES } from '@gen-app-2/contracts';
import { useAssetSuggestions } from '../../tools/runtime/useAssetSuggestions';
import { listAssets } from '../../tools/runtime/asset-client';

export interface WorkspaceAsset {
  id: string;
  assetType: string;
  label: string;
  qualityScore: number;
  status: string;
  staleUpstream: boolean;
  createdAt: string;
  sourceToolKey?: string;
  sourceArtifactId?: string | null;
}

export interface AssetGap {
  assetType: string;
  canBeProducedBy: string[];
}

export interface WorkflowPosition {
  currentStep: string;
  totalSteps: number;
  completedSteps: string[];
  suggestedNext?: ToolKey[];
  estimatedCompletion?: number;
}

// "Foundation Tool" is a UI-layer classification derived from TOOL_ASSET_CONTRACTS.
// Not a canonical domain term — use in component comments/props only.
export interface FoundationToolStatus {
  toolKey: string;
  producedAssetType: string;
  existingAssets: WorkspaceAsset[];
  hasAssets: boolean;
}

export interface WorkspaceContextData {
  id: string;
  assets: WorkspaceAsset[];
  qualityGateStatus: 'healthy' | 'needs-attention' | 'blocked';
  workflowPosition?: WorkflowPosition;
  gaps: AssetGap[];
  overallQualityScore: number;
  groupedByType: Record<string, WorkspaceAsset[]>;
  foundationTools: FoundationToolStatus[];
}

const mapAssetDto = (a: AssetDto): WorkspaceAsset => ({
  id: a.assetId,
  assetType: a.assetType,
  label: a.label,
  qualityScore: a.staleUpstream ? 50 : 100,
  status: a.status,
  staleUpstream: a.staleUpstream,
  createdAt: a.createdAt,
  sourceArtifactId: a.sourceArtifactId,
});

export const useWorkspaceContext = (
  workspaceId?: string,
  toolKey?: string | null,
): WorkspaceContextData & {
  loading: boolean;
  error: string | null;
  refetch: () => void;
} => {
  const hasToolKey = Boolean(toolKey);

  const assetsQuery = useAssetSuggestions(
    workspaceId || null,
    hasToolKey ? (toolKey || null) : null,
    hasToolKey && !!workspaceId,
  );

  // When no toolKey (dashboard mode), fetch ALL project assets
  const [allAssets, setAllAssets] = useState<AssetDto[]>([]);
  const [allAssetsLoading, setAllAssetsLoading] = useState(false);
  const [allAssetsError, setAllAssetsError] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    if (!workspaceId || hasToolKey) return;
    setAllAssetsLoading(true);
    setAllAssetsError(null);
    try {
      const result = await listAssets(workspaceId, { status: 'active', limit: 100 });
      setAllAssets(result.assets ?? []);
    } catch (err) {
      setAllAssetsError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally {
      setAllAssetsLoading(false);
    }
  }, [workspaceId, hasToolKey]);

  useEffect(() => {
    if (!workspaceId || hasToolKey) return;
    void refreshAll();
  }, [workspaceId, hasToolKey, refreshAll]);

  // Use tool-specific assets when toolKey is set, all assets otherwise
  const effectiveAssets = hasToolKey
    ? (assetsQuery.compatibleAssets || [])
    : allAssets;

  const effectiveLoading = hasToolKey ? assetsQuery.loading : allAssetsLoading;
  const effectiveError = hasToolKey ? assetsQuery.error : allAssetsError;

  const qualityGateStatus = useMemo((): 'healthy' | 'needs-attention' | 'blocked' => {
    const assets = effectiveAssets || [];
    if (assets.length === 0) return 'healthy';
    const hasStale = assets.some(a => a.staleUpstream);
    if (hasStale) return 'needs-attention';
    return 'healthy';
  }, [effectiveAssets]);

  const overallQualityScore = useMemo(() => {
    const assets = effectiveAssets || [];
    if (assets.length === 0) return 0;
    const totalScore = assets.reduce((sum, a) => sum + (a.staleUpstream ? 50 : 100), 0);
    return Math.round(totalScore / assets.length);
  }, [effectiveAssets]);

  const mappedAssets = useMemo(
    () => (effectiveAssets || []).map(mapAssetDto),
    [effectiveAssets],
  );

  const groupedByType = useMemo(() => {
    const groups: Record<string, WorkspaceAsset[]> = {};
    for (const asset of mappedAssets) {
      if (!groups[asset.assetType]) groups[asset.assetType] = [];
      groups[asset.assetType]!.push(asset);
    }
    return groups;
  }, [mappedAssets]);

  // Foundation tools: tools with consumes === [], excluding analysis-only tools
  // (geometric). This is a UI-layer derivation, not a domain concept.
  const EXCLUDED_FOUNDATION_TOOLS = new Set<ToolKey>(['geometric']);

  const foundationTools = useMemo((): FoundationToolStatus[] => {
    const foundationToolKeys = (Object.keys(TOOL_ASSET_CONTRACTS) as ToolKey[])
      .filter(key => (TOOL_ASSET_CONTRACTS[key]?.consumes ?? []).length === 0)
      .filter(key => !EXCLUDED_FOUNDATION_TOOLS.has(key));

    return foundationToolKeys.map(toolKey => {
      const contract = TOOL_ASSET_CONTRACTS[toolKey];
      const producedType = contract?.produces[0] ?? '';
      const existingAssets = mappedAssets.filter(a => a.assetType === producedType);
      return {
        toolKey,
        producedAssetType: producedType,
        existingAssets,
        hasAssets: existingAssets.length > 0,
      };
    });
  }, [mappedAssets]);

  const workflowPosition = useMemo((): WorkflowPosition | undefined => {
    if (mappedAssets.length === 0) return undefined;
    const completedTools = new Set<string>();
    mappedAssets.forEach(asset => {
      if (asset.sourceToolKey) {
        completedTools.add(asset.sourceToolKey);
      }
    });

    const suggestedNext = (assetsQuery.gaps || [])
      .flatMap(g => g.canBeProducedBy)
      .slice(0, 3) as ToolKey[];

    return {
      currentStep: `${completedTools.size} tools completed`,
      totalSteps: 8,
      completedSteps: Array.from(completedTools),
      suggestedNext,
      estimatedCompletion: Math.round((completedTools.size / 8) * 100),
    };
  }, [mappedAssets, assetsQuery.gaps]);

  const result: WorkspaceContextData & {
    loading: boolean;
    error: string | null;
    refetch: () => void;
  } = {
    id: workspaceId || '',
    assets: mappedAssets,
    qualityGateStatus,
    gaps: (() => {
      if (hasToolKey) {
        return (assetsQuery.gaps || []).map(g => ({
          assetType: g.assetType,
          canBeProducedBy: g.canBeProducedBy,
        }));
      }

      // Dashboard mode: compare ASSET_TYPES to those present in groupedByType
      return ASSET_TYPES.filter(type => {
        const hasAssets = groupedByType[type] && groupedByType[type].length > 0;
        return !hasAssets;
      }).map(type => {
        // Identify which tools produce this asset type
        const producers = (Object.keys(TOOL_ASSET_CONTRACTS) as ToolKey[]).filter(key =>
          TOOL_ASSET_CONTRACTS[key].produces.includes(type as AssetType)
        );
        return {
          assetType: type,
          canBeProducedBy: producers,
        };
      }).filter(gap => gap.canBeProducedBy.length > 0);
    })(),
    overallQualityScore,
    groupedByType,
    foundationTools,
    loading: effectiveLoading,
    error: effectiveError,
    refetch: hasToolKey ? assetsQuery.refresh : refreshAll,
  };

  if (workflowPosition) {
    result.workflowPosition = workflowPosition;
  }

  return result;
};
