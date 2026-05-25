import { useCallback } from 'react';

import { appCopy } from '../../../app/copy/system';
import { useSWRQuery } from '../../../app/runtime/queries/useSWRQuery';
import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { listAdminApiServiceBindings, type ApiServiceBinding } from './admin-client';

type UseAdminApiServiceBindingsQueryOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  apiServiceId: string | null;
};

export const useAdminApiServiceBindingsQuery = ({ apiBaseUrl, capabilities, apiServiceId }: UseAdminApiServiceBindingsQueryOptions) => {
  const fetchBindings = useCallback(async (): Promise<ApiServiceBinding[]> => {
    if (!apiServiceId) {
      return [];
    }

    return listAdminApiServiceBindings(apiServiceId, { apiBaseUrl, capabilities });
  }, [apiBaseUrl, capabilities, apiServiceId]);

  return useSWRQuery<ApiServiceBinding[]>({
    key: capabilities.adminApiServicesCrud && apiServiceId ? [apiBaseUrl, 'admin-api-service-bindings', apiServiceId] : null,
    fetcher: fetchBindings,
    emptyData: [],
    errorMessage: appCopy.ui.fallbackErrors.loadAdminApiServiceBindings,
  });
};
