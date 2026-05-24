import type { BackendCapabilities } from '../backend-capabilities';
import { appCopy } from '../../copy/system';
import {
  listEnabledModels,
  type LlmModelOption,
} from '../../../features/tools/runtime/models-client';
import { useSWRQuery, type SWRQueryResult } from './useSWRQuery';

type UseModelsQueryOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  enabled?: boolean;
};

export const useModelsQuery = (options: UseModelsQueryOptions): SWRQueryResult<LlmModelOption[]> => {
  const enabled = options.enabled ?? true;

  return useSWRQuery<LlmModelOption[]>({
    key: enabled ? [options.apiBaseUrl, options.capabilities, 'models'] : null,
    fetcher: () => listEnabledModels({
      apiBaseUrl: options.apiBaseUrl,
      capabilities: options.capabilities as BackendCapabilities,
    }),
    emptyData: [],
    errorMessage: appCopy.ui.fallbackErrors.loadModels,
  });
};
