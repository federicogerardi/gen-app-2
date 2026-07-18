import { Chip } from '@mui/material';
import { Link } from 'react-router-dom';
import { useWorkspaceContext } from '../../runtime/useWorkspaceContext';
import { getEnabledToolNavigationItems } from '../../../tools/runtime/tool-form-architecture';
import { LoadingStateMessage, EmptyStateMessage, ErrorStateMessage } from '../../../../app/ui/primitives';

// Foundation tools are shown in FoundationToolsPanel, not here
const FOUNDATION_TOOL_KEYS = new Set<string>(['brief-generator', 'tov-generator']);

interface ContextualToolsPanelProps {
  workspaceId: string;
}

export const ContextualToolsPanel: React.FC<ContextualToolsPanelProps> = ({ workspaceId }) => {
  const ctx = useWorkspaceContext(workspaceId);

  if (ctx.loading) return <LoadingStateMessage>Loading tools...</LoadingStateMessage>;
  if (ctx.error) return <ErrorStateMessage>{ctx.error}</ErrorStateMessage>;

  const allToolItems = getEnabledToolNavigationItems('member', workspaceId);
  const toolItems = allToolItems.filter(item => !FOUNDATION_TOOL_KEYS.has(item.toolKey));
  const gapToolKeys = new Set(ctx.gaps.flatMap(g => g.canBeProducedBy));

  if (toolItems.length === 0) {
    return (
      <div className="dashboard-panel">
        <div className="dashboard-panel__header">
          <span className="dashboard-panel__title">Available Tools</span>
        </div>
        <div className="dashboard-panel__content">
          <EmptyStateMessage>No tools available.</EmptyStateMessage>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-panel">
      <div className="dashboard-panel__header">
        <span className="dashboard-panel__title">Available Tools</span>
      </div>
      <div className="dashboard-panel__content">
        <div className="contextual-tools__grid">
          {toolItems.map(item => {
            const hasGap = gapToolKeys.has(item.toolKey);
            return (
              <Link
                key={item.toolKey}
                to={item.to}
                className="tool-card"
              >
                <div className="tool-card__header">
                  <span className="tool-card__name">{item.label}</span>
                  <Chip
                    label={hasGap ? 'Action needed' : 'Ready'}
                    size="small"
                    color={hasGap ? 'warning' : 'success'}
                    variant="outlined"
                  />
                </div>
                <div className="tool-card__description">{item.description}</div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};
