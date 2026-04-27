import { useCallback, useEffect, useState } from 'react';
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
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export const useArtifactsQuery = (
  options: UseArtifactsQueryOptions,
): UseArtifactsQueryResult => {
  const [data, setData] = useState<GenerationArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (options.enabled === false) {
      setData([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const artifacts = await listArtifacts(options.filters, {
          apiBaseUrl: options.apiBaseUrl,
          capabilities: options.capabilities,
          localArtifacts: options.localArtifacts,
        });

        if (cancelled) {
          return;
        }

        setData(artifacts);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setData([]);
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
    options.filters,
    options.localArtifacts,
    reloadToken,
  ]);

  return {
    data,
    loading,
    error,
    reload,
  };
};
