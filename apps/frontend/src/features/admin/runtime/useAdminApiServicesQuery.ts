import { useCallback } from 'react';

import { appCopy } from '../../../app/copy/system';
import { useSWRQuery } from '../../../app/runtime/queries/useSWRQuery';
import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { listAdminApiServices, type ApiService } from './admin-client';

type UseAdminApiServicesQueryOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
};

export const useAdminApiServicesQuery = ({ apiBaseUrl, capabilities }: UseAdminApiServicesQueryOptions) => {
  const fetchApiServices = useCallback(async (): Promise<ApiService[]> => {
    return listAdminApiServices({ apiBaseUrl, capabilities });
  }, [apiBaseUrl, capabilities]);

  return useSWRQuery<ApiService[]>({
    key: capabilities.adminApiServicesCrud ? [apiBaseUrl, 'admin-api-services'] : null,
    fetcher: fetchApiServices,
    emptyData: [],
    errorMessage: appCopy.ui.fallbackErrors.loadAdminApiServices,
  });
};
