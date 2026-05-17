import { useCallback, useEffect, useState } from 'react';

import { joinApiPath, requestJson } from '../../../app/runtime/http-client';
import type { AdminLlmModelRow } from '../llm/LLMTable';

export const useAdminModelsQuery = (apiBaseUrl: string) => {
  const [data, setData] = useState<AdminLlmModelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const res = await requestJson<{ data?: { models?: AdminLlmModelRow[] } }>(
          joinApiPath(apiBaseUrl, '/api/admin/models'),
          { method: 'GET', credentials: 'include' },
        );

        if (!cancelled) {
          setData(res.data?.models ?? []);
          setError(null);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setData([]);
          setError(caughtError instanceof Error ? caughtError.message : 'Failed to load models');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, reloadToken]);

  return { data, loading, error, reload };
};