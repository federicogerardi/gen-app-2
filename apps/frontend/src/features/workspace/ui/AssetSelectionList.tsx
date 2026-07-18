import { Checkbox, List, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import type { WorkspaceAsset } from '../runtime/useWorkspaceContext';
import { AssetTypeIcon } from './AssetTypeIcon';
import { QualityScoreBadge } from './QualityScoreBadge';

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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                <QualityScoreBadge score={asset.qualityScore} size="small" />
                {asset.staleUpstream && (
                  <span style={{ fontSize: '0.75rem', color: 'orange' }}>
                    Needs Update
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
