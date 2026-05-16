import { useCallback, useRef } from 'react';
import type { BackendCapabilities } from '../backend-capabilities';
import { getArtifactById } from '../../../features/artifacts/runtime/artifacts-client';
import type { GenerationArtifact } from '../../../features/generation/ui/artifact-history';
import { useAsyncQuery } from './useAsyncQuery';

type UseArtifactDetailQueryOptions = {
  artifactId: string;
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  localArtifacts: GenerationArtifact[];
  enabled?: boolean;
};

type UseArtifactDetailQueryResult = {
  data: GenerationArtifact | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

export const useArtifactDetailQuery = (
  options: UseArtifactDetailQueryOptions,
): UseArtifactDetailQueryResult => {
  const localArtifactsRef = useRef(options.localArtifacts);
  localArtifactsRef.current = options.localArtifacts;
  const query = useCallback(() => getArtifactById(options.artifactId, {
    apiBaseUrl: options.apiBaseUrl,
    capabilities: options.capabilities,
    localArtifacts: localArtifactsRef.current,
  }), [options.artifactId, options.apiBaseUrl, options.capabilities]);

  return useAsyncQuery<GenerationArtifact | null>({
    enabled: options.enabled !== false && options.artifactId.length > 0,
    emptyData: null,
    errorMessage: 'Unable to load artifact detail',
    dependencyKey: JSON.stringify([options.artifactId, options.apiBaseUrl, options.capabilities]),
    query,
  });
};
