import { useCallback, useMemo } from 'react';
import { Button, Chip, Collapse, IconButton, Typography } from '@mui/material';
import { ChevronDown, ChevronRight, Minus, Plus } from 'lucide-react';
import type { WorkspaceAsset } from '../runtime/useWorkspaceContext';
import { AssetTypeIcon } from './AssetTypeIcon';
import { QualityScoreBadge } from './QualityScoreBadge';
import { AssetSelectionList } from './AssetSelectionList';
import { CreateAssetPrompt } from './CreateAssetPrompt';
import { appCopy } from '../../../app/copy/system';
import './AssetGroupSection.css';

interface AssetGroupSectionProps {
  assetType: string;
  label: string;
  requiredness: 'always-required' | 'optional-by-tool-setting' | 'never-required';
  assets: WorkspaceAsset[];
  isExpanded: boolean;
  selectedAssetIds: string[];
  producerTool?: string | null;
  projectId?: string;
  mode?: 'select' | 'browse';
  onToggleExpanded: (expanded: boolean) => void;
  onAssetToggle: (assetId: string, checked: boolean) => void;
  onCreateAction: () => void;
}

export const AssetGroupSection: React.FC<AssetGroupSectionProps> = ({
  assetType,
  label,
  requiredness,
  assets,
  isExpanded,
  selectedAssetIds,
  producerTool,
  projectId,
  mode = 'select',
  onToggleExpanded,
  onAssetToggle,
  onCreateAction,
}) => {
  const hasAssets = assets.length > 0;
  const isRequired = requiredness === 'always-required';

  const groupQualityScore = useMemo(() => {
    if (!hasAssets) return 0;
    const totalScore = assets.reduce((sum, asset) => sum + asset.qualityScore, 0);
    return Math.round(totalScore / assets.length);
  }, [assets, hasAssets]);

  const selectedAssetsInGroup = useMemo(
    () => assets.filter(asset => selectedAssetIds.includes(asset.id)).length,
    [assets, selectedAssetIds],
  );

  const handleHeaderClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).closest('button, .MuiChip-root')) {
      return;
    }
    onToggleExpanded(!isExpanded);
  }, [isExpanded, onToggleExpanded]);

  const handleSelectAllInGroup = useCallback(() => {
    const allAssetIds = assets.map(a => a.id);
    const allSelected = allAssetIds.every(id => selectedAssetIds.includes(id));

    if (allSelected) {
      allAssetIds.forEach(id => onAssetToggle(id, false));
    } else {
      allAssetIds.forEach(id => {
        if (!selectedAssetIds.includes(id)) {
          onAssetToggle(id, true);
        }
      });
    }
  }, [assets, selectedAssetIds, onAssetToggle]);

  return (
    <div className={`asset-group-section asset-group-section--${assetType}`}>
      <div
        className="asset-group-section__header"
        onClick={handleHeaderClick}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpanded(!isExpanded);
          }
        }}
      >
        <div className="asset-group-section__header-left">
          <IconButton
            size="small"
            className="asset-group-section__expand-button"
            aria-label={isExpanded ? appCopy.ui.workspace.assetPanel.collapseGroup : appCopy.ui.workspace.assetPanel.expandGroup}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpanded(!isExpanded);
            }}
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </IconButton>

          <AssetTypeIcon size={18} type={assetType} className="asset-group-section__type-icon" />

          <Typography variant="subtitle2" className="asset-group-section__title">
            {label} ({assets.length})
          </Typography>

          {isRequired && (
            <Chip
              label={appCopy.ui.workspace.assetPanel.groupRequiredLabel}
              size="small"
              color="error"
              variant="outlined"
            />
          )}
        </div>

        <div className="asset-group-section__header-right">
          {hasAssets ? (
            <>
              <QualityScoreBadge score={groupQualityScore} size="small" />
              {selectedAssetsInGroup > 0 && (
                <Chip
                  label={`${selectedAssetsInGroup} ${appCopy.ui.workspace.assetPanel.selectedCount}`}
                  size="small"
                  color="primary"
                />
              )}
            </>
          ) : (
            <Chip
              label={isRequired
                ? appCopy.ui.workspace.assetPanel.groupMissingRequired
                : appCopy.ui.workspace.assetPanel.groupMissingOptional
              }
              size="small"
              color={isRequired ? 'error' : 'default'}
              variant="outlined"
            />
          )}
        </div>
      </div>

      <Collapse in={isExpanded}>
        <div className="asset-group-section__content">
          {hasAssets ? (
            mode === 'browse' ? (
              <div className="asset-group-section__browse-list">
                {assets.map(asset => (
                  <div key={asset.id} className="asset-group-section__browse-item">
                    <span className="asset-group-section__browse-label">{asset.label}</span>
                    <QualityScoreBadge score={asset.qualityScore} size="small" />
                    {asset.staleUpstream && (
                      <Chip label={appCopy.ui.workspace.assetPanel.staleLabel} size="small" color="warning" variant="outlined" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="asset-group-section__controls">
                  <Button
                    size="small"
                    variant="text"
                    onClick={handleSelectAllInGroup}
                    startIcon={selectedAssetsInGroup === assets.length ? <Minus size={14} /> : <Plus size={14} />}
                  >
                    {selectedAssetsInGroup === assets.length
                      ? appCopy.ui.workspace.assetPanel.deselectAll
                      : appCopy.ui.workspace.assetPanel.selectAll}
                  </Button>
                </div>

                <AssetSelectionList
                  assets={assets}
                  selectedAssetIds={selectedAssetIds}
                  onAssetToggle={onAssetToggle}
                />
              </>
            )
          ) : (
              <CreateAssetPrompt
              assetType={assetType}
              label={label}
              producerTool={producerTool ?? null}
              isRequired={isRequired}
              {...(projectId !== undefined ? { projectId } : {})}
              onCreateAction={onCreateAction}
            />
          )}

          {hasAssets && producerTool && (
            <div className="asset-group-section__actions">
              <Button
                size="small"
                variant="outlined"
                startIcon={<Plus size={14} />}
                onClick={onCreateAction}
                className="asset-group-section__generate-more-button"
              >
                {appCopy.ui.workspace.assetPanel.generateMoreAction} {label}
              </Button>
            </div>
          )}
        </div>
      </Collapse>
    </div>
  );
};
