import type { OutputFormat } from '../types/artifact';
import type {
  RegistryBackedToolKey,
  RegistryBackedWorkflowType,
  RegistryBackedArtifactType,
  RegistryVersion,
  RegistrySnapshotRef,
  RequestReceivedEvent,
} from '../types/xstate';
import type { GenerationAdapters } from '../adapters/generation.adapters';
import type { EffectiveModelResolution } from '../types/step-llm-model-override';
import type { RouteType } from './generation-routing';

export type GenerationDomainContext = {
  readonly requestId: string;
  readonly userId: string | null;
  readonly projectId: string | null;
  readonly sessionId: string | null;
  readonly toolKey: RegistryBackedToolKey | null;
  readonly workflowType: RegistryBackedWorkflowType;
  readonly artifactType: RegistryBackedArtifactType;
  readonly artifactId: string | null;
  readonly contentBuffer: string;
  readonly failureReason: string | null;
};

export type GenerationRuntimeContext = {
  readonly model: string;
  readonly requestInput: Record<string, unknown>;
  readonly idempotencyKey: string | null;
  readonly outputFormat: OutputFormat;
  readonly syntheticResponse: string;
  readonly routeType: RouteType;
  readonly effectiveModelResolution: EffectiveModelResolution | null;
  readonly mode: 'generate' | 'stream';
};

export type GenerationMetricsContext = {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
  readonly _creditCost: number;
};

export type GenerationInfraContext = {
  readonly adapters: GenerationAdapters;
  readonly runtimeNow: () => Date;
  readonly artifactIdFactory: () => string;
  readonly responseBuilder: (request: RequestReceivedEvent) => string;
};

export type GenerationErrorContext = {
  readonly pendingFallback: {
    readonly reason: string | null;
    readonly defaultReason: string;
  } | null;
  readonly registryVersion: RegistryVersion | null;
  readonly registrySnapshotRef: RegistrySnapshotRef | null;
};

export type DecomposedGenerationContext =
  GenerationDomainContext &
  GenerationRuntimeContext &
  GenerationMetricsContext &
  GenerationInfraContext &
  GenerationErrorContext;
