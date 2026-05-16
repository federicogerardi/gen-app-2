import type { BackendCapabilities } from '../backend-capabilities';
import { getProjectById, type ProjectSummary } from '../../../features/projects/runtime/projects-client';
import { useAsyncQuery } from './useAsyncQuery';

type UseProjectDetailQueryOptions = {
  projectId: string;
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  enabled?: boolean;
};

type UseProjectDetailQueryResult = {
  data: ProjectSummary | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export const useProjectDetailQuery = (
  options: UseProjectDetailQueryOptions,
): UseProjectDetailQueryResult => {
  return useAsyncQuery<ProjectSummary | null>({
    enabled: options.enabled !== false && options.projectId.length > 0,
    emptyData: null,
    errorMessage: 'Unable to load project detail',
    dependencies: [options.projectId, options.apiBaseUrl, options.capabilities],
    query: () => getProjectById(options.projectId, {
      apiBaseUrl: options.apiBaseUrl,
      capabilities: options.capabilities,
    }),
  });
};
