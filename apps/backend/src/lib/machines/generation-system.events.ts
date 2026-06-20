import type { GenerationFallbackOutput } from './generation-fallback.actor';
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

export const getIdempotencyDoneOutput = (event: unknown): IdempotencyDoneOutput =>
  (event as { output: IdempotencyDoneOutput }).output;

export const getUsageDoneOutput = (event: unknown): UsageDoneOutput | undefined =>
  (event as { output?: UsageDoneOutput }).output;

export const getOwnershipDoneOutput = (event: unknown): OwnershipDoneOutput | undefined =>
  (event as { output?: OwnershipDoneOutput }).output;

export const getStreamDoneOutput = (event: unknown): StreamDoneOutput | undefined =>
  (event as { output?: StreamDoneOutput }).output;

export const getGenerateDoneOutput = (event: unknown): GenerateDoneOutput | undefined =>
  (event as { output?: GenerateDoneOutput }).output;

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

export const getExtractionDoneOutput = (event: unknown): ExtractionDoneOutput | undefined =>
  (event as { output?: ExtractionDoneOutput }).output;

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

export const getToolDoneOutput = (event: unknown): ToolDoneOutput | undefined =>
  (event as { output?: ToolDoneOutput }).output;

export const getAcquisitionDoneOutput = (event: unknown): AcquisitionDoneOutput | undefined =>
  (event as { output?: AcquisitionDoneOutput }).output;

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

export const getCrawlingDoneOutput = (event: unknown): CrawlingDoneOutput | undefined =>
  (event as { output?: CrawlingDoneOutput }).output;

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

export const getScoringDoneOutput = (event: unknown): ScoringDoneOutput | undefined =>
  (event as { output?: ScoringDoneOutput }).output;

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

export const getFallbackDoneOutput = (event: unknown): GenerationFallbackOutput | undefined =>
  (event as { output?: GenerationFallbackOutput }).output;

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