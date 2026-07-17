import { useState, useEffect, useMemo, useCallback } from 'react';
import type { AssetDto, ToolKey } from '@gen-app-2/contracts';
import { useAssetSuggestions } from '../../tools/runtime/useAssetSuggestions';
import { listAssets } from '../../tools/runtime/asset-client';

export interface WorkspaceAsset {
  id: string;
  assetType: string;
  label: string;
  qualityScore: number;
  status: string;
  staleUpstream: boolean;
  sourceToolKey?: string;
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

export interface WorkspaceContextData {
  id: string;
  assets: WorkspaceAsset[];
  qualityGateStatus: 'healthy' | 'needs-attention' | 'blocked';
  workflowPosition?: WorkflowPosition;
  gaps: AssetGap[];
  overallQualityScore: number;
}

const mapAssetDto = (a: AssetDto): WorkspaceAsset => ({
  id: a.assetId,
  assetType: a.assetType,
  label: a.label,
  qualityScore: a.staleUpstream ? 50 : 100,
  status: a.status,
  staleUpstream: a.staleUpstream,
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
      setAllAssets(result.assets);
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
    const assets = effectiveAssets;
    if (assets.length === 0) return 'healthy';
    const hasStale = assets.some(a => a.staleUpstream);
    if (hasStale) return 'needs-attention';
    return 'healthy';
  }, [effectiveAssets]);

  const overallQualityScore = useMemo(() => {
    const assets = effectiveAssets;
    if (assets.length === 0) return 0;
    const totalScore = assets.reduce((sum, a) => sum + (a.staleUpstream ? 50 : 100), 0);
    return Math.round(totalScore / assets.length);
  }, [effectiveAssets]);

  const mappedAssets = useMemo(
    () => effectiveAssets.map(mapAssetDto),
    [effectiveAssets],
  );

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
    gaps: (assetsQuery.gaps || []).map(g => ({
      assetType: g.assetType,
      canBeProducedBy: g.canBeProducedBy,
    })),
    overallQualityScore,
    loading: effectiveLoading,
    error: effectiveError,
    refetch: hasToolKey ? assetsQuery.refresh : refreshAll,
  };

  if (workflowPosition) {
    result.workflowPosition = workflowPosition;
  }

  return result;
};
