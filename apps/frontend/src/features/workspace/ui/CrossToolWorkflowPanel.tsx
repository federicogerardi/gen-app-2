import { useMemo } from 'react';
import { Typography } from '@mui/material';
import { Check, Clock, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ToolKey } from '@gen-app-2/contracts';
import { useWorkspaceContext } from '../runtime/useWorkspaceContext';
import { useToolRecommendations } from '../runtime/useToolRecommendations';
import { getToolLabel } from '../../tools/runtime/tool-form-architecture';
import './CrossToolWorkflowPanel.css';

interface CrossToolWorkflowPanelProps {
  workspaceId: string;
  currentToolKey?: string;
}

const TOOL_PIPELINE_ORDER: ToolKey[] = [
  'geometric', 'angle-generator', 'meta-ads', 'funnel-pages',
  'nextland', 'youtube-lf-script', 'youtube-description', 'blog-article-generator',
];

export const CrossToolWorkflowPanel: React.FC<CrossToolWorkflowPanelProps> = ({
  workspaceId,
  currentToolKey,
}) => {
  const ctx = useWorkspaceContext(workspaceId);
  const recommendations = useToolRecommendations(workspaceId, 'member', 3);

  const pipeline = useMemo(() => {
    const completedSet = new Set(ctx.workflowPosition?.completedSteps || []);
    const suggestedSet = new Set(recommendations.map(r => r.toolKey));

    return TOOL_PIPELINE_ORDER.map(toolKey => ({
      toolKey,
      status: completedSet.has(toolKey)
        ? 'completed'
        : suggestedSet.has(toolKey)
          ? 'suggested'
          : 'available',
      isCurrent: toolKey === currentToolKey,
    }));
  }, [ctx.workflowPosition, recommendations, currentToolKey]);

  if (ctx.loading || !ctx.workflowPosition) return null;

  return (
    <div className="cross-tool-workflow-panel">
      <Typography variant="subtitle2" className="cross-tool-workflow-panel__title">
        Cross-Tool Workflow
      </Typography>

      <div className="cross-tool-workflow-panel__pipeline">
        {pipeline.map((item, index) => (
          <div key={item.toolKey} className="cross-tool-workflow-panel__step-wrapper">
            {index > 0 && (
              <div className={`cross-tool-workflow-panel__connector cross-tool-workflow-panel__connector--${item.status}`} />
            )}
            <Link
              to={`/workspaces/${workspaceId}/tools/${item.toolKey}`}
              className={`cross-tool-workflow-panel__step cross-tool-workflow-panel__step--${item.status} ${item.isCurrent ? 'cross-tool-workflow-panel__step--current' : ''}`}
            >
              {item.status === 'completed' ? <Check size={14} /> :
               item.status === 'suggested' ? <Clock size={14} /> :
               <Circle size={14} />}
              <span className="cross-tool-workflow-panel__step-label">
                {getToolLabel(item.toolKey)}
              </span>
            </Link>
          </div>
        ))}
      </div>

      {recommendations.length > 0 && (
        <div className="cross-tool-workflow-panel__suggestions">
          <Typography variant="caption" color="text.secondary">
            Suggested next: {recommendations.map(r => r.label).join(', ')}
          </Typography>
        </div>
      )}
    </div>
  );
};
