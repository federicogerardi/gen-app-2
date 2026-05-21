import { useMemo } from 'react';

import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';
import { UI_CONFIG } from '../../../app/config/ui-config';

export const useAdminActivityFeed = () => {
  const generation = useGenerationWorkspace();

  return useMemo(() => {
    return [...generation.checkpoints]
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, UI_CONFIG.limits.adminActivityFeedMaxItems);
  }, [generation.checkpoints]);
};