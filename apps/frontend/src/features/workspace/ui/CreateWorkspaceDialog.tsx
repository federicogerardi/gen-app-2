import { useState, useCallback, useEffect, useRef } from 'react';
import { useFeedbackMessage } from '../../../app/providers/FeedbackMessageProvider';
import { createProject } from '../../projects/runtime/projects-client';
import { appCopy } from '../../../app/copy/system';
import { Button, uiPrimitives } from '../../../app/ui/primitives';
import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';

import './dashboard/dashboard-panels.css';

const FOCUSABLE_SELECTORS = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const triggerRef = useRef<Element | null>(null);

  // Capture the previously-focused element when dialog opens
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
    // Return focus to trigger when dialog closes
    return () => {
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, [open]);

  // Focus trap: cycle Tab / Shift+Tab within the dialog
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        handleClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll(FOCUSABLE_SELECTORS);
      if (focusable.length === 0) return;

      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      setError(appCopy.ui.workspace.createDialog.nameRequired);
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
      setError(err instanceof Error ? err.message : appCopy.ui.workspace.createDialog.failedCreate);
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
      aria-label={appCopy.ui.workspace.createDialog.title}
    >
      <div className="workspace-hub-dialog" ref={dialogRef}>
        <h5 className="workspace-hub-dialog__title">{appCopy.ui.workspace.createDialog.title}</h5>

        <form onSubmit={handleSubmitForm} className="workspace-hub-dialog__form">
          <div className="workspace-hub-dialog__field">
            <label htmlFor="ws-dialog-name" className="workspace-hub-dialog__label">
              {appCopy.ui.workspace.createDialog.nameLabel}
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
              {appCopy.ui.workspace.createDialog.descriptionLabel}
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
              {loading ? appCopy.ui.workspace.createDialog.creating : appCopy.ui.workspace.createDialog.create}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
