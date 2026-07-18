import { useParams } from 'react-router-dom';
import { useWorkspaceProject } from '../runtime/WorkspaceProjectContext';
import { SessionsListingSection } from '../../artifacts/ui/SessionsListingSection';
import { LoadingStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';

export const WorkspaceSessionsPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { projectName, isProjectLoading, projectError } = useWorkspaceProject();

  if (isProjectLoading) return <LoadingStateMessage>Loading workspace...</LoadingStateMessage>;
  if (projectError) return <ErrorStateMessage>{projectError}</ErrorStateMessage>;
  if (!workspaceId) return null;

  return (
    <section className="workspace-sessions-page">
      <SessionsListingSection
        title="Workspace Sessions"
        fixedProjectId={workspaceId}
        fixedProjectName={projectName}
        headingLevel="h2"
      />
    </section>
  );
};
