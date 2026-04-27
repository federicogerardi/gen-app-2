import { useCallback, useEffect, useState } from 'react';
import type { BackendCapabilities } from '../backend-capabilities';
import { getProjectById, type ProjectSummary } from '../../../features/projects/runtime/projects-client';

type UseProjectDetailQueryOptions = {
  projectId: string;
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  enabled?: boolean;
};

type UseProjectDetailQueryResult = {
  data: ProjectSummary | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export const useProjectDetailQuery = (
  options: UseProjectDetailQueryOptions,
): UseProjectDetailQueryResult => {
  const [data, setData] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (options.enabled === false || !options.projectId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const project = await getProjectById(options.projectId, {
          apiBaseUrl: options.apiBaseUrl,
          capabilities: options.capabilities,
        });

        if (cancelled) {
          return;
        }

        setData(project);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load project detail');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [options.apiBaseUrl, options.capabilities, options.enabled, options.projectId, reloadToken]);

  return {
    data,
    loading,
    error,
    reload,
  };
};
