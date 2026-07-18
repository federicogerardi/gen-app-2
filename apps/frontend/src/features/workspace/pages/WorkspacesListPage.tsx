import { Link } from 'react-router-dom';
import { Chip, Typography, IconButton, Menu, MenuItem, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { CheckCircle, AlertTriangle, XCircle, MoreHorizontal, Archive, RefreshCw, Plus } from 'lucide-react';
import { useState, useCallback } from 'react';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useWorkspaceContext } from '../runtime/useWorkspaceContext';
import { updateProject, createProject } from '../../../features/projects/runtime/projects-client';
import { LoadingStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';
import type { ProjectSummary } from '../../../features/projects/runtime/projects-client';
import '../ui/dashboard/dashboard-panels.css';

const GATE_ICONS = {
  healthy: CheckCircle,
  'needs-attention': AlertTriangle,
  blocked: XCircle,
} as const;

const GATE_COLORS = {
  healthy: 'success' as const,
  'needs-attention': 'warning' as const,
  blocked: 'error' as const,
} as const;

const GATE_LABELS = {
  healthy: 'Ready',
  'needs-attention': 'Review',
  blocked: 'Blocked',
} as const;

const CreateWorkspaceDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  apiBaseUrl: string;
  capabilities: ReturnType<typeof useApiConfig>['capabilities'];
}> = ({ open, onClose, onCreated, apiBaseUrl, capabilities }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createProject({ name: name.trim(), description: description.trim() }, { apiBaseUrl, capabilities });
      setName('');
      setDescription('');
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  }, [name, description, apiBaseUrl, capabilities, onCreated, onClose]);

  const handleClose = useCallback(() => {
    if (!loading) {
      setName('');
      setDescription('');
      setError(null);
      onClose();
    }
  }, [loading, onClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Workspace</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Workspace Name"
          fullWidth
          variant="outlined"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={Boolean(error)}
          helperText={error}
          disabled={loading}
        />
        <TextField
          margin="dense"
          label="Description (optional)"
          fullWidth
          variant="outlined"
          multiline
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading || !name.trim()}>
          {loading ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const WorkspaceCard: React.FC<{ project: ProjectSummary; onStatusChange: () => void }> = ({ project, onStatusChange }) => {
  const ctx = useWorkspaceContext(project.id);
  const GateIcon = ctx.qualityGateStatus ? GATE_ICONS[ctx.qualityGateStatus] : CheckCircle;
  const gateColor = ctx.qualityGateStatus ? GATE_COLORS[ctx.qualityGateStatus] : 'default';
  const gateLabel = ctx.qualityGateStatus ? GATE_LABELS[ctx.qualityGateStatus] : 'Ready';

  const toolsCompleted = ctx.workflowPosition?.completedSteps.length ?? 0;
  const toolsTotal = ctx.workflowPosition?.totalSteps ?? 8;

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isArchived = project.status === 'archived';

  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleToggleStatus = useCallback(async () => {
    const newStatus = isArchived ? 'active' : 'archived';
    await updateProject(project.id, { status: newStatus });
    handleMenuClose();
    onStatusChange();
  }, [project.id, isArchived, handleMenuClose, onStatusChange]);

  return (
    <Link
      to={`/workspaces/${project.id}`}
      className="workspace-list-card"
      style={{
        textDecoration: 'none',
        color: 'inherit',
        opacity: isArchived ? 0.6 : 1,
        backgroundColor: isArchived ? '#f5f5f5' : undefined,
      }}
    >
      <div className="workspace-list-card__inner">
        <div className="workspace-list-card__main">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
              {project.name}
            </Typography>
            {isArchived && (
              <Chip label="Archived" size="small" color="default" variant="outlined" />
            )}
          </div>
          {project.description && (
            <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.25 }}>
              {project.description}
            </Typography>
          )}
          <div className="workspace-list-card__stats">
            <span className="workspace-list-card__stat">
              {ctx.assets.length} {ctx.assets.length === 1 ? 'asset' : 'assets'}
            </span>
            <span className="workspace-list-card__stat-sep">·</span>
            <span className="workspace-list-card__stat">
              {ctx.overallQualityScore}% quality
            </span>
            <span className="workspace-list-card__stat-sep">·</span>
            <span className="workspace-list-card__stat">
              {toolsCompleted}/{toolsTotal} tools
            </span>
          </div>
        </div>

        <div className="workspace-list-card__actions">
          <Chip
            icon={<GateIcon size={14} />}
            label={gateLabel}
            color={gateColor}
            size="small"
            variant="outlined"
          />
          <IconButton
            size="small"
            onClick={handleMenuOpen}
            aria-label="workspace actions"
          >
            <MoreHorizontal size={16} />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
          <MenuItem onClick={handleToggleStatus}>
            {isArchived ? <RefreshCw size={16} /> : <Archive size={16} />}
            <span style={{ marginLeft: 8 }}>{isArchived ? 'Reactivate Workspace' : 'Archive Workspace'}</span>
          </MenuItem>
          </Menu>
        </div>
      </div>
    </Link>
  );
};

export const WorkspacesListPage: React.FC = () => {
  const { apiBaseUrl, capabilities } = useApiConfig();
  const { data: projects, loading, error, reload } = useProjectsQuery({ apiBaseUrl, capabilities });
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleStatusChange = useCallback(() => {
    reload();
  }, [reload]);

  const handleCreated = useCallback(() => {
    reload();
  }, [reload]);

  if (loading) return <LoadingStateMessage>Loading workspaces...</LoadingStateMessage>;
  if (error) return <ErrorStateMessage>{error}</ErrorStateMessage>;

  return (
    <section className="workspace-list-page">
      <div className="workspace-list-page__header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>Workspaces</Typography>
          <Button
            variant="contained"
            startIcon={<Plus size={18} />}
            onClick={() => setDialogOpen(true)}
          >
            New Workspace
          </Button>
        </div>
        <Typography variant="body2" color="text.secondary">
          {projects.length} {projects.length === 1 ? 'workspace' : 'workspaces'} available
        </Typography>
      </div>
      <div className="workspace-list-page__cards">
        {projects.map(project => (
          <WorkspaceCard key={project.id} project={project} onStatusChange={handleStatusChange} />
        ))}
      </div>

      <CreateWorkspaceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
        apiBaseUrl={apiBaseUrl}
        capabilities={capabilities}
      />
    </section>
  );
};
