import { useCallback, useState } from 'react';
import type { BackendCapabilities } from '../../../app/runtime/backend-capabilities';
import { useSWRQuery, type SWRQueryResult } from '../../../app/runtime/queries/useSWRQuery';

export type AdminToolWorkflowJob = {
  jobId: string;
  status: string;
  toolKey: string;
  projectId: string;
  userId: string;
  totalSteps: number;
  completedSteps: number;
  model: string | null;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type AdminToolWorkflowJobsData = {
  jobs: AdminToolWorkflowJob[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminToolWorkflowJobsFilters = {
  status: string;
  toolKey: string;
};

const DEFAULT_FILTERS: AdminToolWorkflowJobsFilters = {
  status: '',
  toolKey: '',
};

type UseAdminToolWorkflowJobsQueryOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
};

export const useAdminToolWorkflowJobsQuery = (
  options: UseAdminToolWorkflowJobsQueryOptions,
): SWRQueryResult<AdminToolWorkflowJobsData> & {
  filters: AdminToolWorkflowJobsFilters;
  setStatusFilter: (status: string) => void;
  setToolKeyFilter: (toolKey: string) => void;
  page: number;
  setPage: (page: number) => void;
  hasRunningJobs: boolean;
} => {
  const { apiBaseUrl } = options;
  const [filters, setFilters] = useState<AdminToolWorkflowJobsFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const setStatusFilter = useCallback((status: string) => {
    setFilters((prev) => ({ ...prev, status }));
    setPage(0);
  }, []);

  const setToolKeyFilter = useCallback((toolKey: string) => {
    setFilters((prev) => ({ ...prev, toolKey }));
    setPage(0);
  }, []);

  const queryParams = new URLSearchParams();
  if (filters.status) queryParams.set('status', filters.status);
  if (filters.toolKey) queryParams.set('toolKey', filters.toolKey);
  queryParams.set('limit', String(pageSize));
  queryParams.set('offset', String(page * pageSize));
  const queryString = queryParams.toString();

  const result = useSWRQuery<AdminToolWorkflowJobsData>({
    key: [apiBaseUrl, 'admin-tool-jobs', queryString],
    fetcher: async () => {
      const url = `${apiBaseUrl}/api/tools/jobs${queryString ? `?${queryString}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load tool jobs');
      return res.json() as Promise<AdminToolWorkflowJobsData>;
    },
    emptyData: { jobs: [], total: 0, limit: pageSize, offset: 0 },
    errorMessage: 'Failed to load tool jobs',
  });

  const hasRunningJobs = result.data.jobs.some((j) => j.status === 'running');

  return {
    ...result,
    filters,
    setStatusFilter,
    setToolKeyFilter,
    page,
    setPage,
    hasRunningJobs,
  };
};
