import { useState } from 'react';
import {
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { Package, CheckCircle } from 'lucide-react';
import { getProducedAssetTypes, type ToolKey } from '@gen-app-2/contracts';
import { promoteArtifactToAsset } from '../../tools/runtime/asset-client';
import { ASSET_TYPE_LABELS } from '../../workspace/runtime/toolAssetRegistry';
import { appCopy } from '../../../app/copy/system';

interface PromoteAssetDialogProps {
  open: boolean;
  artifactId: string;
  projectId: string;
  toolKey: ToolKey;
  defaultLabel?: string;
  onClose: () => void;
  onPromoted?: () => void;
}

type DialogState = 'form' | 'loading' | 'success' | 'error';

export const PromoteAssetDialog: React.FC<PromoteAssetDialogProps> = ({
  open,
  artifactId,
  projectId,
  toolKey,
  defaultLabel = '',
  onClose,
  onPromoted,
}) => {
  // DDD-228: deterministic 1:1 mapping — each tool produces at most 1 AssetType
  // Caller gates with getProducedAssetTypes(toolKey).length === 1, so [0] is always defined
  const assetType = getProducedAssetTypes(toolKey)[0]!;
  const [label, setLabel] = useState(defaultLabel);
  const [state, setState] = useState<DialogState>('form');
  const [error, setError] = useState<string | null>(null);

  const copy = appCopy.ui.promoteDialog;

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
      setError(err instanceof Error ? err.message : copy.failedPromote);
      setState('error');
    }
  };

  const handleClose = () => {
    setState('form');
    setError(null);
    setLabel(defaultLabel);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Package size={20} />
        {copy.title}
      </DialogTitle>
      <DialogContent>
        {state === 'success' ? (
          <Alert severity="success" icon={<CheckCircle fontSize="inherit" />} sx={{ mb: 1 }}>
            {copy.successMessage}
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {copy.description}
            </Typography>
            <Chip
              label={ASSET_TYPE_LABELS[assetType]}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label={copy.labelField}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={ASSET_TYPE_LABELS[assetType]}
              helperText={copy.labelHelper}
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
          {state === 'success' ? copy.close : copy.cancel}
        </Button>
        {state !== 'success' && (
          <Button
            variant="contained"
            onClick={handlePromote}
            disabled={state === 'loading' || !label.trim()}
            startIcon={<Package size={14} />}
          >
            {state === 'loading' ? copy.promoting : copy.promote}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
