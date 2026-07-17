import { useMemo } from 'react';
import type { AssetDto, ToolKey } from '@gen-app-2/contracts';
import { useAssetSuggestions } from '../../tools/runtime/useAssetSuggestions';

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
  const assetsQuery = useAssetSuggestions(
    workspaceId || null,
    toolKey || null,
    !!workspaceId,
  );

  const qualityGateStatus = useMemo((): 'healthy' | 'needs-attention' | 'blocked' => {
    const assets = assetsQuery.compatibleAssets || [];
    if (assets.length === 0) return 'healthy';

    const hasStale = assets.some(a => a.staleUpstream);
    if (hasStale) return 'needs-attention';

    return 'healthy';
  }, [assetsQuery.compatibleAssets]);

  const overallQualityScore = useMemo(() => {
    const assets = assetsQuery.compatibleAssets || [];
    if (assets.length === 0) return 0;
    const totalScore = assets.reduce((sum, a) => sum + (a.staleUpstream ? 50 : 100), 0);
    return Math.round(totalScore / assets.length);
  }, [assetsQuery.compatibleAssets]);

  const mappedAssets = useMemo(
    () => (assetsQuery.compatibleAssets || []).map(mapAssetDto),
    [assetsQuery.compatibleAssets],
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
    loading: assetsQuery.loading,
    error: assetsQuery.error,
    refetch: assetsQuery.refresh,
  };

  if (workflowPosition) {
    result.workflowPosition = workflowPosition;
  }

  return result;
};
