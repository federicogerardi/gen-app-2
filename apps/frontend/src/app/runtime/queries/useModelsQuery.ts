import type { BackendCapabilities } from '../backend-capabilities';
import {
  listEnabledModels,
  type LlmModelOption,
} from '../../../features/tools/runtime/models-client';
import { useAsyncQuery } from './useAsyncQuery';

type UseModelsQueryOptions = {
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  enabled?: boolean;
};

type UseModelsQueryResult = {
  data: LlmModelOption[];
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export const useModelsQuery = (options: UseModelsQueryOptions): UseModelsQueryResult => {
  const capabilitiesKey = JSON.stringify(options.capabilities);

  return useAsyncQuery<LlmModelOption[]>({
    enabled: options.enabled ?? true,
    emptyData: [],
    errorMessage: 'Unable to load models',
    dependencies: [options.apiBaseUrl, capabilitiesKey],
    query: () => listEnabledModels({
      apiBaseUrl: options.apiBaseUrl,
      capabilities: options.capabilities as BackendCapabilities,
    }),
  });
};
