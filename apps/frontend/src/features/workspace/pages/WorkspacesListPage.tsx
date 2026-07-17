import { Link } from 'react-router-dom';
import { Chip, Typography } from '@mui/material';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useWorkspaceContext } from '../runtime/useWorkspaceContext';
import { Surface, LoadingStateMessage, EmptyStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';
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

const WorkspaceCard: React.FC<{ project: ProjectSummary }> = ({ project }) => {
  const ctx = useWorkspaceContext(project.id);
  const GateIcon = ctx.qualityGateStatus ? GATE_ICONS[ctx.qualityGateStatus] : CheckCircle;
  const gateColor = ctx.qualityGateStatus ? GATE_COLORS[ctx.qualityGateStatus] : 'default';
  const gateLabel = ctx.qualityGateStatus ? GATE_LABELS[ctx.qualityGateStatus] : 'Ready';

  const toolsCompleted = ctx.workflowPosition?.completedSteps.length ?? 0;
  const toolsTotal = ctx.workflowPosition?.totalSteps ?? 8;

  return (
    <Link
      to={`/workspaces/${project.id}`}
      className="workspace-list-card"
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div className="workspace-list-card__inner">
        <div className="workspace-list-card__main">
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
            {project.name}
          </Typography>
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
          <Typography variant="caption" color="primary" sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
            Apri workspace
          </Typography>
        </div>
      </div>
    </Link>
  );
};

export const WorkspacesListPage: React.FC = () => {
  const { apiBaseUrl, capabilities } = useApiConfig();
  const { data: projects, loading, error } = useProjectsQuery({ apiBaseUrl, capabilities });

  if (loading) return <LoadingStateMessage>Loading workspaces...</LoadingStateMessage>;
  if (error) return <ErrorStateMessage>{error}</ErrorStateMessage>;

  if (!projects || projects.length === 0) {
    return (
      <Surface as="section" style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        <EmptyStateMessage>
          No workspaces yet. Create your first project to get started.
        </EmptyStateMessage>
      </Surface>
    );
  }

  return (
    <section className="workspace-list-page">
      <div className="workspace-list-page__header">
        <Typography variant="h5" sx={{ fontWeight: 600 }}>Workspaces</Typography>
        <Typography variant="body2" color="text.secondary">
          {projects.length} {projects.length === 1 ? 'workspace' : 'workspaces'} available
        </Typography>
      </div>
      <div className="workspace-list-page__cards">
        {projects.map(project => (
          <WorkspaceCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
};
