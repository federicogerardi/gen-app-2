import { Link } from 'react-router-dom';
import { Chip, Typography } from '@mui/material';
import { ArrowRight, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useProjectsQuery } from '../../../app/runtime/queries/useProjectsQuery';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useWorkspaceContext } from '../runtime/useWorkspaceContext';
import { Surface, LoadingStateMessage, EmptyStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';
import type { ProjectSummary } from '../../../features/projects/runtime/projects-client';

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

const WorkspaceCard: React.FC<{ project: ProjectSummary }> = ({ project }) => {
  const ctx = useWorkspaceContext(project.id);
  const GateIcon = ctx.qualityGateStatus ? GATE_ICONS[ctx.qualityGateStatus] : CheckCircle;
  const gateColor = ctx.qualityGateStatus ? GATE_COLORS[ctx.qualityGateStatus] : 'default';

  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel__content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
              {project.name}
            </Typography>
            {project.description && (
              <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.5 }}>
                {project.description}
              </Typography>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <Typography variant="caption" color="text.secondary">
                {ctx.assets.length} {ctx.assets.length === 1 ? 'asset' : 'assets'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ·
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {ctx.overallQualityScore}% quality
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ·
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {ctx.workflowPosition?.completedSteps.length ?? 0}/{ctx.workflowPosition?.totalSteps ?? 8} tools
              </Typography>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Chip
              icon={<GateIcon size={14} />}
              label={ctx.qualityGateStatus === 'healthy' ? 'Ready' : ctx.qualityGateStatus === 'needs-attention' ? 'Review' : 'Blocked'}
              color={gateColor}
              size="small"
              variant="outlined"
            />
            <Link
              to={`/workspaces/${project.id}`}
              style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
            >
              <ArrowRight size={18} color="inherit" />
            </Link>
          </div>
        </div>
      </div>
    </div>
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
    <section style={{ padding: 24, maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Typography variant="h5" sx={{ fontWeight: 600 }}>Workspaces</Typography>
      {projects.map(project => (
        <WorkspaceCard key={project.id} project={project} />
      ))}
    </section>
  );
};
