import { createComponentLogger, LogComponent } from './log-components';
import type { BackendGenerationRequest } from './request-contract';

const toDebugString = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return '-';
};

const normalizeModelForDebug = (value: string): string => {
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

const readExtractionPayloadKeys = (request: BackendGenerationRequest): number => {
  const extractionPayload = request.input.extractionPayload;
  if (!extractionPayload || typeof extractionPayload !== 'object' || Array.isArray(extractionPayload)) {
    return 0;
  }

  return Object.keys(extractionPayload as Record<string, unknown>).length;
};

const readDependencyCount = (request: BackendGenerationRequest): number => {
  const dependencies = request.input.stepDependencyArtifactIds;
  return Array.isArray(dependencies) ? dependencies.length : 0;
};

const readBriefingTextLength = (request: BackendGenerationRequest): number => {
  const briefingText = request.input.briefingText;
  return typeof briefingText === 'string' ? briefingText.length : 0;
};

const readStep = (request: BackendGenerationRequest): string => {
  const step = request.input.step;
  if (typeof step === 'string' && step.trim().length > 0) {
    return step.trim();
  }

  return '-';
};

export type GenerationDebugInfo = {
  step: string;
  briefingTextLength: number;
  extractionPayloadKeys: number;
  dependencyCount: number;
  normalizedModel: string;
};

export const createCorrelationId = (requestId: string): string => `run:${requestId}`;

export const buildGenerationDebugInfo = (
  request: BackendGenerationRequest,
): GenerationDebugInfo => {
  return {
    step: readStep(request),
    briefingTextLength: readBriefingTextLength(request),
    extractionPayloadKeys: readExtractionPayloadKeys(request),
    dependencyCount: readDependencyCount(request),
    normalizedModel: normalizeModelForDebug(request.model),
  };
};

export const logGenerationRequestDebug = (
  correlationId: string,
  request: BackendGenerationRequest,
  info: GenerationDebugInfo,
): void => {
  const log = createComponentLogger(LogComponent.GENERATION_STREAM_OBSERVABILITY);
  log.info({
    correlationId,
    requestId: request.requestId,
    sessionId: toDebugString(request.sessionId),
    projectId: request.projectId,
    toolKey: toDebugString(request.toolKey),
    workflowType: toDebugString(request.workflowType),
    artifactType: request.artifactType,
    step: info.step,
    modelRaw: request.model,
    modelNormalized: info.normalizedModel,
    briefingTextLen: info.briefingTextLength,
    extractionPayloadKeys: info.extractionPayloadKeys,
    dependencyCount: info.dependencyCount,
  }, 'generation request debug');
};

export const logModelCheckDebug = (
  correlationId: string,
  request: BackendGenerationRequest,
  normalizedModel: string,
  isAvailable: boolean,
): void => {
  const log = createComponentLogger(LogComponent.GENERATION_STREAM_OBSERVABILITY);
  log.info({
    correlationId,
    requestId: request.requestId,
    modelRaw: request.model,
    modelNormalized: normalizedModel,
    available: isAvailable,
  }, 'model check');
};

export const logGenerationStreamError = (
  correlationId: string,
  request: BackendGenerationRequest,
  info: GenerationDebugInfo,
  error: unknown,
): void => {
  const log = createComponentLogger(LogComponent.GENERATION_STREAM_OBSERVABILITY);
  log.error({
    correlationId,
    requestId: request.requestId,
    toolKey: toDebugString(request.toolKey),
    workflowType: toDebugString(request.workflowType),
    step: info.step,
    modelRaw: request.model,
    modelNormalized: info.normalizedModel,
    err: error,
  }, 'stream error');
};
