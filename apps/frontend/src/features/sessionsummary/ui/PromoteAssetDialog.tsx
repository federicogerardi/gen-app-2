import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Typography,
  Alert,
} from '@mui/material';
import { Package, CheckCircle } from 'lucide-react';
import { ASSET_TYPES, type AssetType } from '@gen-app-2/contracts';
import { promoteArtifactToAsset } from '../../tools/runtime/asset-client';

interface PromoteAssetDialogProps {
  open: boolean;
  artifactId: string;
  projectId: string;
  defaultLabel?: string;
  onClose: () => void;
  onPromoted?: () => void;
}

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  'angle': 'Angle',
  'persona': 'Persona',
  'brand-voice': 'Brand Voice',
  'hook': 'Hook',
  'competitor-analysis': 'Competitor Analysis',
  'creative-brief': 'Creative Brief',
  'ad-copy': 'Ad Copy',
  'landing-page': 'Landing Page',
  'article-outline': 'Article Outline',
  'article': 'Article',
  'script': 'Script',
  'description': 'Description',
};

type DialogState = 'form' | 'loading' | 'success' | 'error';

export const PromoteAssetDialog: React.FC<PromoteAssetDialogProps> = ({
  open,
  artifactId,
  projectId,
  defaultLabel = '',
  onClose,
  onPromoted,
}) => {
  const [assetType, setAssetType] = useState<AssetType>('angle');
  const [label, setLabel] = useState(defaultLabel);
  const [state, setState] = useState<DialogState>('form');
  const [error, setError] = useState<string | null>(null);

  const handlePromote = async () => {
    setState('loading');
    setError(null);
    try {
      await promoteArtifactToAsset({
        artifactId,
        projectId,
        assetType,
        label: label.trim() || ASSET_TYPE_LABELS[assetType],
      });
      setState('success');
      setTimeout(() => {
        onClose();
        onPromoted?.();
        setState('form');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to promote artifact');
      setState('error');
    }
  };

  const handleClose = () => {
    setState('form');
    setError(null);
    setLabel(defaultLabel);
    setAssetType('angle');
    onClose();
  };

  return (
    <Dialog open={open} onClose={state === 'success' ? handleClose : handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Package size={20} />
        Promote to Asset
      </DialogTitle>
      <DialogContent>
        {state === 'success' ? (
          <Alert severity="success" icon={<CheckCircle fontSize="inherit" />} sx={{ mb: 1 }}>
            Asset creato con successo! Disponibile nel workspace.
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Convert this generated artifact into a reusable asset in your workspace.
            </Typography>
            <TextField
              select
              fullWidth
              label="Asset Type"
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as AssetType)}
              sx={{ mb: 2 }}
              disabled={state === 'loading'}
            >
              {ASSET_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {ASSET_TYPE_LABELS[type]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              label="Label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={ASSET_TYPE_LABELS[assetType]}
              helperText="A descriptive name for this asset"
              disabled={state === 'loading'}
            />
            {error && (
              <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                {error}
              </Typography>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={state === 'loading'}>
          {state === 'success' ? 'Close' : 'Cancel'}
        </Button>
        {state !== 'success' && (
          <Button
            variant="contained"
            onClick={handlePromote}
            disabled={state === 'loading' || !label.trim()}
            startIcon={<Package size={14} />}
          >
            {state === 'loading' ? 'Promoting...' : 'Promote'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
