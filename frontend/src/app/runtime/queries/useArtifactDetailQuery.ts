import { useCallback, useEffect, useState } from 'react';
import type { BackendCapabilities } from '../backend-capabilities';
import { getArtifactById } from '../../../features/artifacts/runtime/artifacts-client';
import type { GenerationArtifact } from '../../../features/generation/ui/artifact-history';

type UseArtifactDetailQueryOptions = {
  artifactId: string;
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  localArtifacts: GenerationArtifact[];
  enabled?: boolean;
};

type UseArtifactDetailQueryResult = {
  data: GenerationArtifact | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export const useArtifactDetailQuery = (
  options: UseArtifactDetailQueryOptions,
): UseArtifactDetailQueryResult => {
  const [data, setData] = useState<GenerationArtifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (options.enabled === false || !options.artifactId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const artifact = await getArtifactById(options.artifactId, {
          apiBaseUrl: options.apiBaseUrl,
          capabilities: options.capabilities,
          localArtifacts: options.localArtifacts,
        });

        if (cancelled) {
          return;
        }

        setData(artifact);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load artifact detail');
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
    options.artifactId,
    options.capabilities,
    options.enabled,
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
