import { useParams } from 'react-router-dom';
import { useWorkspaceContext } from '../runtime/useWorkspaceContext';
import { useWorkspaceProject } from '../runtime/WorkspaceProjectContext';
import { useAssetCreateNavigation } from '../runtime/useAssetCreateNavigation';
import { AssetLibraryView } from '../ui/AssetLibraryView';
import { LoadingStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';
import { appCopy } from '../../../app/copy/system';
import '../ui/dashboard/dashboard-panels.css';

export const ProjectAssetsPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const ctx = useWorkspaceContext(workspaceId);
  const { isProjectLoading, projectError } = useWorkspaceProject();

  const copy = appCopy.ui.workspace;

  const handleCreateAction = useAssetCreateNavigation(workspaceId, ctx.refetch);

  if (isProjectLoading) return <LoadingStateMessage>{copy.dashboard.loadingAssets ?? 'Loading workspace...'}</LoadingStateMessage>;
  if (projectError) return <ErrorStateMessage>{projectError}</ErrorStateMessage>;
  if (!workspaceId) return null;

  return (
    <section className="workspace-assets-page">
      <h1 className="workspace-assets-page__title">
        {copy.dashboard.assetLibraryTitle}
      </h1>

      {ctx.loading ? (
        <LoadingStateMessage>{copy.dashboard.loadingAssets ?? 'Loading assets...'}</LoadingStateMessage>
      ) : ctx.error ? (
        <ErrorStateMessage>{ctx.error}</ErrorStateMessage>
      ) : (
        <AssetLibraryView
          workspaceId={workspaceId}
          groupedByType={ctx.groupedByType}
          onCreateAction={handleCreateAction}
        />
      )}
    </section>
  );
};
