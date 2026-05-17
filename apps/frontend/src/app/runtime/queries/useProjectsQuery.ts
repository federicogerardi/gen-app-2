import type { BackendCapabilities } from '../backend-capabilities';
import { listProjects, type ProjectSummary } from '../../../features/projects/runtime/projects-client';
import { useSWRQuery, type SWRQueryResult } from './useSWRQuery';

type UseProjectsQueryOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  enabled?: boolean;
};

export const useProjectsQuery = (
  options: UseProjectsQueryOptions,
): SWRQueryResult<ProjectSummary[]> => {
  const enabled = options.enabled ?? true;

  return useSWRQuery<ProjectSummary[]>({
    key: enabled ? [options.apiBaseUrl, options.capabilities, 'projects'] : null,
    fetcher: () => listProjects({ apiBaseUrl: options.apiBaseUrl, capabilities: options.capabilities }),
    emptyData: [],
    errorMessage: 'Unable to load projects',
  });
};
