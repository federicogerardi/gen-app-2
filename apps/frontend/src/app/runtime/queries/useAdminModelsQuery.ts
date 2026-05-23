import type { BackendCapabilities } from '../backend-capabilities';
import { appCopy } from '../../copy/system';
import { joinApiPath, requestJson } from '../http-client';
import type { AdminLlmModelRow } from '../../../features/admin/llm/LLMTable';
import { useSWRQuery, type SWRQueryResult } from './useSWRQuery';

type UseAdminModelsQueryOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  enabled?: boolean;
};

const fetchAdminModels = async (apiBaseUrl: string): Promise<AdminLlmModelRow[]> => {
  const res = await requestJson<{ data?: { models?: AdminLlmModelRow[] } }>(
    joinApiPath(apiBaseUrl, '/api/admin/models'),
    { method: 'GET', credentials: 'include' },
  );
  return res.data?.models ?? [];
};

export const useAdminModelsQuery = (
  options: UseAdminModelsQueryOptions,
): SWRQueryResult<AdminLlmModelRow[]> => {
  const enabled = options.enabled ?? true;

  return useSWRQuery<AdminLlmModelRow[]>({
    key: enabled ? [options.apiBaseUrl, options.capabilities, 'admin-models'] : null,
    fetcher: () => fetchAdminModels(options.apiBaseUrl),
    emptyData: [],
    errorMessage: appCopy.ui.fallbackErrors.loadAdminModels,
  });
};
