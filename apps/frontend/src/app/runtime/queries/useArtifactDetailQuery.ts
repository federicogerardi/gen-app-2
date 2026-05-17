import { useMemo } from 'react';
import type { BackendCapabilities } from '../backend-capabilities';
import { getArtifactById } from '../../../features/artifacts/runtime/artifacts-client';
import type { GenerationArtifact } from '../../../features/generation/ui/artifact-history';
import { useSWRQuery, type SWRQueryResult } from './useSWRQuery';

type UseArtifactDetailQueryOptions = {
  artifactId: string;
  apiBaseUrl: string;
  capabilities: BackendCapabilities;
  localArtifacts: GenerationArtifact[];
  enabled?: boolean;
};

export const useArtifactDetailQuery = (
  options: UseArtifactDetailQueryOptions,
): SWRQueryResult<GenerationArtifact | null> => {
  const localArtifactsKey = useMemo(() => JSON.stringify(
    options.localArtifacts.map((artifact) => [
      artifact.artifactId,
      artifact.updatedAt,
      artifact.status,
    ]),
  ), [options.localArtifacts]);

  const enabled = options.enabled !== false && options.artifactId.length > 0;

  return useSWRQuery<GenerationArtifact | null>({
    key: enabled
      ? [options.artifactId, options.apiBaseUrl, options.capabilities, localArtifactsKey, 'artifact-detail']
      : null,
    fetcher: () => getArtifactById(options.artifactId, {
      apiBaseUrl: options.apiBaseUrl,
      capabilities: options.capabilities,
      localArtifacts: options.localArtifacts,
    }),
    emptyData: null,
    errorMessage: 'Unable to load artifact detail',
  });
};
