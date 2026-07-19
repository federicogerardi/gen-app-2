import { useParams, useNavigate } from 'react-router-dom';
import { Typography } from '@mui/material';
import { useCallback } from 'react';
import { useWorkspaceContext } from '../runtime/useWorkspaceContext';
import { useWorkspaceProject } from '../runtime/WorkspaceProjectContext';
import { getProducerToolsForAsset } from '../runtime/toolAssetRegistry';
import { AssetLibraryView } from '../ui/AssetLibraryView';
import { LoadingStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';
import type { AssetType } from '@gen-app-2/contracts';
import '../ui/dashboard/dashboard-panels.css';

export const ProjectAssetsPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const ctx = useWorkspaceContext(workspaceId);
  const { isProjectLoading, projectError } = useWorkspaceProject();

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

  if (isProjectLoading) return <LoadingStateMessage>Loading workspace...</LoadingStateMessage>;
  if (projectError) return <ErrorStateMessage>{projectError}</ErrorStateMessage>;
  if (!workspaceId) return null;

  return (
    <section className="workspace-assets-page">
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3 }}>
        Asset Library
      </Typography>

      {ctx.loading ? (
        <LoadingStateMessage>Loading assets...</LoadingStateMessage>
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
