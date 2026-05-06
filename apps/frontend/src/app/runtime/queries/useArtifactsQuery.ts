import { useCallback, useEffect, useRef, useState } from 'react';
import type { BackendCapabilities } from '../backend-capabilities';
import {
  listArtifacts,
  type ArtifactQuery,
} from '../../../features/artifacts/runtime/artifacts-client';
import type { GenerationArtifact } from '../../../features/generation/ui/artifact-history';

type UseArtifactsQueryOptions = {
  filters: ArtifactQuery;
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  localArtifacts: GenerationArtifact[];
  enabled?: boolean;
};

type UseArtifactsQueryResult = {
  data: GenerationArtifact[];
  totalResults: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export const useArtifactsQuery = (
  options: UseArtifactsQueryOptions,
): UseArtifactsQueryResult => {
  const [data, setData] = useState<GenerationArtifact[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((prev) => prev + 1);
  }, []);

  // Keep localArtifacts in a ref: it's only a fallback for the capability-disabled path
  // and should NOT trigger a re-fetch when the stream pushes new in-memory artifacts.
  const localArtifactsRef = useRef(options.localArtifacts);
  localArtifactsRef.current = options.localArtifacts;

  // Serialize filters so that inline object literals don't trigger the effect on every render.
  const filtersKey = JSON.stringify(options.filters);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- filters are compared by value via filtersKey; localArtifacts is intentionally excluded (ref pattern)
  useEffect(() => {
    if (options.enabled === false) {
      setData([]);
      setTotalResults(0);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const result = await listArtifacts(options.filters, {
          apiBaseUrl: options.apiBaseUrl,
          capabilities: options.capabilities,
          localArtifacts: localArtifactsRef.current,
        });

        if (cancelled) {
          return;
        }

        setData(result.artifacts);
        setTotalResults(result.totalResults);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setData([]);
        setTotalResults(0);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load artifacts');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    options.apiBaseUrl,
    options.capabilities,
    options.enabled,
    filtersKey,
    reloadToken,
  ]);

  return {
    data,
    totalResults,
    loading,
    error,
    reload,
  };
};
