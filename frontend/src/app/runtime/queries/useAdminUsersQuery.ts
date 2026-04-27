import { useCallback, useEffect, useState } from 'react';
import type { BackendCapabilities } from '../backend-capabilities';
import { listAdminUsers, type AdminUser } from '../../../features/admin/runtime/admin-client';

type UseAdminUsersQueryOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  enabled?: boolean;
};

type UseAdminUsersQueryResult = {
  data: AdminUser[];
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export const useAdminUsersQuery = (
  options: UseAdminUsersQueryOptions,
): UseAdminUsersQueryResult => {
  const [data, setData] = useState<AdminUser[]>([]);
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
        const users = await listAdminUsers({
          apiBaseUrl: options.apiBaseUrl,
          capabilities: options.capabilities,
        });

        if (cancelled) {
          return;
        }

        setData(users);
        setError(null);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setData([]);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load admin users');
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
