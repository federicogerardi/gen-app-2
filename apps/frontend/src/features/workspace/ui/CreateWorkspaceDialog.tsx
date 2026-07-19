import { useState, useCallback, useEffect, useRef } from 'react';
import { useFeedbackMessage } from '../../../app/providers/FeedbackMessageProvider';
import { createProject } from '../../projects/runtime/projects-client';
import { appCopy } from '../../../app/copy/system';
import { Button, uiPrimitives } from '../../../app/ui/primitives';
import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';

import './dashboard/dashboard-panels.css';

interface CreateWorkspaceDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
}

export const CreateWorkspaceDialog: React.FC<CreateWorkspaceDialogProps> = ({
  open,
  onClose,
  onCreated,
  apiBaseUrl,
  capabilities,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { publishSuccess } = useFeedbackMessage();
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the name input when dialog opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createProject(
        { name: name.trim(), description: description.trim() },
        { apiBaseUrl, capabilities },
      );
      publishSuccess(appCopy.ui.feedback.projectsCreated);
      setName('');
      setDescription('');
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  }, [name, description, apiBaseUrl, capabilities, onCreated, onClose, publishSuccess]);

  // handleClose is used in the useEffect dependency above — suppress the lint rule
  const handleClose = useCallback(() => {
    if (!loading) {
      setName('');
      setDescription('');
      setError(null);
      onClose();
    }
  }, [loading, onClose]);

  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !loading) {
      handleClose();
    }
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  return (
    <div
      className="workspace-hub-dialog-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Create New Workspace"
    >
      <div className="workspace-hub-dialog workspace-hub-card" ref={dialogRef}>
        <h5 className="workspace-hub-dialog__title">Create New Workspace</h5>

        <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="workspace-hub-dialog__field">
            <label htmlFor="ws-dialog-name" className="workspace-hub-dialog__label">
              Workspace Name
            </label>
            <input
              ref={inputRef}
              id="ws-dialog-name"
              className="workspace-hub-dialog__input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              autoComplete="off"
            />
          </div>
          <div className="workspace-hub-dialog__field">
            <label htmlFor="ws-dialog-desc" className="workspace-hub-dialog__label">
              Description (optional)
            </label>
            <textarea
              id="ws-dialog-desc"
              className="workspace-hub-dialog__input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
            />
          </div>
          {error && (
            <p className={uiPrimitives.error}>{error}</p>
          )}
          <div className="workspace-hub-dialog__actions">
            <Button type="button" onClick={handleClose} disabled={loading}>
              {appCopy.ui.actions.cancel}
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
