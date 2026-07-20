import { useParams, useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { useWorkspaceContext } from '../runtime/useWorkspaceContext';
import { useWorkspaceProject } from '../runtime/WorkspaceProjectContext';
import { getProducerToolsForAsset } from '../runtime/toolAssetRegistry';
import { AssetLibraryView } from '../ui/AssetLibraryView';
import { LoadingStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';
import { appCopy } from '../../../app/copy/system';
import type { AssetType } from '@gen-app-2/contracts';
import '../ui/dashboard/dashboard-panels.css';

export const ProjectAssetsPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const ctx = useWorkspaceContext(workspaceId);
  const { isProjectLoading, projectError } = useWorkspaceProject();

  const copy = appCopy.ui.workspace;

  const handleCreateAction = useCallback(
    (assetType: string) => {
      const producerTools = getProducerToolsForAsset(assetType as AssetType);
      const toolKey = producerTools[0] ?? null;
      if (toolKey && workspaceId) {
        // Navigate to the producer tool so the user can generate this asset type.
        navigate(`/workspaces/${workspaceId}/tools/${toolKey}`);
      } else {
        // No producer tool available – refetch assets (e.g. after manual creation).
        ctx.refetch();
      }
    },
    [navigate, workspaceId, ctx],
  );

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
