import { useCallback } from 'react';

import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { useAsyncQuery } from '../../../app/runtime/queries/useAsyncQuery';
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

  return useAsyncQuery({
    enabled: true,
    emptyData: [],
    errorMessage: 'Unable to load admin user reports',
    dependencyKey: JSON.stringify([apiBaseUrl, capabilities, statusFilter, categoryFilter]),
    query,
  });
};