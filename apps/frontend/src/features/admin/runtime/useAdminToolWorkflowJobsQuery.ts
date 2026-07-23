import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { useSWRQuery, type SWRQueryResult } from '../../../app/runtime/queries/useSWRQuery';

type AdminToolWorkflowJob = {
  jobId: string;
  status: string;
  toolKey: string;
  projectId: string;
  userId: string;
  createdAt: string;
};

type UseAdminToolWorkflowJobsQueryOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  enabled?: boolean;
};

export const useAdminToolWorkflowJobsQuery = (
  _options: UseAdminToolWorkflowJobsQueryOptions,
): SWRQueryResult<AdminToolWorkflowJob[]> => {
  return useSWRQuery<AdminToolWorkflowJob[]>({
    key: null,
    fetcher: async () => [],
    emptyData: [],
    errorMessage: 'Failed to load tool jobs',
  });
};
