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
  // Campi diagnostici DB opzionali
  failureReason?: string | null;
  streamedAt?: string | null;
  completedAt?: string | null;
};

export type ArtifactFilters = {
  type: 'all' | ArtifactType;
  status: 'all' | ArtifactLifecycleStatus;
  projectId: 'all' | string;
  period: ArtifactPeriodFilter;
};

export type ToolRelaunchIntent = 'new' | 'resume' | 'regenerate';

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

const normalizeToolKey = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/_/g, '-');
  return normalized.length > 0 ? normalized : null;
};

const readInputString = (request: GenerationRequest, key: string): string | null => {
  const value = request.input[key];
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const resolveToolRouteFromArtifact = (artifact: GenerationArtifact): string | null => {
  const candidates = [
    normalizeToolKey(artifact.toolKey),
    normalizeToolKey(artifact.workflowType),
    normalizeToolKey(artifact.sourceRequest.toolKey),
    normalizeToolKey(artifact.sourceRequest.workflowType),
  ];

  if (candidates.includes('funnel-pages')) {
    return '/tools/funnel-pages';
  }

  if (candidates.includes('nextland')) {
    return '/tools/nextland';
  }

  return null;
};

export const buildArtifactEntryQuery = (
  artifact: GenerationArtifact,
  intent: ToolRelaunchIntent,
): string => {
  const params = new URLSearchParams();
  params.set('intent', intent);
  params.set('projectId', artifact.projectId.trim());
  params.set('sourceArtifactId', artifact.artifactId);
  params.set('relaunchFromArtifactId', artifact.artifactId);

  const tone = readInputString(artifact.sourceRequest, 'tone');
  if (tone) {
    params.set('tone', tone);
  }

  const notes = readInputString(artifact.sourceRequest, 'notes');
  if (notes) {
    params.set('notes', notes);
  }

  const briefingId = readInputString(artifact.sourceRequest, 'briefingId');
  if (briefingId) {
    params.set('briefingId', briefingId);
  }

  const briefingFileName = readInputString(artifact.sourceRequest, 'briefingFileName');
  if (briefingFileName) {
    params.set('briefingFileName', briefingFileName);
  }

  return params.toString();
};

export const buildToolEntryPathFromArtifact = (
  artifact: GenerationArtifact,
  intent: ToolRelaunchIntent,
): string | null => {
  const route = resolveToolRouteFromArtifact(artifact);
  if (!route) {
    return null;
  }

  const query = buildArtifactEntryQuery(artifact, intent);
  return query.length > 0 ? `${route}?${query}` : route;
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
