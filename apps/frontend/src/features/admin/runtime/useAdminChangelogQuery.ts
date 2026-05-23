import { useCallback } from 'react';

import { appCopy } from '../../../app/copy/system';
import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { useSWRQuery } from '../../../app/runtime/queries/useSWRQuery';
import type { ProductChangelogDto } from '../../feedback-center/contracts/feedback-center-contract';
import { listAdminProductChangelog, listPublishedProductChangelog } from '../../feedback-center/runtime/feedback-center-client';

type UseAdminChangelogQueryOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  showArchived: boolean;
};

export const useAdminChangelogQuery = ({ apiBaseUrl, capabilities, showArchived }: UseAdminChangelogQueryOptions) => {
  const listPublishedChangelogQuery = useCallback(async (): Promise<ProductChangelogDto[]> => {
    const result = await listPublishedProductChangelog({ apiBaseUrl, capabilities });

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    return result.data;
  }, [apiBaseUrl, capabilities]);

  const listAdminChangelogQuery = useCallback(async (): Promise<ProductChangelogDto[]> => {
    const result = await listAdminProductChangelog({ apiBaseUrl, capabilities });

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    return result.data;
  }, [apiBaseUrl, capabilities]);

  return useSWRQuery<ProductChangelogDto[]>({
    key: [apiBaseUrl, capabilities, showArchived, 'admin-changelog'],
    fetcher: showArchived ? listAdminChangelogQuery : listPublishedChangelogQuery,
    emptyData: [],
    errorMessage: appCopy.ui.fallbackErrors.loadAdminChangelog,
  });
};