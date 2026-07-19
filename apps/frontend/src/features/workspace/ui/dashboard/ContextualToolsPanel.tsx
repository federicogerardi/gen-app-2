import { Chip } from '@mui/material';
import { Link } from 'react-router-dom';
import { useWorkspaceContext } from '../../runtime/useWorkspaceContext';
import { getEnabledToolNavigationItems } from '../../../tools/runtime/tool-form-architecture';
import { DashboardPanel } from './DashboardPanel';
import { appCopy } from '../../../../app/copy/system';

// Foundation tools are shown in FoundationToolsPanel, not here
const FOUNDATION_TOOL_KEYS = new Set<string>(['brief-generator', 'tov-generator', 'personas-generator']);

interface ContextualToolsPanelProps {
  workspaceId: string;
}

export const ContextualToolsPanel: React.FC<ContextualToolsPanelProps> = ({ workspaceId }) => {
  const ctx = useWorkspaceContext(workspaceId);

  if (ctx.loading || ctx.error) {
    return (
      <DashboardPanel
        title={appCopy.ui.workspace.dashboard.availableToolsTitle}
        loading={ctx.loading}
        error={ctx.error}
      />
    );
  }

  const allToolItems = getEnabledToolNavigationItems('member', workspaceId);
  const toolItems = allToolItems.filter(item => !FOUNDATION_TOOL_KEYS.has(item.toolKey));
  const gapToolKeys = new Set(ctx.gaps.flatMap(g => g.canBeProducedBy));

  if (toolItems.length === 0) {
    return (
      <DashboardPanel
        title={appCopy.ui.workspace.dashboard.availableToolsTitle}
        empty={appCopy.ui.workspace.contextHeader.emptyTools}
      />
    );
  }

  return (
    <DashboardPanel title={appCopy.ui.workspace.dashboard.availableToolsTitle}>
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
                  label={hasGap ? appCopy.ui.workspace.contextHeader.actionNeeded : appCopy.ui.workspace.contextHeader.ready}
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
    </DashboardPanel>
  );
};
