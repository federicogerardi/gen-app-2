/**
 * useAssetSuggestions — Hook for compatible assets and gap detection.
 *
 * F-004: Create useAssetSuggestions hook for compatible assets and gaps.
 * Returns { compatibleAssets, gaps, loading, error }.
 */

import { useState, useEffect, useCallback } from 'react';
import type { AssetDto } from '@gen-app-2/contracts';
import {
  listCompatibleAssets,
  detectAssetGaps,
  type AssetGapsResponse,
} from './asset-client';

export type UseAssetSuggestionsResult = {
  compatibleAssets: AssetDto[];
  gaps: AssetGapsResponse['gaps'];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

/**
 * Hook that fetches compatible assets and detects gaps for a given project and tool.
 *
 * @param projectId - The current project ID
 * @param toolKey - The current tool key
 * @param enabled - Whether to fetch (default: true)
 */
export const useAssetSuggestions = (
  projectId: string | null,
  toolKey: string | null,
  enabled: boolean = true,
): UseAssetSuggestionsResult => {
  const [compatibleAssets, setCompatibleAssets] = useState<AssetDto[]>([]);
  const [gaps, setGaps] = useState<AssetGapsResponse['gaps']>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !projectId || !toolKey) {
      setCompatibleAssets([]);
      setGaps([]);
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const [assetsResult, gapsResult] = await Promise.all([
          listCompatibleAssets(projectId, toolKey),
          detectAssetGaps(projectId, toolKey),
        ]);

        if (!cancelled) {
          setCompatibleAssets(assetsResult.compatibleAssets);
          setGaps(gapsResult.gaps);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch asset suggestions');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [projectId, toolKey, enabled, refreshKey]);

  return {
    compatibleAssets,
    gaps,
    loading,
    error,
    refresh,
  };
};
