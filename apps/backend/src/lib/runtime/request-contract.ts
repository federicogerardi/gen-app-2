import type {
  AuthOkEvent,
  IdempotencyCoordinatorInput,
  RequestReceivedEvent,
  ValidationOkEvent,
} from '../types/xstate';
import type {
  CopyLengthFormat,
  GenerationRequest,
  OutputFormat,
  ToolKey,
  ToolStep,
} from '@gen-app-2/contracts';
import {
  isToolKey,
  resolveToolWorkflowType,
  TOOL_STEP_ORDER,
} from '@gen-app-2/contracts';
import { resolveToolPrompt } from './tool-prompts';
import { normalizeStepKey } from './workflow-normalizers';

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

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
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

const TONE_PROFILE_ALLOWED = ['Professional', 'Casual', 'Formal', 'Technical'] as const;
const COPY_LENGTH_FORMAT_ALLOWED = ['short-form', 'medium-form', 'long-form'] as const;

const toCopyLengthFormat = (value: unknown): CopyLengthFormat | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  const match = COPY_LENGTH_FORMAT_ALLOWED.find((candidate) => candidate === normalized);
  return match ?? null;
};

const toCanonicalToneProfile = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }

  const match = TONE_PROFILE_ALLOWED.find((candidate) => candidate.toLowerCase() === normalized);
  return match ?? null;
};

const toCanonicalRequestStep = (toolKey: ToolKey | null, value: unknown): ToolStep | null => {
  const normalizedStep = normalizeStepKey(value);
  if (!normalizedStep) {
    return null;
  }

  if (!toolKey) {
    return normalizedStep as ToolStep;
  }

  const allowedSteps = TOOL_STEP_ORDER[toolKey];
  return allowedSteps.includes(normalizedStep as ToolStep)
    ? (normalizedStep as ToolStep)
    : null;
};

const toCanonicalRequestTone = (
  workflowType: GenerationRequest['workflowType'],
  value: unknown,
): string | null => {
  if (workflowType === 'extraction') {
    return 'analitico';
  }

  return toCanonicalToneProfile(value);
};

export const buildRequestReceivedEvent = (
  request: BackendGenerationRequest,
): RequestReceivedEvent => {
  const rawToolKey = request.toolKey;
  const normalizedToolKey: ToolKey | null =
    typeof rawToolKey === 'string' && isToolKey(rawToolKey) ? rawToolKey : null;
  const canonicalStep = toCanonicalRequestStep(normalizedToolKey, request.input.step);
  const canonicalTone = toCanonicalRequestTone(request.workflowType ?? null, request.input.tone);

  const resolvedPrompt = resolveToolPrompt({
    toolKey: normalizedToolKey,
    workflowType: request.workflowType ?? null,
    artifactType: String(request.artifactType),
    stepKey: canonicalStep ?? request.input.step,
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

  const { step: _rawStep, tone: _rawTone, copyLengthFormat: _rawCopyLengthFormat, ...inputRest } = request.input;
  const resolvedOutputFormat = normalizedToolKey === 'youtube-description'
    ? 'markdown'
    : toOutputFormat(request.outputFormat);

  const canonicalCopyLengthFormat = toCopyLengthFormat(_rawCopyLengthFormat);

  const enrichedInput = {
    ...inputRest,
    ...(canonicalStep ? { step: canonicalStep } : {}),
    ...(canonicalTone ? { tone: canonicalTone } : {}),
    ...(canonicalCopyLengthFormat ? { copyLengthFormat: canonicalCopyLengthFormat } : {}),
    outputFormat: resolvedOutputFormat,
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
    sessionId: toOptionalId(request.sessionId),
    toolKey: normalizedToolKey,
    artifactType: request.artifactType,
    model: normalizeModelId(request.model),
    input: enrichedInput,
    workflowType: request.workflowType ?? null,
  };

  const withIdempotency = request.idempotencyKey
    ? { idempotencyKey: request.idempotencyKey }
    : {};
  const resolvedRegistrySnapshotRef = request.registrySnapshotRef ?? 'snapshot:default';

  if (request.registryVersion) {
    return {
      ...common,
      ...withIdempotency,
      registryVersion: request.registryVersion,
      registrySnapshotRef: resolvedRegistrySnapshotRef,
    };
  }

  return {
    ...common,
    ...withIdempotency,
    registrySnapshotRef: resolvedRegistrySnapshotRef,
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
  registryVersion: request.registryVersion ?? null,
  registrySnapshotRef: request.registrySnapshotRef ?? null,
});

export const buildToolsOrchestrateIdempotencyInput = (input: {
  requestId?: unknown;
  userId: string;
  projectId: string;
  toolKey: string;
  idempotencyKey?: unknown;
}): IdempotencyCoordinatorInput | null => {
  const idempotencyKey = toNonEmptyString(input.idempotencyKey);
  if (!idempotencyKey) {
    return null;
  }

  if (!isToolKey(input.toolKey)) {
    return null;
  }

  const requestId =
    toNonEmptyString(input.requestId)
    ?? `orchestrate:${input.toolKey}:${idempotencyKey}`;

  return {
    requestId,
    userId: input.userId,
    projectId: input.projectId,
    workflowType: resolveToolWorkflowType(input.toolKey),
    idempotencyKey,
    registrySnapshotRef: 'snapshot:default',
  };
};
