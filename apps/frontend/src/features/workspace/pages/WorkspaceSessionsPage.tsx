import { useParams, Link } from 'react-router-dom';
import { Typography, Breadcrumbs } from '@mui/material';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useProjectDetailQuery } from '../../../app/runtime/queries/useProjectDetailQuery';
import { SessionsListingSection } from '../../artifacts/ui/SessionsListingSection';
import { LoadingStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';
import '../ui/dashboard/dashboard-panels.css';

export const WorkspaceSessionsPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { apiBaseUrl, capabilities } = useApiConfig();
  const { data: project, loading, error } = useProjectDetailQuery({
    projectId: workspaceId ?? '',
    apiBaseUrl,
    capabilities,
    enabled: Boolean(workspaceId),
  });

  if (loading) return <LoadingStateMessage>Loading workspace...</LoadingStateMessage>;
  if (error) return <ErrorStateMessage>{error}</ErrorStateMessage>;
  if (!workspaceId) return null;

  const projectName = project?.name ?? workspaceId;

  return (
    <section className="workspace-sessions-page" style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Breadcrumbs aria-label="workspace navigation" sx={{ mb: 2 }}>
        <Link to="/workspaces" style={{ textDecoration: 'none', color: '#1976d2' }}>
          Workspaces
        </Link>
        <Link to={`/workspaces/${workspaceId}`} style={{ textDecoration: 'none', color: '#1976d2' }}>
          {projectName}
        </Link>
        <Typography color="text.primary">Sessions</Typography>
      </Breadcrumbs>

      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Workspace Sessions
      </Typography>

      <SessionsListingSection
        title="Workspace Sessions"
        fixedProjectId={workspaceId}
        fixedProjectName={projectName}
        headingLevel="h2"
      />
    </section>
  );
};
