import type { BackendCapabilities } from '../backend-capabilities';
import { listProjects, type ProjectSummary } from '../../../features/projects/runtime/projects-client';
import { useAsyncQuery } from './useAsyncQuery';

type UseProjectsQueryOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  enabled?: boolean;
};

type UseProjectsQueryResult = {
  data: ProjectSummary[];
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export const useProjectsQuery = (
  options: UseProjectsQueryOptions,
): UseProjectsQueryResult => {
  return useAsyncQuery<ProjectSummary[]>({
    enabled: options.enabled ?? true,
    emptyData: [],
    errorMessage: 'Unable to load projects',
    dependencies: [options.apiBaseUrl, options.capabilities],
    query: () => listProjects({
      apiBaseUrl: options.apiBaseUrl,
      capabilities: options.capabilities,
    }),
  });
};
