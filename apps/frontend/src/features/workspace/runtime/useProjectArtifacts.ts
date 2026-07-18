import { useState, useEffect, useCallback } from 'react';
import { listArtifacts } from '../../artifacts/runtime/artifacts-client';
import type { GenerationArtifact } from '../../generation/ui/artifact-history';

interface UseProjectArtifactsResult {
  artifacts: GenerationArtifact[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useProjectArtifacts = (projectId: string): UseProjectArtifactsResult => {
  const [artifacts, setArtifacts] = useState<GenerationArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArtifacts = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listArtifacts({
        projectId,
        status: 'completed',
        type: 'all',
        limit: 5,
      });
      setArtifacts(result.artifacts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load artifacts');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void fetchArtifacts(); }, [fetchArtifacts]);

  return { artifacts, loading, error, refetch: fetchArtifacts };
};
