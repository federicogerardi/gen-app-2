import { useParams, Outlet, useMatch } from 'react-router-dom';
import { Alert, Button } from '@mui/material';
import { RefreshCw } from 'lucide-react';
import { useCallback } from 'react';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useProjectDetailQuery } from '../../../app/runtime/queries/useProjectDetailQuery';
import { WorkspaceProjectProvider } from '../runtime/WorkspaceProjectContext';
import { WorkspaceSectionNav } from '../ui/WorkspaceSectionNav';
import { updateProject } from '../../../features/projects/runtime/projects-client';
import { appCopy } from '../../../app/copy/system';
import '../ui/WorkspaceSectionNav.css';

export const WorkspaceLayout: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { apiBaseUrl, capabilities } = useApiConfig();
  const { data: project, loading, error, reload } = useProjectDetailQuery({
    projectId: workspaceId ?? '',
    apiBaseUrl,
    capabilities,
    enabled: Boolean(workspaceId),
  });

  const isToolRoute = Boolean(useMatch('/workspaces/:workspaceId/tools/:toolKey'));
  const isSessionDetail = Boolean(useMatch('/workspaces/:workspaceId/sessions/:sessionId'));
  const showSectionNav = !isToolRoute && !isSessionDetail;

  const handleReactivate = useCallback(async () => {
    if (!workspaceId) return;
    await updateProject(workspaceId, { status: 'active' });
    reload();
  }, [workspaceId, reload]);

  if (!workspaceId) return null;

  const projectName = project?.name ?? workspaceId;
  const isArchived = project?.status === 'archived';

  return (
    <WorkspaceProjectProvider value={{
      workspaceId, projectName, isArchived,
      isProjectLoading: loading, projectError: error, refetchProject: reload,
    }}>
      <div className="workspace-layout">
        {isArchived && (
          <Alert severity="warning" className="workspace-layout__archive-alert"
            action={
              <Button color="inherit" size="small" startIcon={<RefreshCw size={16} />}
                onClick={handleReactivate}>
                {appCopy.ui.workspace.contextHeader.reactivateAction}
              </Button>
            }>
            {appCopy.ui.workspace.contextHeader.archiveAlertMessage}
          </Alert>
        )}

        {showSectionNav && <WorkspaceSectionNav />}

        <main className="workspace-layout__content">
          <Outlet />
        </main>
      </div>
    </WorkspaceProjectProvider>
  );
};
