import { useCallback } from 'react';
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
  const dependencyKey = JSON.stringify([options.apiBaseUrl, options.capabilities]);
  const query = useCallback(() => listEnabledModels({
    apiBaseUrl: options.apiBaseUrl,
    capabilities: options.capabilities as BackendCapabilities,
  }), [options.apiBaseUrl, options.capabilities]);

  return useAsyncQuery<LlmModelOption[]>({
    enabled: options.enabled ?? true,
    emptyData: [],
    errorMessage: 'Unable to load models',
    dependencyKey,
    query,
  });
};
