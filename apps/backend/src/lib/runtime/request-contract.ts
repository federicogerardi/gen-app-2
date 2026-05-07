import type {
  AuthOkEvent,
  RequestReceivedEvent,
  ValidationOkEvent,
} from '../types/xstate';
import type { GenerationRequest, OutputFormat } from '@gen-app-2/contracts';
import { resolveToolPrompt } from './tool-prompts';

/**
 * Authoritative backend definition of the generation request payload.
 * This is the canonical source of truth for the request contract.
 * Frontend counterpart: GenerationRequest in frontend/src/features/generation/contracts/backend-stream.ts.
 * Both types must remain structurally identical; validate with the type-parity guard.
 * DDD canonical term: GenerationRequest (DDD-002).
 */
export type BackendGenerationRequest = GenerationRequest;

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
    extractionToolKey: request.input.toolKey,
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
