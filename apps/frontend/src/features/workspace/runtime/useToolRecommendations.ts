import { useMemo } from 'react';
import { TOOL_ASSET_CONTRACTS, type ToolKey, type AssetType, type ToolAccessRole } from '@gen-app-2/contracts';
import { useWorkspaceContext } from './useWorkspaceContext';
import { getEnabledToolNavigationItems } from '../../tools/runtime/tool-form-architecture';
import { getToolAssetInputs } from './toolAssetRegistry';

export interface ToolRecommendation {
  toolKey: ToolKey;
  label: string;
  description: string;
  to: string;
  readinessScore: number;
  impactScore: number;
  priorityScore: number;
  reason: string;
  missingAssets: AssetType[];
  fillableGaps: AssetType[];
}

export const useToolRecommendations = (
  workspaceId?: string,
  role: ToolAccessRole = 'member',
  limit: number = 5,
): ToolRecommendation[] => {
  const ctx = useWorkspaceContext(workspaceId);

  return useMemo(() => {
    if (!workspaceId || ctx.loading || !ctx.workflowPosition) return [];

    const completedSet = new Set(ctx.workflowPosition.completedSteps);
    const gapAssetTypes = new Set(ctx.gaps.map(g => g.assetType));
    const availableTools = getEnabledToolNavigationItems(role, workspaceId);
    const existingAssetTypes = new Set(ctx.assets.map(a => a.assetType));

    const recommendations: ToolRecommendation[] = [];

    for (const item of availableTools) {
      const toolKey = item.toolKey as ToolKey;
      if (completedSet.has(toolKey)) continue;

      const contract = TOOL_ASSET_CONTRACTS[toolKey];
      if (!contract || contract.consumes.length === 0) continue;

      const toolInputs = getToolAssetInputs(toolKey);
      const requiredTypes = new Set(toolInputs.filter(i => i.requiredness === 'always-required').map(i => i.assetType));
      const requiredConsumes = contract.consumes.filter(a => requiredTypes.has(a));

      // Readiness based only on required assets (optional assets don't reduce score)
      const coveredCount = requiredConsumes.filter(a => existingAssetTypes.has(a)).length;
      const missingAssets = contract.consumes.filter(a => !existingAssetTypes.has(a));
      const fillableGaps = contract.produces.filter(a => gapAssetTypes.has(a));

      const readinessScore = requiredConsumes.length > 0
        ? Math.round((coveredCount / requiredConsumes.length) * 100)
        : 0;
      const impactScore = fillableGaps.length * 30;
      const priorityScore = readinessScore * 0.6 + impactScore * 0.4;

      let reason: string;
      if (missingAssets.length === 0) {
        reason = 'Ready to run — all inputs available';
      } else if (fillableGaps.length > 0) {
        reason = `Needs ${missingAssets.join(', ')} — fills ${fillableGaps.length} gap(s)`;
      } else {
        reason = `Needs ${missingAssets.join(', ')} inputs`;
      }

      recommendations.push({
        toolKey,
        label: item.label,
        description: item.description,
        to: item.to,
        readinessScore,
        impactScore,
        priorityScore,
        reason,
        missingAssets,
        fillableGaps,
      });
    }

    return recommendations
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, limit);
  }, [workspaceId, role, limit, ctx.loading, ctx.workflowPosition, ctx.gaps, ctx.assets]);
};
