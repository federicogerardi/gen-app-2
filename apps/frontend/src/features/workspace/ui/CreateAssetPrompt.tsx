import { useState } from 'react';
import { Button, TextField, Typography } from '@mui/material';
import { Plus, Upload } from 'lucide-react';
import { createAsset, type CreateAssetInput } from '../../tools/runtime/asset-client';

interface CreateAssetPromptProps {
  assetType: string;
  label: string;
  producerTool?: string | null;
  isRequired: boolean;
  projectId?: string;
  onCreateAction: () => void;
}

export const CreateAssetPrompt: React.FC<CreateAssetPromptProps> = ({
  assetType,
  label,
  producerTool,
  isRequired,
  projectId,
  onCreateAction,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [assetLabel, setAssetLabel] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleManualCreate = async () => {
    if (!projectId || !assetLabel.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const payload: CreateAssetInput = {
        projectId,
        assetType: assetType as CreateAssetInput['assetType'],
        source: 'manual',
        label: assetLabel.trim(),
      };
      const trimmedContent = content.trim();
      if (trimmedContent) {
        payload.content = trimmedContent;
      }
      await createAsset(payload);
      setShowForm(false);
      setAssetLabel('');
      setContent('');
      onCreateAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create asset');
    } finally {
      setLoading(false);
    }
  };

  if (showForm) {
    return (
      <div className="create-asset-prompt" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <TextField
          size="small"
          label={`${label} name`}
          value={assetLabel}
          onChange={(e) => setAssetLabel(e.target.value)}
          placeholder={`My ${label}`}
          autoFocus
        />
        <TextField
          size="small"
          label="Content (optional)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          multiline
          minRows={2}
          maxRows={6}
          placeholder={`Paste or type ${label.toLowerCase()} content...`}
        />
        {error && (
          <Typography variant="caption" color="error">{error}</Typography>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<Upload size={14} />}
            onClick={handleManualCreate}
            disabled={loading || !assetLabel.trim()}
          >
            {loading ? 'Creating...' : 'Create asset'}
          </Button>
          <Button
            size="small"
            onClick={() => { setShowForm(false); setError(null); }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="create-asset-prompt">
      <Typography variant="body2" color="text.secondary">
        {isRequired
          ? `${label} assets are required for optimal generation.`
          : `${label} assets would improve generation quality.`
        }
      </Typography>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {producerTool ? (
          <Button
            variant="contained"
            size="small"
            startIcon={<Plus size={14} />}
            onClick={onCreateAction}
            className="create-asset-prompt__button"
          >
            Generate with {producerTool}
          </Button>
        ) : (
          <Button
            variant="outlined"
            size="small"
            startIcon={<Plus size={14} />}
            onClick={() => setShowForm(true)}
          >
            Create manually
          </Button>
        )}
      </div>
    </div>
  );
};
