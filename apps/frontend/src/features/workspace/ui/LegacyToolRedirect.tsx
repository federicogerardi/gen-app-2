import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGenerationProjectWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { LoadingStateMessage } from '../../../app/ui/primitives';

export const LegacyToolRedirect: React.FC = () => {
  const { toolKey } = useParams<{ toolKey: string }>();
  const navigate = useNavigate();
  const { focusedProjectId } = useGenerationProjectWorkspace();

  useEffect(() => {
    if (toolKey && focusedProjectId) {
      navigate(`/workspaces/${focusedProjectId}/tools/${toolKey}`, { replace: true });
    } else if (toolKey) {
      navigate(`/workspaces?tool=${toolKey}`, { replace: true });
    } else {
      navigate('/workspaces', { replace: true });
    }
  }, [toolKey, focusedProjectId, navigate]);

  return <LoadingStateMessage>Redirecting to workspace...</LoadingStateMessage>;
};
