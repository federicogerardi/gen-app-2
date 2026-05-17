import type { BackendCapabilities } from '../backend-capabilities';
import { listAdminUsers, type AdminUser } from '../../../features/admin/runtime/admin-client';
import { useSWRQuery, type SWRQueryResult } from './useSWRQuery';

type UseAdminUsersQueryOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  enabled?: boolean;
};

export const useAdminUsersQuery = (
  options: UseAdminUsersQueryOptions,
): SWRQueryResult<AdminUser[]> => {
  const enabled = options.enabled ?? true;

  return useSWRQuery<AdminUser[]>({
    key: enabled ? [options.apiBaseUrl, options.capabilities, 'admin-users'] : null,
    fetcher: () => listAdminUsers({ apiBaseUrl: options.apiBaseUrl, capabilities: options.capabilities }),
    emptyData: [],
    errorMessage: 'Unable to load admin users',
  });
};
