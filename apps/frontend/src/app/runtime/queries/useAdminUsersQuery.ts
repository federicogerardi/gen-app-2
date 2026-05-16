import { useCallback } from 'react';
import type { BackendCapabilities } from '../backend-capabilities';
import { listAdminUsers, type AdminUser } from '../../../features/admin/runtime/admin-client';
import { useAsyncQuery } from './useAsyncQuery';

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
  const query = useCallback(() => listAdminUsers({
    apiBaseUrl: options.apiBaseUrl,
    capabilities: options.capabilities,
  }), [options.apiBaseUrl, options.capabilities]);

  return useAsyncQuery<AdminUser[]>({
    enabled: options.enabled ?? true,
    emptyData: [],
    errorMessage: 'Unable to load admin users',
    dependencyKey: JSON.stringify([options.apiBaseUrl, options.capabilities]),
    query,
  });
};
