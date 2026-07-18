import { useMemo, useState } from 'react';
import { Button, Chip, Skeleton } from '@mui/material';
import { ArrowUpRight } from 'lucide-react';
import { useProjectArtifacts } from '../../runtime/useProjectArtifacts';
import { useWorkspaceContext } from '../../runtime/useWorkspaceContext';
import { getToolLabel } from '../../../tools/runtime/tool-form-architecture';
import { PromoteAssetDialog } from '../../../sessionsummary/ui/PromoteAssetDialog';
import { EmptyStateMessage, ErrorStateMessage } from '../../../../app/ui/primitives';

interface RecentArtifactsPanelProps {
  workspaceId: string;
}

const truncate = (text: string, maxLen: number): string =>
  text.length > maxLen ? text.slice(0, maxLen) + '…' : text;

const formatRelativeTime = (dateStr: string): string => {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
};

export const RecentArtifactsPanel: React.FC<RecentArtifactsPanelProps> = ({ workspaceId }) => {
  const artifactsQuery = useProjectArtifacts(workspaceId);
  const workspaceCtx = useWorkspaceContext(workspaceId);
  const [promoteDialogArtifactId, setPromoteDialogArtifactId] = useState<string | null>(null);

  // Build a Set of already-promoted artifact IDs
  const promotedArtifactIds = useMemo(() => {
    const ids = new Set<string>();
    for (const asset of workspaceCtx.assets) {
      if (asset.sourceArtifactId) ids.add(asset.sourceArtifactId);
    }
    return ids;
  }, [workspaceCtx.assets]);

  if (artifactsQuery.loading) {
    return (
      <div className="dashboard-panel">
        <div className="dashboard-panel__header">
          <span className="dashboard-panel__title">Recent Artifacts</span>
        </div>
        <div className="dashboard-panel__content">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} variant="rounded" height={52} sx={{ mb: 1 }} />
          ))}
        </div>
      </div>
    );
  }

  if (artifactsQuery.error) {
    return (
      <div className="dashboard-panel">
        <div className="dashboard-panel__header">
          <span className="dashboard-panel__title">Recent Artifacts</span>
        </div>
        <div className="dashboard-panel__content">
          <ErrorStateMessage>{artifactsQuery.error}</ErrorStateMessage>
        </div>
      </div>
    );
  }

  if (artifactsQuery.artifacts.length === 0) {
    return (
      <div className="dashboard-panel">
        <div className="dashboard-panel__header">
          <span className="dashboard-panel__title">Recent Artifacts</span>
        </div>
        <div className="dashboard-panel__content">
          <EmptyStateMessage>No recent artifacts. Run a tool to generate content.</EmptyStateMessage>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="dashboard-panel">
        <div className="dashboard-panel__header">
          <span className="dashboard-panel__title">Recent Artifacts</span>
        </div>
        <div>
          {artifactsQuery.artifacts.map(artifact => {
            const isPromoted = promotedArtifactIds.has(artifact.artifactId);
            const toolName = getToolLabel(artifact.toolKey);
            const contentPreview = truncate(artifact.content || '(no content)', 80);

            return (
              <div key={artifact.artifactId} className="recent-artifacts__item">
                <div className="recent-artifacts__preview">{contentPreview}</div>
                <div className="recent-artifacts__meta">
                  <span className="recent-artifacts__source">
                    {toolName} · {formatRelativeTime(artifact.updatedAt)}
                  </span>
                  {isPromoted ? (
                    <Chip label="Asset ✓" size="small" color="success" variant="outlined" />
                  ) : (
                    <Button
                      size="small"
                      variant="text"
                      endIcon={<ArrowUpRight size={12} />}
                      onClick={() => setPromoteDialogArtifactId(artifact.artifactId)}
                    >
                      Promote to Asset
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {promoteDialogArtifactId && (
        <PromoteAssetDialog
          open
          artifactId={promoteDialogArtifactId}
          projectId={workspaceId}
          onClose={() => setPromoteDialogArtifactId(null)}
          onPromoted={() => {
            setPromoteDialogArtifactId(null);
            artifactsQuery.refetch();
            workspaceCtx.refetch();
          }}
        />
      )}
    </>
  );
};
