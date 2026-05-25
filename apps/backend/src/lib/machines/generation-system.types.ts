import type { GenerationAdapters } from '../adapters/generation.adapters';
import type { OutputFormat } from '../types/artifact';
import type {
  GenerationSystemContext,
  RegistryBackedWorkflowType,
  RequestReceivedEvent,
} from '../types/xstate';
import type { RouteType } from './generation-routing';

export type GenerationSystemInput = {
  adapters: GenerationAdapters;
  initialContext?: Partial<GenerationSystemContext>;
  runtime?: {
    now?: () => Date;
    artifactIdFactory?: () => string;
    responseBuilder?: (request: RequestReceivedEvent) => string;
  };
};

export type GenerationMachineContext = GenerationSystemContext & {
  adapters: GenerationAdapters;
  model: string;
  requestInput: Record<string, unknown>;
  idempotencyKey: string | null;
  outputFormat: OutputFormat;
  syntheticResponse: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  routeType: RouteType;
  runtimeNow: () => Date;
  artifactIdFactory: () => string;
  responseBuilder: (request: RequestReceivedEvent) => string;
  pendingFallback: {
    reason: string | null;
    defaultReason: string;
  } | null;
};

export type IdempotencyDoneOutput =
  | { type: 'IDEMPOTENCY_CLAIMED' }
  | { type: 'IDEMPOTENCY_REPLAY_READY'; artifactId: string; metadata: { content: string } }
  | { type: 'IDEMPOTENCY_CONFLICT'; reason: string };

export type UsageDoneOutput =
  | { type: 'USAGE_GRANTED' }
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

export type QueueFallbackDecisionParams = {
  reason?: string | null;
  defaultReason: string;
};