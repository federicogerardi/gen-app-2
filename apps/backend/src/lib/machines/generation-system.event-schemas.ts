import { z } from 'zod';

const MetricsSchema = z.object({
  inputTokens: z.number(),
  outputTokens: z.number(),
  costUsd: z.number(),
});

export const StreamDoneOutputSchema = z.union([
  z.object({
    type: z.literal('STREAM_TERMINATED_SUCCESS'),
    content: z.string().optional(),
    metrics: MetricsSchema.optional(),
  }),
  z.object({
    type: z.literal('STREAM_TERMINATED_FAILURE'),
    reason: z.string(),
    content: z.string().optional(),
    metrics: MetricsSchema.optional(),
  }),
]);

export const GenerateDoneOutputSchema = z.union([
  z.object({
    type: z.literal('GENERATE_TERMINATED_SUCCESS'),
    content: z.string().optional(),
    metrics: MetricsSchema.optional(),
  }),
  z.object({
    type: z.literal('GENERATE_TERMINATED_FAILURE'),
    reason: z.string().optional(),
    metrics: MetricsSchema.optional(),
  }),
]);

export const IdempotencyDoneOutputSchema = z.union([
  z.object({ type: z.literal('IDEMPOTENCY_CLAIMED') }),
  z.object({
    type: z.literal('IDEMPOTENCY_REPLAY_READY'),
    artifactId: z.string(),
    metadata: z.object({ content: z.string() }),
  }),
  z.object({
    type: z.literal('IDEMPOTENCY_CONFLICT'),
    reason: z.string(),
  }),
]);

export const UsageDoneOutputSchema = z.union([
  z.object({
    type: z.literal('USAGE_GRANTED'),
    creditCost: z.number().optional(),
  }),
  z.object({
    type: z.literal('USAGE_REJECTED'),
    reason: z.string(),
  }),
]);

export const OwnershipDoneOutputSchema = z.union([
  z.object({ type: z.literal('OWNERSHIP_OK') }),
  z.object({
    type: z.literal('OWNERSHIP_REJECTED'),
    reason: z.string(),
  }),
]);

export const ExtractionDoneOutputSchema = z.union([
  z.object({
    type: z.literal('EXTRACTION_ATTEMPT_ACCEPTED'),
    artifactId: z.string(),
    content: z.string(),
    structuredPayload: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal('EXTRACTION_ATTEMPT_REJECTED'),
    reason: z.string(),
  }),
  z.object({
    type: z.literal('EXTRACTION_CHAIN_EXHAUSTED'),
    reason: z.string(),
  }),
]);

export const ToolDoneOutputSchema = z.union([
  z.object({ type: z.literal('WORKFLOW_STEP_UNLOCKED') }),
  z.object({
    type: z.literal('WORKFLOW_STEP_COMPLETED'),
    artifactId: z.string(),
  }),
]);

export const AcquisitionDoneOutputSchema = z.union([
  z.object({
    type: z.literal('ACQUISITION_ATTEMPT_ACCEPTED'),
    statusCode: z.number(),
    payload: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal('ACQUISITION_ATTEMPT_SKIPPED'),
    reason: z.string(),
  }),
]);

const CrawlArtifactSchema = z.object({
  query: z.string(),
  isPaa: z.boolean(),
  content: z.string(),
  structuredPayload: z.record(z.string(), z.unknown()),
});

export const CrawlingDoneOutputSchema = z.union([
  z.object({
    type: z.literal('CRAWLING_COMPLETED'),
    crawlArtifacts: z.array(CrawlArtifactSchema),
    paaQueries: z.array(z.string()),
  }),
  z.object({
    type: z.literal('CRAWLING_FAILED'),
    reason: z.string(),
  }),
]);

export const ScoringDoneOutputSchema = z.union([
  z.object({
    type: z.literal('SCORING_COMPLETED'),
    ranking: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal('SCORING_FAILED'),
    reason: z.string(),
  }),
]);
