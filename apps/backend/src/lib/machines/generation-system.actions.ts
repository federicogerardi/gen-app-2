import { assign, enqueueActions } from 'xstate';
import type { ParameterizedObject } from 'xstate';
import type { Assigner, PropertyAssigner } from 'xstate';
import { mergeAcquisitionIntoGenerationInput } from './generation/context-generation-assembly';

import type { GenerationSystemEvent } from '../types/xstate';
import { toOptionalString } from './generation/request-normalizers';
import type { GenerationSystemProvidedActor } from './generation-system.actors';
import type {
  CacheAcquisitionResultParams,
  CacheExtractionResultParams,
  CacheReplayPayloadParams,
  CacheRequestMetaParams,
  CacheStreamResultParams,
  QueueFallbackDecisionParams,
  SetValidationDataParams,
  GenerationMachineContext,
} from './generation-system.types';

type GenerationActionArgs = {
  context: GenerationMachineContext;
  event: GenerationSystemEvent;
};

type GenerationSystemActionObject =
  | { type: 'cacheRequestMeta'; params: CacheRequestMetaParams }
  | { type: 'setUserId'; params: { userId: string } }
  | { type: 'setValidationData'; params: SetValidationDataParams }
  | { type: 'setFailureReason'; params: { reason: string } }
  | { type: 'setAmbiguousRoutingFailure'; params: undefined }
  | { type: 'setMissingRegistrySelectorFailure'; params: undefined }
  | { type: 'setExtractionFailedFailure'; params: undefined }
  | { type: 'setWorkflowFailedFailure'; params: undefined }
  | { type: 'setIdempotencyConflictFailure'; params: undefined }
  | { type: 'setUsageFailedFailure'; params: undefined }
  | { type: 'setOwnershipFailedFailure'; params: undefined }
  | { type: 'setStreamFailureFailure'; params: undefined }
  | { type: 'setPersistenceFinalizeFailedFailure'; params: undefined }
  | { type: 'cacheReplayPayload'; params: CacheReplayPayloadParams }
  | { type: 'cacheArtifactId'; params: undefined }
  | { type: 'ensureArtifactId'; params: undefined }
  | { type: 'cacheSyntheticChunk'; params: undefined }
  | { type: 'cacheStreamResult'; params: CacheStreamResultParams }
  | { type: 'cacheAcquisitionResult'; params: CacheAcquisitionResultParams }
  | { type: 'cacheExtractionResult'; params: CacheExtractionResultParams }
  | { type: 'drivePersistenceFinalizeSuccess'; params: undefined }
  | { type: 'drivePersistenceFinalizeFailure'; params: undefined }
  | { type: 'setFailureFromInvokeOutput'; params: { reason: string } }
  | { type: 'queueFallbackDecision'; params: QueueFallbackDecisionParams }
  | { type: 'applyFallbackDecision'; params: { reason: string } }
  | { type: 'setFallbackPolicyFailure'; params: undefined }
  | { type: 'cacheToolArtifactFromOutput'; params: { artifactId: string | null } }
  | { type: 'appendStreamChunk'; params: { chunk: string } }
  | { type: 'resetVolatileContext'; params: undefined };

type GenerationSystemGuardObject =
  | { type: 'hasRegistrySelector'; params: unknown }
  | { type: 'hasAmbiguousRouting'; params: unknown }
  | { type: 'routeIsExtraction'; params: unknown }
  | { type: 'routeIsTool'; params: unknown }
  | { type: 'routeIsGeneric'; params: unknown }
  | { type: 'hasApiAcquisition'; params: unknown }
  | { type: 'idempotencyOutputIsReplay'; params: unknown }
  | { type: 'idempotencyOutputIsConflict'; params: unknown }
  | { type: 'usageOutputIsRejected'; params: unknown }
  | { type: 'ownershipOutputIsRejected'; params: unknown }
  | { type: 'streamOutputIsFailure'; params: unknown }
  | { type: 'streamOutputIsEmptySuccess'; params: unknown }
  | { type: 'extractionOutputIsAccepted'; params: unknown }
  | { type: 'acquisitionOutputIsAccepted'; params: unknown }
  | { type: 'toolOutputIsCompleted'; params: unknown };

type GenerationAssignment<TParams extends ParameterizedObject['params'] | undefined> =
  | Assigner<
    GenerationMachineContext,
    GenerationSystemEvent,
    TParams,
    GenerationSystemEvent,
    never
  >
  | PropertyAssigner<
    GenerationMachineContext,
    GenerationSystemEvent,
    TParams,
    GenerationSystemEvent,
    never
  >;

const assignGeneration = <TParams extends ParameterizedObject['params'] | undefined>(
  assignment: GenerationAssignment<TParams>,
) =>
  assign<
    GenerationMachineContext,
    GenerationSystemEvent,
    TParams,
    GenerationSystemEvent,
    never
  >(assignment);

type GenerationCollectActions<TParams extends ParameterizedObject['params'] | undefined> = Parameters<
  typeof enqueueActions<
    GenerationMachineContext,
    GenerationSystemEvent,
    TParams,
    GenerationSystemEvent,
    GenerationSystemProvidedActor,
    GenerationSystemActionObject,
    GenerationSystemGuardObject
  >
>[0];

const enqueueGenerationActions = <TParams extends ParameterizedObject['params'] | undefined>(
  collect: GenerationCollectActions<TParams>,
) =>
  enqueueActions<
    GenerationMachineContext,
    GenerationSystemEvent,
    TParams,
    GenerationSystemEvent,
    GenerationSystemProvidedActor,
    GenerationSystemActionObject,
    GenerationSystemGuardObject
  >(collect);

export const generationSystemActions = {
  cacheRequestMeta: assignGeneration<CacheRequestMetaParams>({
    requestId: (_: GenerationActionArgs, params: CacheRequestMetaParams) => params.requestId,
    projectId: (_: GenerationActionArgs, params: CacheRequestMetaParams) => params.projectId,
    sessionId: (_: GenerationActionArgs, params: CacheRequestMetaParams) => params.sessionId,
    toolKey: (_: GenerationActionArgs, params: CacheRequestMetaParams) => params.toolKey,
    artifactType: (_: GenerationActionArgs, params: CacheRequestMetaParams) => params.artifactType,
    workflowType: (_: GenerationActionArgs, params: CacheRequestMetaParams) => params.workflowType,
    model: (_: GenerationActionArgs, params: CacheRequestMetaParams) => params.model,
    requestInput: (_: GenerationActionArgs, params: CacheRequestMetaParams) => params.input,
    idempotencyKey: (_: GenerationActionArgs, params: CacheRequestMetaParams) => params.idempotencyKey,
    outputFormat: (_: GenerationActionArgs, params: CacheRequestMetaParams) => params.outputFormat,
    registryVersion: (_: GenerationActionArgs, params: CacheRequestMetaParams) => params.registryVersion,
    registrySnapshotRef: (_: GenerationActionArgs, params: CacheRequestMetaParams) => params.registrySnapshotRef,
    routeType: (_: GenerationActionArgs, params: CacheRequestMetaParams) => params.routeType,
    failureReason: null,
    syntheticResponse: (_: GenerationActionArgs, params: CacheRequestMetaParams) => params.syntheticResponse,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    contentBuffer: '',
    artifactId: null,
    pendingFallback: null,
  }),
  setUserId: assignGeneration<{ userId: string }>({
    userId: (_: GenerationActionArgs, params: { userId: string }) => params.userId,
  }),
  setValidationData: assignGeneration<SetValidationDataParams>({
    workflowType: (_: GenerationActionArgs, params: SetValidationDataParams) => params.workflowType,
    registryVersion: (_: GenerationActionArgs, params: SetValidationDataParams) => params.registryVersion,
    registrySnapshotRef: (_: GenerationActionArgs, params: SetValidationDataParams) => params.registrySnapshotRef,
    routeType: (_: GenerationActionArgs, params: SetValidationDataParams) => params.routeType,
  }),
  setFailureReason: assignGeneration<{ reason: string }>({
    failureReason: (_: GenerationActionArgs, params: { reason: string }) => params.reason,
  }),
  setAmbiguousRoutingFailure: assignGeneration<undefined>({
    failureReason: 'ambiguous_routing',
  }),
  setMissingRegistrySelectorFailure: assignGeneration<undefined>({
    failureReason: 'missing_registry_selector',
  }),
  setExtractionFailedFailure: assignGeneration<undefined>({
    failureReason: 'extraction_failed',
  }),
  setWorkflowFailedFailure: assignGeneration<undefined>({
    failureReason: 'workflow_failed',
  }),
  setIdempotencyConflictFailure: assignGeneration<undefined>({
    failureReason: 'idempotency_conflict',
  }),
  setUsageFailedFailure: assignGeneration<undefined>({
    failureReason: 'usage_failed',
  }),
  setOwnershipFailedFailure: assignGeneration<undefined>({
    failureReason: 'ownership_failed',
  }),
  setStreamFailureFailure: assignGeneration<undefined>({
    failureReason: 'stream_failure',
  }),
  setPersistenceFinalizeFailedFailure: assignGeneration<undefined>({
    failureReason: 'persistence_finalize_failed',
  }),
  cacheReplayPayload: assignGeneration<CacheReplayPayloadParams>({
    artifactId: (_: GenerationActionArgs, params: CacheReplayPayloadParams) => params.artifactId,
    contentBuffer: (_: GenerationActionArgs, params: CacheReplayPayloadParams) => params.content,
  }),
  cacheArtifactId: assignGeneration<undefined>({
    artifactId: ({ event, context }: GenerationActionArgs) => {
      if (event.type === 'STREAM_SESSION_STARTED') {
        return event.artifactId;
      }
      return context.artifactId;
    },
  }),
  ensureArtifactId: assignGeneration<undefined>({
    artifactId: ({ context }: GenerationActionArgs) => context.artifactId ?? context.artifactIdFactory(),
  }),
  cacheSyntheticChunk: assignGeneration<undefined>({
    contentBuffer: ({ context }: GenerationActionArgs) => context.syntheticResponse,
  }),
  cacheStreamResult: assignGeneration<CacheStreamResultParams>({
    contentBuffer: ({ context }: GenerationActionArgs, params: CacheStreamResultParams) =>
      params.content.length > 0 ? params.content : context.contentBuffer,
    inputTokens: ({ context }: GenerationActionArgs, params: CacheStreamResultParams) =>
      params.inputTokens > 0 ? params.inputTokens : context.inputTokens,
    outputTokens: ({ context }: GenerationActionArgs, params: CacheStreamResultParams) =>
      params.outputTokens > 0 ? params.outputTokens : context.outputTokens,
    costUsd: ({ context }: GenerationActionArgs, params: CacheStreamResultParams) =>
      params.costUsd > 0 ? params.costUsd : context.costUsd,
  }),
  cacheAcquisitionResult: assignGeneration<CacheAcquisitionResultParams>({
    requestInput: ({ context }: GenerationActionArgs, params: CacheAcquisitionResultParams) =>
      mergeAcquisitionIntoGenerationInput(context.requestInput, params.payload),
  }),
  cacheExtractionResult: assignGeneration<CacheExtractionResultParams>({
    contentBuffer: (_: GenerationActionArgs, params: CacheExtractionResultParams) => params.content,
    requestInput: ({ context }: GenerationActionArgs, params: CacheExtractionResultParams) => ({
      ...context.requestInput,
      extractionPayload: params.structuredPayload,
    }),
    inputTokens: ({ context }: GenerationActionArgs) =>
      Math.max(context.inputTokens, Math.max(1, Math.ceil(JSON.stringify(context.requestInput).length / 4))),
    outputTokens: (_: GenerationActionArgs, params: CacheExtractionResultParams) =>
      Math.max(1, Math.ceil(params.content.length / 4)),
    costUsd: ({ context }: GenerationActionArgs) =>
      context.costUsd > 0 ? context.costUsd : 0,
  }),
  drivePersistenceFinalizeSuccess: enqueueGenerationActions<undefined>(({ enqueue, context }) => {
    enqueue.sendTo('persistenceActor', {
      type: 'STREAM_TERMINATED_SUCCESS',
      requestId: context.requestId,
      sourceActor: 'streamTransportMachine',
      timestamp: context.runtimeNow().toISOString(),
      artifactId: context.artifactId ?? context.artifactIdFactory(),
    });
  }),
  drivePersistenceFinalizeFailure: enqueueGenerationActions<undefined>(({ enqueue, context }) => {
    enqueue.sendTo('persistenceActor', {
      type: 'STREAM_TERMINATED_FAILURE',
      requestId: context.requestId,
      sourceActor: 'streamTransportMachine',
      timestamp: context.runtimeNow().toISOString(),
      artifactId: context.artifactId ?? context.artifactIdFactory(),
      reason: context.failureReason ?? 'generation_failed',
    });
  }),
  setFailureFromInvokeOutput: assignGeneration<{ reason: string }>({
    failureReason: (_: GenerationActionArgs, params: { reason: string }) => params.reason,
  }),
  queueFallbackDecision: assignGeneration<QueueFallbackDecisionParams>({
    failureReason: ({ context }: GenerationActionArgs, params: QueueFallbackDecisionParams) =>
      toOptionalString(params.reason)
      ?? toOptionalString(params.defaultReason)
      ?? context.failureReason,
    pendingFallback: (_: GenerationActionArgs, params: QueueFallbackDecisionParams) => ({
      reason: toOptionalString(params.reason),
      defaultReason: toOptionalString(params.defaultReason) ?? 'generation_failed',
    }),
  }),
  applyFallbackDecision: assignGeneration<{ reason: string }>({
    failureReason: (_: GenerationActionArgs, params: { reason: string }) => params.reason,
    pendingFallback: null,
  }),
  setFallbackPolicyFailure: assignGeneration<undefined>({
    failureReason: 'generation_failed',
    pendingFallback: null,
  }),
  cacheToolArtifactFromOutput: assignGeneration<{ artifactId: string | null }>({
    artifactId: ({ context }: GenerationActionArgs, params: { artifactId: string | null }) =>
      params.artifactId ?? context.artifactId,
  }),
  appendStreamChunk: assignGeneration<{ chunk: string }>({
    contentBuffer: ({ context }: GenerationActionArgs, params: { chunk: string }) =>
      `${context.contentBuffer}${params.chunk}`,
  }),
  resetVolatileContext: assignGeneration<undefined>({
    requestId: '',
    userId: null,
    projectId: null,
    toolKey: null,
    registryVersion: null,
    registrySnapshotRef: null,
    workflowType: null,
    artifactType: 'content',
    model: 'unknown',
    requestInput: {},
    idempotencyKey: null,
    outputFormat: 'plain',
    artifactId: null,
    contentBuffer: '',
    failureReason: null,
    syntheticResponse: '',
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    routeType: null,
    pendingFallback: null,
  }),
};