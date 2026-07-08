import type { OutputFormat } from '../types/artifact';
import type { RequestReceivedEvent } from '../types/xstate';
import type { GenerationAdapters } from '../adapters/generation.adapters';
import type { GenerationSystemInput } from './generation-system.types';

export const defaultArtifactIdFactory = (): string =>
  `artifact-${Math.random().toString(36).slice(2, 10)}`;

export const normalizeOutputFormat = (value: unknown): OutputFormat => {
  if (value === 'json' || value === 'markdown' || value === 'plain') {
    return value;
  }

  return 'plain';
};

export const defaultResponseBuilder = (request: RequestReceivedEvent): string => {
  const prompt = request.input?.prompt;
  if (typeof prompt === 'string' && prompt.trim().length > 0) {
    return `Generated output for prompt: ${prompt.trim()}`;
  }

  return `Generated output for request ${request.requestId}`;
};

export function buildGenerationCoreDefaults() {
  return {
    requestId:           '',
    userId:              null,
    projectId:           null,
    sessionId:           null,
    toolKey:             null,
    registryVersion:     null,
    registrySnapshotRef: null,
    workflowType:        null,
    artifactType:        'content' as const,
    mode:                'stream' as const,
    artifactId:          null,
    contentBuffer:       '',
    failureReason:       null,
  };
}

export function buildGenerationRuntimeDefaults() {
  return {
    model:                   'unknown',
    requestInput:            {} as Record<string, unknown>,
    idempotencyKey:          null,
    outputFormat:            'plain' as const,
    syntheticResponse:       '',
    routeType:               null,
    pendingFallback:         null,
    effectiveModelResolution: null,
  };
}

export function buildGenerationMetricsDefaults() {
  return {
    inputTokens:  0,
    outputTokens: 0,
    costUsd:      0,
    _creditCost:  1,
  };
}

export function buildGenerationInfraContext(
  adapters: GenerationAdapters,
  runtime?: GenerationSystemInput['runtime'],
) {
  return {
    adapters,
    runtimeNow:        runtime?.now             ?? (() => new Date()),
    artifactIdFactory: runtime?.artifactIdFactory ?? defaultArtifactIdFactory,
    responseBuilder:   runtime?.responseBuilder   ?? defaultResponseBuilder,
  };
}