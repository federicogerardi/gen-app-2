import { Button } from '@mui/material';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useWorkspaceContext } from '../../runtime/useWorkspaceContext';
import { toolFormRegistry } from '../../../tools/runtime/tool-form-architecture';
import { LoadingStateMessage, EmptyStateMessage, ErrorStateMessage } from '../../../../app/ui/primitives';

interface SuggestedActionsPanelProps {
  workspaceId: string;
}

export const SuggestedActionsPanel: React.FC<SuggestedActionsPanelProps> = ({ workspaceId }) => {
  const ctx = useWorkspaceContext(workspaceId);

  if (ctx.loading) return <LoadingStateMessage>Loading suggestions...</LoadingStateMessage>;
  if (ctx.error) return <ErrorStateMessage>{ctx.error}</ErrorStateMessage>;

  const suggestedTools = ctx.workflowPosition?.suggestedNext ?? [];
  const actionableGaps = ctx.gaps.filter(g => g.canBeProducedBy.length > 0);

  if (suggestedTools.length === 0 && actionableGaps.length === 0) {
    return (
      <div className="dashboard-panel">
        <div className="dashboard-panel__header">
          <span className="dashboard-panel__title">Suggested Actions</span>
        </div>
        <div className="dashboard-panel__content">
          <EmptyStateMessage>No suggestions — workspace is fully loaded.</EmptyStateMessage>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel__header">
        <span className="dashboard-panel__title">Suggested Actions</span>
      </div>
      <div className="dashboard-panel__content">
        <div className="suggested-actions__list">
          {suggestedTools.map(toolKey => {
            const tool = toolFormRegistry[toolKey];
            const matchingGap = actionableGaps.find(g => g.canBeProducedBy.includes(toolKey));
            return (
              <div key={toolKey} className="suggested-action-card">
                <div className="suggested-action-card__info">
                  <div className="suggested-action-card__tool-name">
                    {tool?.displayName || toolKey}
                  </div>
                  {matchingGap && (
                    <div className="suggested-action-card__gap">
                      Produces: {matchingGap.assetType}
                    </div>
                  )}
                </div>
                <Button
                  component={Link}
                  to={`/workspaces/${workspaceId}/tools/${toolKey}`}
                  size="small"
                  variant="outlined"
                  endIcon={<ArrowRight size={14} />}
                >
                  Go
                </Button>
              </div>
            );
          })}
          {actionableGaps
            .filter(g => !suggestedTools.some(t => g.canBeProducedBy.includes(t)))
            .slice(0, 3)
            .map(gap => {
              const toolKey = gap.canBeProducedBy[0];
              return (
                <div key={gap.assetType} className="suggested-action-card">
                  <div className="suggested-action-card__info">
                    <div className="suggested-action-card__tool-name">
                      {toolFormRegistry[toolKey as keyof typeof toolFormRegistry]?.displayName || toolKey}
                    </div>
                    <div className="suggested-action-card__gap">
                      Missing: {gap.assetType}
                    </div>
                  </div>
                  <Button
                    component={Link}
                    to={`/workspaces/${workspaceId}/tools/${toolKey}`}
                    size="small"
                    variant="outlined"
                    endIcon={<ArrowRight size={14} />}
                  >
                    Go
                  </Button>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
