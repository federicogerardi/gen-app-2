import { useMemo } from 'react';

import { useGenerationWorkspace } from '../../generation/runtime/GenerationWorkspaceProvider';

export const useAdminActivityFeed = () => {
  const generation = useGenerationWorkspace();

  return useMemo(() => {
    return [...generation.checkpoints]
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, 20);
  }, [generation.checkpoints]);
};