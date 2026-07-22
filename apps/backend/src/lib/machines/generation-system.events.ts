import type {
  AcquisitionDoneOutput,
  CacheAcquisitionResultParams,
  CacheCrawlingResultParams,
  CacheExtractionResultParams,
  CacheGenerateResultParams,
  CacheReplayPayloadParams,
  CacheScoringResultParams,
  CacheStreamResultParams,
  CrawlingDoneOutput,
  ExtractionDoneOutput,
  GenerateDoneOutput,
  IdempotencyDoneOutput,
  OwnershipDoneOutput,
  ScoringDoneOutput,
  StreamDoneOutput,
  ToolDoneOutput,
  UsageDoneOutput,
} from './generation-system.types';
import {
  AcquisitionDoneOutputSchema,
  CrawlingDoneOutputSchema,
  ExtractionDoneOutputSchema,
  GenerateDoneOutputSchema,
  IdempotencyDoneOutputSchema,
  OwnershipDoneOutputSchema,
  ScoringDoneOutputSchema,
  StreamDoneOutputSchema,
  ToolDoneOutputSchema,
  UsageDoneOutputSchema,
} from './generation-system.event-schemas';
import { createComponentLogger } from '../runtime/log-components';

const eventLog = createComponentLogger('generation-system.events');

const validateOutput = <T>(
  output: unknown,
  schema: { safeParse: (data: unknown) => { success: boolean; data?: unknown; error?: { issues: unknown[] } } },
  label: string,
): T | undefined => {
  if (output === undefined || output === null) {
    return undefined;
  }
  const result = schema.safeParse(output);
  if (!result.success) {
    eventLog.warn(
      { label, zodErrors: result.error?.issues },
      'output validation failed — type drift detected',
    );
    return undefined;
  }
  return result.data as T;
};

/**
 * Domain Event output accessors.
 *
 * Helper che estraggono l'output dagli eventi XState onDone.
 * Validati runtime con Zod safeParse per rilevare type drift.
 *
 * @ddd DomainEventAccessors GenerationEvents
 * @ddd Related DDD-009 DDD-035 DDD-036
 */
export const getIdempotencyDoneOutput = (event: unknown): IdempotencyDoneOutput => {
  const output = (event as { output: IdempotencyDoneOutput }).output;
  return validateOutput(output, IdempotencyDoneOutputSchema, 'IdempotencyDoneOutput') ?? output;
};

export const getUsageDoneOutput = (event: unknown): UsageDoneOutput | undefined => {
  const output = (event as { output?: unknown }).output;
  return validateOutput(output, UsageDoneOutputSchema, 'UsageDoneOutput');
};

export const getOwnershipDoneOutput = (event: unknown): OwnershipDoneOutput | undefined => {
  const output = (event as { output?: unknown }).output;
  return validateOutput(output, OwnershipDoneOutputSchema, 'OwnershipDoneOutput');
};

export const getStreamDoneOutput = (event: unknown): StreamDoneOutput | undefined => {
  const output = (event as { output?: unknown }).output;
  return validateOutput(output, StreamDoneOutputSchema, 'StreamDoneOutput');
};

export const getGenerateDoneOutput = (event: unknown): GenerateDoneOutput | undefined => {
  const output = (event as { output?: unknown }).output;
  return validateOutput(output, GenerateDoneOutputSchema, 'GenerateDoneOutput');
};

export const getGenerateResultParams = (event: unknown): CacheGenerateResultParams => {
  const output = getGenerateDoneOutput(event);

  return {
    content: output?.type === 'GENERATE_TERMINATED_SUCCESS' ? (output.content ?? '') : '',
    inputTokens: output?.type === 'GENERATE_TERMINATED_SUCCESS' ? (output.metrics?.inputTokens ?? 0) : 0,
    outputTokens: output?.type === 'GENERATE_TERMINATED_SUCCESS' ? (output.metrics?.outputTokens ?? 0) : 0,
    costUsd: output?.type === 'GENERATE_TERMINATED_SUCCESS' ? (output.metrics?.costUsd ?? 0) : 0,
  };
};

export const getStreamResultParams = (event: unknown): CacheStreamResultParams => {
  const output = getStreamDoneOutput(event);

  return {
    content: output?.content ?? '',
    inputTokens: output?.metrics?.inputTokens ?? 0,
    outputTokens: output?.metrics?.outputTokens ?? 0,
    costUsd: output?.metrics?.costUsd ?? 0,
  };
};

export const isEmptyStreamSuccess = (event: unknown): boolean => {
  const output = getStreamDoneOutput(event);
  if (!output || output.type !== 'STREAM_TERMINATED_SUCCESS') {
    return false;
  }

  const content = typeof output.content === 'string' ? output.content : '';
  const outputTokens = output.metrics?.outputTokens ?? 0;
  return content.trim().length === 0 && outputTokens === 0;
};

export const getExtractionDoneOutput = (event: unknown): ExtractionDoneOutput | undefined => {
  const output = (event as { output?: unknown }).output;
  return validateOutput(output, ExtractionDoneOutputSchema, 'ExtractionDoneOutput');
};

export const getExtractionResultParams = (event: unknown): CacheExtractionResultParams => {
  const output = getExtractionDoneOutput(event);
  if (!output || output.type !== 'EXTRACTION_ATTEMPT_ACCEPTED') {
    return {
      content: '',
      structuredPayload: {},
    };
  }

  return {
    content: output.content,
    structuredPayload: output.structuredPayload,
  };
};

export const getToolDoneOutput = (event: unknown): ToolDoneOutput | undefined => {
  const output = (event as { output?: unknown }).output;
  return validateOutput(output, ToolDoneOutputSchema, 'ToolDoneOutput');
};

export const getAcquisitionDoneOutput = (event: unknown): AcquisitionDoneOutput | undefined => {
  const output = (event as { output?: unknown }).output;
  return validateOutput(output, AcquisitionDoneOutputSchema, 'AcquisitionDoneOutput');
};

export const getAcquisitionResultParams = (event: unknown): CacheAcquisitionResultParams => {
  const output = getAcquisitionDoneOutput(event);
  if (!output || output.type !== 'ACQUISITION_ATTEMPT_ACCEPTED') {
    return {
      payload: {},
    };
  }

  return {
    payload: output.payload,
  };
};

export const getCrawlingDoneOutput = (event: unknown): CrawlingDoneOutput | undefined => {
  const output = (event as { output?: unknown }).output;
  return validateOutput(output, CrawlingDoneOutputSchema, 'CrawlingDoneOutput');
};

export const getCrawlingResultParams = (event: unknown): CacheCrawlingResultParams => {
  const output = getCrawlingDoneOutput(event);
  if (!output || output.type !== 'CRAWLING_COMPLETED') {
    return {
      crawlArtifacts: [],
      paaQueries: [],
    };
  }

  return {
    crawlArtifacts: output.crawlArtifacts,
    paaQueries: output.paaQueries,
  };
};

export const getScoringDoneOutput = (event: unknown): ScoringDoneOutput | undefined => {
  const output = (event as { output?: unknown }).output;
  return validateOutput(output, ScoringDoneOutputSchema, 'ScoringDoneOutput');
};

export const getScoringResultParams = (event: unknown): CacheScoringResultParams => {
  const output = getScoringDoneOutput(event);
  if (!output || output.type !== 'SCORING_COMPLETED') {
    return {
      ranking: {},
    };
  }

  return {
    ranking: output.ranking,
  };
};

export const isExtractionPayloadSemanticallyValid = (payload: Record<string, unknown>): boolean => {
  const fields = payload.fields;
  if (!fields || typeof fields !== 'object') {
    return false;
  }

  const briefingSummary = (fields as Record<string, unknown>).briefing_summary;
  return typeof briefingSummary === 'string' && briefingSummary.trim().length > 0;
};

export const getInvokeFailureReason = (event: unknown): string =>
  (event as { output?: { reason?: string } }).output?.reason ?? 'generation_failed';

export const getReplayPayloadParams = (event: unknown): CacheReplayPayloadParams => {
  const output = getIdempotencyDoneOutput(event);
  if (output.type !== 'IDEMPOTENCY_REPLAY_READY') {
    return {
      artifactId: '',
      content: '',
    };
  }

  return {
    artifactId: output.artifactId,
    content: output.metadata.content,
  };
};