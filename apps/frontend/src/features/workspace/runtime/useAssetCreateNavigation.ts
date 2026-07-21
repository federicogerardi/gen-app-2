import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducerToolsForAsset } from './toolAssetRegistry';
import type { AssetType } from '@gen-app-2/contracts';

/**
 * Shared hook for navigating to the producer tool when a user wants to
 * create/generate an asset of a given type.
 *
 * If a producer tool exists → navigate to `/workspaces/:id/tools/:toolKey`.
 * Otherwise → call `refetch()` (e.g., after manual asset creation).
 */
export function useAssetCreateNavigation(
  workspaceId: string | undefined,
  refetch: () => void,
): (assetType: string) => void {
  const navigate = useNavigate();

  return useCallback(
    (assetType: string) => {
      const producerTools = getProducerToolsForAsset(assetType as AssetType);
      const toolKey = producerTools[0] ?? null;
      if (toolKey && workspaceId) {
        navigate(`/workspaces/${workspaceId}/tools/${toolKey}`);
      } else {
        refetch();
      }
    },
    [navigate, workspaceId, refetch],
  );
}