import { useState, useRef } from 'react';
import { Button, TextField, Typography } from '@mui/material';
import { Plus, Upload, FileText } from 'lucide-react';
import { createAsset, type CreateAssetInput } from '../../tools/runtime/asset-client';
import { appCopy } from '../../../app/copy/system';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const copy = appCopy.ui.workspace.createAsset;

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
      setError(err instanceof Error ? err.message : copy.failedCreate);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const text = await file.text();
      await createAsset({
        projectId,
        assetType: assetType as CreateAssetInput['assetType'],
        source: 'uploaded' as const,
        label: file.name.replace(/\.[^/.]+$/, ''),
        content: text,
      });
      onCreateAction();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failedUpload);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (showForm) {
    return (
      <div className="create-asset-prompt" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <TextField
          size="small"
          label={copy.nameLabel(label)}
          value={assetLabel}
          onChange={(e) => setAssetLabel(e.target.value)}
          placeholder={copy.namePlaceholder(label)}
          autoFocus
        />
        <TextField
          size="small"
          label={copy.contentLabel}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          multiline
          minRows={2}
          maxRows={6}
          placeholder={copy.contentPlaceholder(label)}
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
            {loading ? copy.creating : copy.createAsset}
          </Button>
          <Button
            size="small"
            onClick={() => { setShowForm(false); setError(null); }}
          >
            {copy.cancel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="create-asset-prompt">
      <Typography variant="body2" color="text.secondary">
        {isRequired
          ? copy.requiredHint(label)
          : copy.optionalHint(label)
        }
      </Typography>

      {/* Hidden file input for upload (all asset types) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.docx"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={loading}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {producerTool ? (
          <Button
            variant="contained"
            size="small"
            startIcon={<Plus size={14} />}
            onClick={onCreateAction}
            className="create-asset-prompt__button"
          >
            {copy.generateWith(producerTool)}
          </Button>
        ) : (
          <>
            <Button
              variant="contained"
              size="small"
              startIcon={<FileText size={14} />}
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              {loading ? copy.uploading : copy.uploadFile}
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Plus size={14} />}
              onClick={() => setShowForm(true)}
            >
              {copy.pasteText}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
