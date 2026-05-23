import type { BackendCapabilities } from '../backend-capabilities';
import { appCopy } from '../../copy/system';
import { getProjectById, type ProjectSummary } from '../../../features/projects/runtime/projects-client';
import { useSWRQuery, type SWRQueryResult } from './useSWRQuery';

type UseProjectDetailQueryOptions = {
  projectId: string;
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  enabled?: boolean;
};

export const useProjectDetailQuery = (
  options: UseProjectDetailQueryOptions,
): SWRQueryResult<ProjectSummary | null> => {
  const enabled = options.enabled !== false && options.projectId.length > 0;

  return useSWRQuery<ProjectSummary | null>({
    key: enabled ? [options.projectId, options.apiBaseUrl, options.capabilities, 'project-detail'] : null,
    fetcher: () => getProjectById(options.projectId, {
      apiBaseUrl: options.apiBaseUrl,
      capabilities: options.capabilities,
    }),
    emptyData: null,
    errorMessage: appCopy.ui.fallbackErrors.loadProjectDetail,
  });
};
