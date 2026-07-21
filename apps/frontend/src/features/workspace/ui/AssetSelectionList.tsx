import { Checkbox, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import type { WorkspaceAsset } from '../runtime/useWorkspaceContext';
import { AssetTypeIcon } from './AssetTypeIcon';
import { QualityScoreBadge } from './QualityScoreBadge';
import { appCopy } from '../../../app/copy/system';

interface AssetSelectionListProps {
  assets: WorkspaceAsset[];
  selectedAssetIds: string[];
  onAssetToggle: (assetId: string, checked: boolean) => void;
}

export const AssetSelectionList: React.FC<AssetSelectionListProps> = ({
  assets,
  selectedAssetIds,
  onAssetToggle,
}) => {
  return (
    <List dense className="asset-selection-list">
      {assets.map((asset) => {
        const isSelected = selectedAssetIds.includes(asset.id);

        return (
          <ListItem key={asset.id} disablePadding>
            <ListItemButton
              onClick={() => onAssetToggle(asset.id, !isSelected)}
              dense
            >
              <ListItemIcon>
                <Checkbox
                  checked={isSelected}
                  tabIndex={-1}
                  disableRipple
                />
              </ListItemIcon>

              <AssetTypeIcon
                type={asset.assetType}
                size={16}
              />

              <ListItemText
                primary={asset.label}
              />
              <span className="asset-selection-list__meta">
                <QualityScoreBadge score={asset.qualityScore} size="small" />
                {asset.staleUpstream && (
                  <span className="asset-selection-list__stale">
                    {appCopy.ui.workspace.assetPanel.staleLabel}
                  </span>
                )}
              </span>
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
};
