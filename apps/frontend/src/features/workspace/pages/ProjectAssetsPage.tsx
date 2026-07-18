import { useParams, Link } from 'react-router-dom';
import { Typography, Breadcrumbs, Chip } from '@mui/material';
import { useWorkspaceContext } from '../runtime/useWorkspaceContext';
import { useApiConfig } from '../../../app/providers/AuthSessionProvider';
import { useProjectDetailQuery } from '../../../app/runtime/queries/useProjectDetailQuery';
import { ASSET_TYPE_LABELS, getProducerToolsForAsset } from '../runtime/toolAssetRegistry';
import { CreateAssetPrompt } from '../ui/CreateAssetPrompt';
import { LoadingStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';
import type { AssetType } from '@gen-app-2/contracts';
import '../ui/dashboard/dashboard-panels.css';

export const ProjectAssetsPage: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const ctx = useWorkspaceContext(workspaceId);
  const { apiBaseUrl, capabilities } = useApiConfig();
  const { data: project, loading: projectLoading, error: projectError, reload } = useProjectDetailQuery({
    projectId: workspaceId ?? '',
    apiBaseUrl,
    capabilities,
    enabled: Boolean(workspaceId),
  });

  if (projectLoading) return <LoadingStateMessage>Loading workspace...</LoadingStateMessage>;
  if (projectError) return <ErrorStateMessage>{projectError}</ErrorStateMessage>;
  if (!workspaceId) return null;

  const projectName = project?.name ?? workspaceId;

  return (
    <section className="workspace-assets-page" style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Breadcrumbs aria-label="workspace navigation" sx={{ mb: 2 }}>
        <Link to="/workspaces" style={{ textDecoration: 'none', color: '#1976d2' }}>
          Workspaces
        </Link>
        <Link to={`/workspaces/${workspaceId}`} style={{ textDecoration: 'none', color: '#1976d2' }}>
          {projectName}
        </Link>
        <Typography color="text.primary">Assets</Typography>
      </Breadcrumbs>

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
                  <div className="asset-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {assets.map(asset => (
                      <div key={asset.id} className="asset-item" style={{ padding: 12, border: '1px solid #e0e0e0', borderRadius: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {asset.label}
                          </Typography>
                          <div style={{ display: 'flex', gap: 8 }}>
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
                      </div>
                    ))}
                  </div>
                ) : (
                  <CreateAssetPrompt
                    assetType={type}
                    label={ASSET_TYPE_LABELS[type]}
                    projectId={workspaceId}
                    onCreateAction={reload}
                    isRequired={false}
                    producerTool={firstProducerTool}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <Link to={`/workspaces/${workspaceId}`} style={{ display: 'inline-block', marginTop: 24, textDecoration: 'none', color: '#1976d2' }}>
        Back to Workspace
      </Link>
    </section>
  );
};
