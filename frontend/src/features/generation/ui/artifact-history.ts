import type { ArtifactType, GenerationRequest } from '../contracts/backend-stream';

export type ArtifactLifecycleStatus = 'generating' | 'completed' | 'failed';
export type ArtifactPeriodFilter = 'all' | '7d' | '30d' | '90d';

export type GenerationArtifact = {
  artifactId: string;
  requestId: string;
  projectId: string;
  artifactType: ArtifactType;
  status: ArtifactLifecycleStatus;
  model: string;
  toolKey: string | null;
  workflowType: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  sourceRequest: GenerationRequest;
};

export type ArtifactFilters = {
  type: 'all' | ArtifactType;
  status: 'all' | ArtifactLifecycleStatus;
  projectId: 'all' | string;
  period: ArtifactPeriodFilter;
};

const toPeriodWindowMs = (period: ArtifactPeriodFilter): number | null => {
  if (period === '7d') {
    return 7 * 24 * 60 * 60 * 1000;
  }

  if (period === '30d') {
    return 30 * 24 * 60 * 60 * 1000;
  }

  if (period === '90d') {
    return 90 * 24 * 60 * 60 * 1000;
  }

  return null;
};

export const filterArtifacts = (
  artifacts: GenerationArtifact[],
  filters: ArtifactFilters,
  nowIso: string,
): GenerationArtifact[] => {
  const nowMs = Date.parse(nowIso);
  const periodWindowMs = toPeriodWindowMs(filters.period);

  return artifacts.filter((artifact) => {
    if (filters.type !== 'all' && artifact.artifactType !== filters.type) {
      return false;
    }

    if (filters.status !== 'all' && artifact.status !== filters.status) {
      return false;
    }

    if (filters.projectId !== 'all' && artifact.projectId !== filters.projectId) {
      return false;
    }

    if (periodWindowMs !== null) {
      const updatedAtMs = Date.parse(artifact.updatedAt);
      if (!Number.isFinite(updatedAtMs)) {
        return false;
      }

      if (nowMs - updatedAtMs > periodWindowMs) {
        return false;
      }
    }

    return true;
  });
};

const randomId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `req-${Date.now()}`;
};

export const buildRelaunchRequest = (
  artifact: GenerationArtifact,
  mode: 'primary' | 'secondary',
): GenerationRequest => {
  const { idempotencyKey: _ignoredIdempotencyKey, ...requestWithoutIdempotency } = artifact.sourceRequest;

  return {
    ...requestWithoutIdempotency,
    requestId: randomId(),
    input: {
      ...artifact.sourceRequest.input,
      relaunchFromArtifactId: artifact.artifactId,
      relaunchMode: mode,
    },
  };
};
