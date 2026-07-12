import type { GenerationAdapters } from '../adapters/generation.adapters';
import type { OutputFormat } from '../types/artifact';
import type {
  GenerationSystemContext,
  RegistryBackedWorkflowType,
  RequestReceivedEvent,
} from '../types/xstate';
import type { EffectiveModelResolution } from '../types/step-llm-model-override';
import type { RouteType } from './generation-routing';
import type { DecomposedGenerationContext } from './generation-system.context-types';

export type GenerationSystemInput = {
  adapters: GenerationAdapters;
  initialContext?: Partial<GenerationSystemContext>;
  runtime?: {
    now?: () => Date;
    artifactIdFactory?: () => string;
    responseBuilder?: (request: RequestReceivedEvent) => string;
  };
};

/**
 * @deprecated Use sub-context accessors from generation-system.context-accessors.ts.
 * Direct field access will be removed in Sprint 6 (post error-actors wiring).
 * Migration path:
 * - selectDomainContext() for business logic fields (DDD-167)
 * - selectRuntimeContext() for request execution fields (DDD-168)
 * - selectMetricsContext() for usage tracking fields (DDD-169)
 * - selectInfraContext() for adapter layer fields (DDD-170)
 * - selectErrorContext() for error handling fields (DDD-171)
 *
 * Sprint 5 keeps this alias for backward compatibility — all existing actions/guards
 * continue to work unchanged. Sprint 6 will remove the alias once error-actors wiring
 * is complete and all consumers migrate to accessor usage.
 */
export type GenerationMachineContext = DecomposedGenerationContext;

export type IdempotencyDoneOutput =
  | { type: 'IDEMPOTENCY_CLAIMED' }
  | { type: 'IDEMPOTENCY_REPLAY_READY'; artifactId: string; metadata: { content: string } }
  | { type: 'IDEMPOTENCY_CONFLICT'; reason: string };

export type UsageDoneOutput =
  | { type: 'USAGE_GRANTED'; creditCost?: number }
  | { type: 'USAGE_REJECTED'; reason: string };

export type OwnershipDoneOutput =
  | { type: 'OWNERSHIP_OK' }
  | { type: 'OWNERSHIP_REJECTED'; reason: string };

export type StreamDoneOutput =
  | {
      type: 'STREAM_TERMINATED_SUCCESS';
      content?: string;
      metrics?: { inputTokens: number; outputTokens: number; costUsd: number };
    }
  | {
      type: 'STREAM_TERMINATED_FAILURE';
      reason: string;
      content?: string;
      metrics?: { inputTokens: number; outputTokens: number; costUsd: number };
    };

export type ExtractionDoneOutput =
  | {
      type: 'EXTRACTION_ATTEMPT_ACCEPTED';
      artifactId: string;
      content: string;
      structuredPayload: Record<string, unknown>;
    }
  | { type: 'EXTRACTION_ATTEMPT_REJECTED'; reason: string }
  | { type: 'EXTRACTION_CHAIN_EXHAUSTED'; reason: string };

export type ToolDoneOutput =
  | { type: 'WORKFLOW_STEP_UNLOCKED' }
  | { type: 'WORKFLOW_STEP_COMPLETED'; artifactId: string };

export type AcquisitionDoneOutput =
  | { type: 'ACQUISITION_ATTEMPT_ACCEPTED'; statusCode: number; payload: Record<string, unknown> }
  | { type: 'ACQUISITION_ATTEMPT_SKIPPED'; reason: string };

export type CrawlingDoneOutput =
  | { type: 'CRAWLING_COMPLETED'; crawlArtifacts: { query: string; isPaa: boolean; content: string; structuredPayload: Record<string, unknown> }[]; paaQueries: string[] }
  | { type: 'CRAWLING_FAILED'; reason: string };

export type CacheCrawlingResultParams = {
  crawlArtifacts: { query: string; isPaa: boolean; content: string; structuredPayload: Record<string, unknown> }[];
  paaQueries: string[];
};

export type CacheRequestMetaParams = {
  requestId: string;
  projectId: string;
  sessionId: string | null;
  toolKey: string | null;
  artifactType: string;
  workflowType: RegistryBackedWorkflowType;
  model: string;
  input: Record<string, unknown>;
  idempotencyKey: string | null;
  outputFormat: OutputFormat;
  registryVersion: string | null;
  registrySnapshotRef: string | null;
  routeType: RouteType;
  syntheticResponse: string;
  effectiveModelResolution: EffectiveModelResolution | null;
};

export type SetValidationDataParams = {
  workflowType: RegistryBackedWorkflowType;
  registryVersion: string | null;
  registrySnapshotRef: string | null;
  routeType: RouteType;
};

export type CacheReplayPayloadParams = {
  artifactId: string;
  content: string;
};

export type CacheStreamResultParams = {
  content: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type CacheExtractionResultParams = {
  content: string;
  structuredPayload: Record<string, unknown>;
};

export type CacheAcquisitionResultParams = {
  payload: Record<string, unknown>;
};

export type ScoringDoneOutput =
  | { type: 'SCORING_COMPLETED'; ranking: Record<string, unknown> }
  | { type: 'SCORING_FAILED'; reason: string };

export type CacheScoringResultParams = {
  ranking: Record<string, unknown>;
};

export type CacheGenerateResultParams = {
  content: string;
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
  costUsd?: number | undefined;
};

export type GenerateDoneOutput =
  | { type: 'GENERATE_TERMINATED_SUCCESS'; content: string; metrics?: { inputTokens: number; outputTokens: number; costUsd: number } | undefined }
  | { type: 'GENERATE_TERMINATED_FAILURE'; reason: string };

export type QueueFallbackDecisionParams = {
  reason?: string | null;
  defaultReason: string;
};