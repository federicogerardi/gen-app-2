import { useParams } from 'react-router-dom';
import { Typography, Chip } from '@mui/material';
import { useWorkspaceContext } from '../runtime/useWorkspaceContext';
import { useWorkspaceProject } from '../runtime/WorkspaceProjectContext';
import { ASSET_TYPE_LABELS, getProducerToolsForAsset } from '../runtime/toolAssetRegistry';
import { CreateAssetPrompt } from '../ui/CreateAssetPrompt';
import { LoadingStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';
import type { AssetType } from '@gen-app-2/contracts';
import '../ui/dashboard/dashboard-panels.css';

export const ProjectAssetsPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const ctx = useWorkspaceContext(workspaceId);
  const { isProjectLoading, projectError } = useWorkspaceProject();

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
        <div className="asset-library-grid">
          {(Object.keys(ASSET_TYPE_LABELS) as AssetType[]).map(type => {
            const assets = ctx.groupedByType[type] || [];
            const hasAssets = assets.length > 0;
            const producerTools = getProducerToolsForAsset(type);
            const firstProducerTool = producerTools[0] || null;

            return (
              <div key={type} className="asset-type-section" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {ASSET_TYPE_LABELS[type]}
                  </Typography>
                  {hasAssets && (
                    <Chip label={`${assets.length} ${assets.length === 1 ? 'asset' : 'assets'}`} size="small" color="primary" variant="outlined" />
                  )}
                </div>

                {hasAssets ? (
                  <div className="asset-list">
                    {assets.map(asset => (
                      <div key={asset.id} className="asset-page__item">
                        <div className="asset-page__item-label">
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {asset.label}
                          </Typography>
                        </div>
                        <div className="asset-page__item-meta">
                          <Chip
                            label={`${asset.qualityScore}% quality`}
                            size="small"
                            color={asset.qualityScore >= 80 ? 'success' : asset.qualityScore >= 50 ? 'warning' : 'error'}
                            variant="outlined"
                          />
                          {asset.staleUpstream && (
                            <Chip label="Stale" size="small" color="warning" variant="outlined" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <CreateAssetPrompt
                    assetType={type}
                    label={ASSET_TYPE_LABELS[type]}
                    projectId={workspaceId}
                    onCreateAction={ctx.refetch}
                    isRequired={false}
                    producerTool={firstProducerTool}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
