import { useCallback } from 'react';

import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { useSWRQuery } from '../../../app/runtime/queries/useSWRQuery';
import { listAdminGeometricScreenshots } from '../runtime/admin-client';

type UseAdminGeometricScreenshotsQueryOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
};

export const useAdminGeometricScreenshotsQuery = ({
  apiBaseUrl,
  capabilities,
}: UseAdminGeometricScreenshotsQueryOptions) => {
  const query = useCallback(async () => {
    return listAdminGeometricScreenshots(null, {
      apiBaseUrl,
      capabilities,
    });
  }, [apiBaseUrl, capabilities]);

  return useSWRQuery({
    key: [apiBaseUrl, capabilities, 'admin-geometric-screenshots'],
    fetcher: query,
    emptyData: [],
    errorMessage: 'Unable to load geometric screenshots',
  });
};
