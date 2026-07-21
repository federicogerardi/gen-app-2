import { type ReactNode } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import type { SupportedTool } from '../../tools/machines/tool-flow.machine';
import { useWorkspaceContext } from '../runtime/useWorkspaceContext';
import { WorkspaceProvider } from '../runtime/WorkspaceProvider';
import { WorkspaceContextHeader } from './WorkspaceContextHeader';
import { LoadingStateMessage, ErrorStateMessage } from '../../../app/ui/primitives';
import './WorkspaceContextHeader.css';

interface WorkspaceToolWrapperProps {
  toolKey: SupportedTool;
  children: ReactNode;
}

export const WorkspaceToolWrapper: React.FC<WorkspaceToolWrapperProps> = ({
  toolKey,
  children,
}) => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const workspaceContext = useWorkspaceContext(workspaceId, toolKey);

  if (workspaceContext.loading) {
    return <LoadingStateMessage>Loading workspace context...</LoadingStateMessage>;
  }

  if (workspaceContext.error) {
    return <ErrorStateMessage>Error loading workspace: {workspaceContext.error}</ErrorStateMessage>;
  }

  if (!workspaceId) {
    return <Navigate to="/workspaces" replace />;
  }

  return (
    <div className="workspace-tool-wrapper">
      <WorkspaceContextHeader
        currentTool={toolKey}
        assetCount={workspaceContext.assets.length}
        qualityGateStatus={workspaceContext.qualityGateStatus}
        {...(workspaceContext.workflowPosition ? { crossToolPosition: workspaceContext.workflowPosition } : {})}
      />

      <WorkspaceProvider value={workspaceContext}>
        {children}
      </WorkspaceProvider>
    </div>
  );
};
