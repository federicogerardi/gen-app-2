import type { ArtifactType, GenerationRequest } from '../contracts/backend-stream';
import { generateRequestId, normalizeIdentifier, readInputField } from '../../../app/runtime/shared-utils';

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

export const resolveToolRouteFromArtifact = (artifact: GenerationArtifact): string | null => {
  const candidates = [
    normalizeIdentifier(artifact.toolKey),
    normalizeIdentifier(artifact.workflowType),
    normalizeIdentifier(artifact.sourceRequest.toolKey),
    normalizeIdentifier(artifact.sourceRequest.workflowType),
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

  if (intent === 'new') {
    // Keep the relaunch entry deterministic: ToolPage hydration needs sourceArtifactId.
    params.set('sourceArtifactId', artifact.artifactId);

    // Preserve explicit brief references when available so hydration can stay bound
    // to the source artifact brief instead of generic project fallback.
    const briefingId = readInputField(artifact.sourceRequest, 'briefingId');
    if (briefingId) {
      params.set('briefingId', briefingId);
    }

    const extractionArtifactId = readInputField(artifact.sourceRequest, 'extractionArtifactId');
    if (extractionArtifactId) {
      params.set('extractionArtifactId', extractionArtifactId);
    }

    return params.toString();
  }

  params.set('sourceArtifactId', artifact.artifactId);
  params.set('relaunchFromArtifactId', artifact.artifactId);

  const tone = readInputField(artifact.sourceRequest, 'tone');
  if (tone) {
    params.set('tone', tone);
  }

  const notes = readInputField(artifact.sourceRequest, 'notes');
  if (notes) {
    params.set('notes', notes);
  }

  const briefingId = readInputField(artifact.sourceRequest, 'briefingId');
  if (briefingId) {
    params.set('briefingId', briefingId);
  }

  const briefingFileName = readInputField(artifact.sourceRequest, 'briefingFileName');
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
): GenerationRequest => {
  const { idempotencyKey: _ignoredIdempotencyKey, ...requestWithoutIdempotency } = artifact.sourceRequest;

  return {
    ...requestWithoutIdempotency,
    requestId: generateRequestId(),
    input: {
      ...artifact.sourceRequest.input,
      relaunchFromArtifactId: artifact.artifactId,
    },
  };
};
