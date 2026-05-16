import { useRef } from 'react';
import type { BackendCapabilities } from '../backend-capabilities';
import {
  listArtifacts,
  type ArtifactQuery,
} from '../../../features/artifacts/runtime/artifacts-client';
import type { GenerationArtifact } from '../../../features/generation/ui/artifact-history';
import { useAsyncQuery } from './useAsyncQuery';

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

type ArtifactQueryData = {
  artifacts: GenerationArtifact[];
  totalResults: number;
};

export const useArtifactsQuery = (
  options: UseArtifactsQueryOptions,
): UseArtifactsQueryResult => {
  // Keep localArtifacts in a ref: it's only a fallback for the capability-disabled path
  // and should NOT trigger a re-fetch when the stream pushes new in-memory artifacts.
  const localArtifactsRef = useRef(options.localArtifacts);
  localArtifactsRef.current = options.localArtifacts;

  // Serialize filters so that inline object literals don't trigger the effect on every render.
  const filtersKey = JSON.stringify(options.filters);
  const queryState = useAsyncQuery<ArtifactQueryData>({
    enabled: options.enabled ?? true,
    emptyData: {
      artifacts: [],
      totalResults: 0,
    },
    errorMessage: 'Unable to load artifacts',
    dependencies: [options.apiBaseUrl, options.capabilities, filtersKey],
    query: () => listArtifacts(options.filters, {
      apiBaseUrl: options.apiBaseUrl,
      capabilities: options.capabilities,
      localArtifacts: localArtifactsRef.current,
    }),
  });

  return {
    data: queryState.data.artifacts,
    totalResults: queryState.data.totalResults,
    loading: queryState.loading,
    error: queryState.error,
    reload: queryState.reload,
  };
};
