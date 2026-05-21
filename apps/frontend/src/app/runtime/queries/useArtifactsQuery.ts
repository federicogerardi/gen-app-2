import { useMemo } from 'react';
import type { BackendCapabilities } from '../backend-capabilities';
import {
  listArtifacts,
  type ArtifactQuery,
} from '../../../features/artifacts/runtime/artifacts-client';
import type { GenerationArtifact } from '../../../features/generation/ui/artifact-history';
import { useSWRQuery } from './useSWRQuery';

type UseArtifactsQueryOptions = {
  filters: ArtifactQuery;
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  localArtifacts: GenerationArtifact[];
  enabled?: boolean;
};

type UseArtifactsQueryResult = {
  data: GenerationArtifact[];
  totalResults: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export const useArtifactsQuery = (
  options: UseArtifactsQueryOptions,
): UseArtifactsQueryResult => {
  const enabled = options.enabled ?? true;
  const filtersKey = JSON.stringify(options.filters);
  const localArtifactsKey = useMemo(() => JSON.stringify(
    options.localArtifacts.map((artifact) => [
      artifact.artifactId,
      artifact.updatedAt,
      artifact.status,
    ]),
  ), [options.localArtifacts]);

  const queryState = useSWRQuery<{ artifacts: GenerationArtifact[]; totalResults: number }>({
    key: enabled ? [options.apiBaseUrl, options.capabilities, filtersKey, localArtifactsKey, 'artifacts'] : null,
    fetcher: () => listArtifacts(options.filters, {
      apiBaseUrl: options.apiBaseUrl,
      capabilities: options.capabilities,
      localArtifacts: options.localArtifacts,
    }),
    emptyData: { artifacts: [], totalResults: 0 },
    errorMessage: 'Unable to load artifacts',
  });

  return {
    data: queryState.data.artifacts,
    totalResults: queryState.data.totalResults,
    loading: queryState.loading,
    error: queryState.error,
    reload: queryState.reload,
  };
};
