import type {
  AuthOkEvent,
  RequestReceivedEvent,
  ValidationOkEvent,
} from '../types/xstate';
import type { OutputFormat } from '../types/artifact';
import { resolveToolPrompt } from './tool-prompts';

export type BackendGenerationRequest = {
  requestId: string;
  userId: string;
  projectId: string;
  artifactType: RequestReceivedEvent['artifactType'];
  model: string;
  input: Record<string, unknown>;
  toolKey?: string | null;
  workflowType?: string | null;
  idempotencyKey?: string;
  outputFormat?: OutputFormat;
  registryVersion?: string;
  registrySnapshotRef?: string;
  briefingId?: string | null;
  extractionArtifactId?: string | null;
  stepDependencyArtifactIds?: string[] | null;
};

const toOptionalId = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const toDependencyArtifactIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const toOutputFormat = (value: OutputFormat | undefined): OutputFormat => {
  if (value === 'json' || value === 'markdown' || value === 'plain') {
    return value;
  }

  return 'plain';
};

const normalizeModelId = (value: string): string => {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return 'openrouter/auto';
  }

  if (normalized.includes('/')) {
    return normalized;
  }

  if (normalized === 'auto') {
    return 'openrouter/auto';
  }

  if (normalized.includes(':')) {
    const [provider, ...rest] = normalized.split(':');
    if (provider && rest.length > 0) {
      return `${provider}/${rest.join(':')}`;
    }
  }

  return normalized;
};

export const buildRequestReceivedEvent = (
  request: BackendGenerationRequest,
): RequestReceivedEvent => {
  const resolvedPrompt = resolveToolPrompt({
    toolKey: request.toolKey ?? null,
    workflowType: request.workflowType ?? null,
    artifactType: String(request.artifactType),
    stepKey: request.input.step,
  });

  const fallbackPrompt =
    typeof request.input.prompt === 'string' && request.input.prompt.trim().length > 0
      ? request.input.prompt
      : resolvedPrompt?.prompt;

  const briefingId =
    toOptionalId(request.briefingId)
    ?? toOptionalId(request.input.briefingId);
  const extractionArtifactId =
    toOptionalId(request.extractionArtifactId)
    ?? toOptionalId(request.input.extractionArtifactId);
  const stepDependencyArtifactIds =
    toDependencyArtifactIds(request.stepDependencyArtifactIds)
    .concat(toDependencyArtifactIds(request.input.stepDependencyArtifactIds));
  const dedupedDependencyArtifactIds = [...new Set(stepDependencyArtifactIds)];

  const enrichedInput = {
    ...request.input,
    outputFormat: toOutputFormat(request.outputFormat),
    ...(briefingId ? { briefingId } : {}),
    ...(extractionArtifactId ? { extractionArtifactId } : {}),
    ...(dedupedDependencyArtifactIds.length > 0
      ? { stepDependencyArtifactIds: dedupedDependencyArtifactIds }
      : {}),
    ...(fallbackPrompt ? { prompt: fallbackPrompt } : {}),
    ...(resolvedPrompt
      ? {
        resolvedPromptTemplate: resolvedPrompt.prompt,
        resolvedPromptSource: resolvedPrompt.filePath,
      }
      : {}),
  };

  const common = {
    type: 'REQUEST_RECEIVED' as const,
    requestId: request.requestId,
    projectId: request.projectId,
    toolKey: request.toolKey ?? null,
    artifactType: request.artifactType,
    model: normalizeModelId(request.model),
    input: enrichedInput,
    workflowType: request.workflowType ?? null,
  };

  const withIdempotency = request.idempotencyKey
    ? { idempotencyKey: request.idempotencyKey }
    : {};

  if (request.registryVersion) {
    return {
      ...common,
      ...withIdempotency,
      registryVersion: request.registryVersion as never,
      registrySnapshotRef: request.registrySnapshotRef as never,
    };
  }

  return {
    ...common,
    ...withIdempotency,
    registrySnapshotRef: (request.registrySnapshotRef ?? 'snapshot:default') as never,
  };
};

export const buildAuthOkEvent = (request: BackendGenerationRequest): AuthOkEvent => ({
  type: 'AUTH_OK',
  userId: request.userId,
});

export const buildValidationOkEvent = (
  request: BackendGenerationRequest,
): ValidationOkEvent => ({
  type: 'VALIDATION_OK',
  workflowType: request.workflowType ?? null,
  registryVersion: (request.registryVersion ?? null) as never,
  registrySnapshotRef: (request.registrySnapshotRef ?? null) as never,
});
