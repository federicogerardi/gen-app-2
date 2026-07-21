import { useState, useCallback, useMemo, useEffect } from 'react';
import { Chip, MenuItem, Select, Typography } from '@mui/material';
import { Database } from 'lucide-react';
import type { SupportedTool } from '../../tools/machines/tool-flow.machine';
import type { AssetType } from '@gen-app-2/contracts';
import type { WorkspaceAsset } from '../runtime/useWorkspaceContext';
import { AssetGroupSection } from './AssetGroupSection';
import { getProducerToolsForAsset, type ToolProjectAssetPolicyEntry } from '../runtime/toolAssetRegistry';
import { appCopy } from '../../../app/copy/system';
import './AssetKnowledgePanel.css';
import './AssetGroupSection.css';
import './asset-components.css';

interface AssetKnowledgePanelProps {
  workspaceAssets: WorkspaceAsset[];
  toolAssetInputs: ToolProjectAssetPolicyEntry[];
  projectId?: string;
  onAssetSelect: (assetIds: string[]) => void;
  onCreateAssetAction: (assetType: string, sourceToolKey?: SupportedTool) => void;
  /** LlmModelId correntemente selezionato (dal form state) */
  modelValue?: string;
  /** Opzioni disponibili da LlmModelCatalog */
  modelOptions?: Array<{ key: string; label: string; isDefault: boolean }>;
  /** Callback quando l'utente cambia modello */
  onModelChange?: (model: string) => void;
  /** Se false, il model selector non viene renderizzato (tool non-asset-capable) */
  showModelSelector?: boolean;
}

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
  modelValue,
  modelOptions,
  onModelChange,
  showModelSelector,
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

  const handleAssetToggle = useCallback((assetId: string, checked: boolean) => {
    setSelectedAssetIds(prev => {
      const newSelection = checked
        ? [...prev, assetId]
        : prev.filter(id => id !== assetId);
      return newSelection;
    });
  }, []);

  // Defer parent notification to commit phase to avoid setState-in-render warning
  useEffect(() => {
    onAssetSelect(selectedAssetIds);
  }, [selectedAssetIds, onAssetSelect]);

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
    return (getProducerToolsForAsset(assetType as AssetType) as SupportedTool[])[0] ?? null;
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
            {appCopy.ui.workspace.assetPanel.title}
          </Typography>
        </div>

        <div className="asset-knowledge-panel__metrics">
          <Chip
            label={`${workspaceAssets.length} ${appCopy.ui.workspace.assetPanel.metricsAssets}`}
            size="small"
            color={workspaceAssets.length > 0 ? 'primary' : 'default'}
          />
          {showModelSelector && modelOptions && modelOptions.length > 0 && (
            <Select
              size="small"
              value={modelValue ?? ''}
              onChange={(e) => onModelChange?.(e.target.value)}
              className="asset-knowledge-panel__model-selector"
            >
              {modelOptions.map((o) => (
                <MenuItem key={o.key} value={o.key}>{o.label}</MenuItem>
              ))}
            </Select>
          )}
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
            {appCopy.ui.workspace.assetPanel.selectedForGeneration(selectedAssetIds.length)}
          </Typography>
        </div>
      )}
    </div>
  );
};
