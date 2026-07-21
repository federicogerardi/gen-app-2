import { useParams } from 'react-router-dom';
import { useWorkspaceProject } from '../runtime/WorkspaceProjectContext';
import { SessionsListingSection } from '../../artifacts/ui/SessionsListingSection';
import { LoadingStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';
import { appCopy } from '../../../app/copy/system';
import '../ui/dashboard/dashboard-panels.css';

export const WorkspaceSessionsPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { projectName, isProjectLoading, projectError } = useWorkspaceProject();

  if (isProjectLoading) return <LoadingStateMessage>{appCopy.ui.workspace.dashboard.loadingWorkspace}</LoadingStateMessage>;
  if (projectError) return <ErrorStateMessage>{projectError}</ErrorStateMessage>;
  if (!workspaceId) return null;

  return (
    <section className="workspace-sessions-page">
      <SessionsListingSection
        title={appCopy.ui.workspace.dashboard.workspaceSessions}
        fixedProjectId={workspaceId}
        fixedProjectName={projectName}
        headingLevel="h2"
      />
    </section>
  );
};
