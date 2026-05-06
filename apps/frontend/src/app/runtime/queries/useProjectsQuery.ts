import { useCallback, useEffect, useState } from 'react';
import type { BackendCapabilities } from '../backend-capabilities';
import { listProjects, type ProjectSummary } from '../../../features/projects/runtime/projects-client';

type UseProjectsQueryOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  enabled?: boolean;
};

type UseProjectsQueryResult = {
  data: ProjectSummary[];
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export const useProjectsQuery = (
  options: UseProjectsQueryOptions,
): UseProjectsQueryResult => {
  const [data, setData] = useState<ProjectSummary[]>([]);
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
        const projects = await listProjects({
          apiBaseUrl: options.apiBaseUrl,
          capabilities: options.capabilities,
        });

        if (cancelled) {
          return;
        }

        setData(projects);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setData([]);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load projects');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [options.apiBaseUrl, options.capabilities, options.enabled, reloadToken]);

  return {
    data,
    loading,
    error,
    reload,
  };
};
