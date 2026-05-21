import { useCallback } from 'react';

import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { useSWRQuery } from '../../../app/runtime/queries/useSWRQuery';
import type { UserReportCategory, UserReportStatus } from '../../feedback-center/contracts/feedback-center-contract';
import { listAdminUserReports } from '../../feedback-center/runtime/feedback-center-client';

type UseAdminUserReportsQueryOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  statusFilter: UserReportStatus | 'all';
  categoryFilter: UserReportCategory | 'all';
};

export const useAdminUserReportsQuery = ({
  apiBaseUrl,
  capabilities,
  statusFilter,
  categoryFilter,
}: UseAdminUserReportsQueryOptions) => {
  const query = useCallback(async () => {
    const result = await listAdminUserReports(
      {
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
      },
      {
        apiBaseUrl,
        capabilities,
      },
    );

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    return result.data;
  }, [apiBaseUrl, capabilities, statusFilter, categoryFilter]);

  return useSWRQuery({
    key: [apiBaseUrl, capabilities, statusFilter, categoryFilter, 'admin-user-reports'],
    fetcher: query,
    emptyData: [],
    errorMessage: 'Unable to load admin user reports',
  });
};