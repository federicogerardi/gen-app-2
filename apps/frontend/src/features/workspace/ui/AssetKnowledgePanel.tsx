import { useState, useCallback, useMemo, useEffect } from 'react';
import { Chip, Typography } from '@mui/material';
import { Database } from 'lucide-react';
import type { SupportedTool } from '../../tools/machines/tool-flow.machine';
import type { WorkspaceAsset } from '../runtime/useWorkspaceContext';
import { AssetGroupSection } from './AssetGroupSection';
import { QualityScoreBadge } from './QualityScoreBadge';
import { appCopy } from '../../../app/copy/system';
import './AssetKnowledgePanel.css';
import './AssetGroupSection.css';
import './asset-components.css';

interface ToolProjectAssetPolicyEntry {
  assetType: string;
  label: string;
  requiredness: 'always-required' | 'optional-by-tool-setting' | 'never-required';
}

interface AssetKnowledgePanelProps {
  workspaceAssets: WorkspaceAsset[];
  toolAssetInputs: ToolProjectAssetPolicyEntry[];
  projectId?: string;
  onAssetSelect: (assetIds: string[]) => void;
  onCreateAssetAction: (assetType: string, sourceToolKey?: SupportedTool) => void;
}

const TOOL_ASSET_CONTRACTS: Record<string, { produces: string[] }> = {
  'angle-generator': { produces: ['angle'] },
  'meta-ads': { produces: ['ad-copy', 'hook'] },
  'blog-article-generator': { produces: ['article', 'article-outline'] },
  'youtube-description': { produces: ['description'] },
  'funnel-pages': { produces: ['landing-page'] },
  'nextland': { produces: ['creative-brief'] },
  'youtube-lf-script': { produces: ['script'] },
  'geometric': { produces: ['competitor-analysis'] },
};

const groupBy = <T extends { assetType: string }>(array: T[], key: keyof T): Record<string, T[]> => {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
    return groups;
  }, {} as Record<string, T[]>);
};

export const AssetKnowledgePanel: React.FC<AssetKnowledgePanelProps> = ({
  workspaceAssets,
  toolAssetInputs,
  projectId,
  onAssetSelect,
  onCreateAssetAction,
}) => {
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(toolAssetInputs.filter(input =>
      input.requiredness === 'always-required',
    ).map(input => input.assetType)),
  );

  const groupedAssets = useMemo(() => {
    return groupBy(workspaceAssets, 'assetType');
  }, [workspaceAssets]);

  const overallQualityScore = useMemo(() => {
    if (workspaceAssets.length === 0) return 0;
    const totalScore = workspaceAssets.reduce((sum, asset) => sum + asset.qualityScore, 0);
    return Math.round(totalScore / workspaceAssets.length);
  }, [workspaceAssets]);

  const toolReadinessScore = useMemo(() => {
    let totalWeight = 0;
    let achievedWeight = 0;

    toolAssetInputs.forEach(input => {
      const weight = input.requiredness === 'always-required' ? 3 : 1;
      totalWeight += weight;

      const assets = groupedAssets[input.assetType] || [];
      if (assets.length > 0) {
        const avgQuality = assets.reduce((sum, a) => sum + a.qualityScore, 0) / assets.length;
        achievedWeight += (avgQuality / 100) * weight;
      }
    });

    return totalWeight > 0 ? Math.round((achievedWeight / totalWeight) * 100) : 0;
  }, [toolAssetInputs, groupedAssets]);

  const handleAssetToggle = useCallback((assetId: string, checked: boolean) => {
    setSelectedAssetIds(prev => {
      const newSelection = checked
        ? [...prev, assetId]
        : prev.filter(id => id !== assetId);

      onAssetSelect(newSelection);
      return newSelection;
    });
  }, [onAssetSelect]);

  const handleGroupToggle = useCallback((assetType: string, expanded: boolean) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (expanded) {
        newSet.add(assetType);
      } else {
        newSet.delete(assetType);
      }
      return newSet;
    });
  }, []);

  const getProducerTool = useCallback((assetType: string): SupportedTool | null => {
    for (const [toolKey, contract] of Object.entries(TOOL_ASSET_CONTRACTS)) {
      if (contract.produces.includes(assetType)) {
        return toolKey as SupportedTool;
      }
    }
    return null;
  }, []);

  useEffect(() => {
    const requiredMissingTypes = toolAssetInputs
      .filter(input => input.requiredness === 'always-required')
      .filter(input => (groupedAssets[input.assetType] || []).length === 0)
      .map(input => input.assetType);

    if (requiredMissingTypes.length > 0) {
      setExpandedGroups(prev => new Set([...prev, ...requiredMissingTypes]));
    }
  }, [toolAssetInputs, groupedAssets]);

  return (
    <div className="asset-knowledge-panel">
      <div className="asset-knowledge-panel__header">
        <div className="asset-knowledge-panel__title">
          <Database size={20} />
          <Typography variant="h6">
            {appCopy.ui.workspace?.assetPanel?.title || 'Workspace Knowledge'}
          </Typography>
        </div>

        <div className="asset-knowledge-panel__metrics">
          <Chip
            label={`${workspaceAssets.length} ${appCopy.ui.workspace?.assetPanel?.metricsAssets || 'assets'}`}
            size="small"
            color={workspaceAssets.length > 0 ? 'primary' : 'default'}
          />
          <QualityScoreBadge
            score={overallQualityScore}
            label={appCopy.ui.workspace?.assetPanel?.metricsQuality || 'quality'}
          />
          <Chip
            label={`${toolReadinessScore}% ready`}
            size="small"
            color={toolReadinessScore >= 70 ? 'success' : toolReadinessScore >= 40 ? 'warning' : 'error'}
          />
        </div>
      </div>

      <div className="asset-knowledge-panel__groups">
        {toolAssetInputs.map(input => {
          const assets = groupedAssets[input.assetType] || [];
          const isExpanded = expandedGroups.has(input.assetType);
          const producerTool = getProducerTool(input.assetType);

          return (
            <AssetGroupSection
              key={input.assetType}
              assetType={input.assetType}
              label={input.label}
              requiredness={input.requiredness}
              assets={assets}
              isExpanded={isExpanded}
              selectedAssetIds={selectedAssetIds}
              {...(producerTool !== null ? { producerTool } : {})}
              {...(projectId !== undefined ? { projectId } : {})}
              onToggleExpanded={(expanded) => handleGroupToggle(input.assetType, expanded)}
              onAssetToggle={handleAssetToggle}
              onCreateAction={() => onCreateAssetAction(input.assetType, producerTool ?? undefined)}
            />
          );
        })}
      </div>

      {selectedAssetIds.length > 0 && (
        <div className="asset-knowledge-panel__selection-summary">
          <Typography variant="body2" color="text.secondary">
            {selectedAssetIds.length} asset{selectedAssetIds.length === 1 ? '' : 's'} selected for generation
          </Typography>
        </div>
      )}
    </div>
  );
};
