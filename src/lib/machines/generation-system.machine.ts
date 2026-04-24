import { assign, enqueueActions, fromPromise, setup } from 'xstate';

import type { GenerationAdapters } from '../adapters/generation.adapters';
import { extractionChainMachine } from './extraction-chain.machine';
import { idempotencyCoordinatorMachine } from './idempotency-coordinator.machine';
import { persistenceBatchMachine } from './persistence-batch.machine';
import { streamTransportMachine } from './stream-transport.machine';
import { toolWorkflowMachine } from './tool-workflow.machine';
import { usageMachine } from './usage.machine';

import type {
  GenerationSystemContext,
  GenerationSystemEvent,
  RequestReceivedEvent,
  RegistryBackedWorkflowType,
} from '../types/xstate';
import type { OutputFormat } from '../types/artifact';

type GenerationSystemInput = {
  adapters: GenerationAdapters;
  initialContext?: Partial<GenerationSystemContext>;
  runtime?: {
    now?: () => Date;
    artifactIdFactory?: () => string;
    responseBuilder?: (request: RequestReceivedEvent) => string;
  };
};

type RouteType = 'generic' | 'tool' | 'extraction' | null;

type GenerationMachineContext = GenerationSystemContext & {
  adapters: GenerationAdapters;
  model: string;
  requestInput: Record<string, unknown>;
  idempotencyKey: string | null;
  outputFormat: OutputFormat;
  syntheticResponse: string;
  routeType: RouteType;
  runtimeNow: () => Date;
  artifactIdFactory: () => string;
  responseBuilder: (request: RequestReceivedEvent) => string;
};

type IdempotencyDoneOutput =
  | { type: 'IDEMPOTENCY_CLAIMED' }
  | { type: 'IDEMPOTENCY_REPLAY_READY'; artifactId: string; metadata: { content: string } }
  | { type: 'IDEMPOTENCY_CONFLICT'; reason: string };

type UsageDoneOutput =
  | { type: 'USAGE_GRANTED' }
  | { type: 'USAGE_REJECTED'; reason: string };

type StreamDoneOutput =
  | { type: 'STREAM_TERMINATED_SUCCESS' }
  | { type: 'STREAM_TERMINATED_FAILURE'; reason: string };

type ExtractionDoneOutput =
  | { type: 'EXTRACTION_ATTEMPT_ACCEPTED' }
  | { type: 'EXTRACTION_ATTEMPT_REJECTED'; reason: string }
  | { type: 'EXTRACTION_CHAIN_EXHAUSTED'; reason: string };

type ToolDoneOutput =
  | { type: 'WORKFLOW_STEP_UNLOCKED' }
  | { type: 'WORKFLOW_STEP_COMPLETED'; artifactId: string };

type CacheRequestMetaParams = {
  requestId: string;
  projectId: string;
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

type SetValidationDataParams = {
  workflowType: RegistryBackedWorkflowType;
  registryVersion: string | null;
  registrySnapshotRef: string | null;
  routeType: RouteType;
};

type CacheReplayPayloadParams = {
  artifactId: string;
  content: string;
};

const getIdempotencyDoneOutput = (event: unknown): IdempotencyDoneOutput =>
  (event as { output: IdempotencyDoneOutput }).output;

const getReplayPayloadParams = (event: unknown): CacheReplayPayloadParams => {
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

const defaultArtifactIdFactory = (): string =>
  `artifact-${Math.random().toString(36).slice(2, 10)}`;

const normalizeOutputFormat = (value: unknown): OutputFormat => {
  if (value === 'json' || value === 'markdown' || value === 'plain') {
    return value;
  }

  return 'plain';
};

const defaultResponseBuilder = (request: RequestReceivedEvent): string => {
  const prompt = request.input?.prompt;
  if (typeof prompt === 'string' && prompt.trim().length > 0) {
    return `Generated output for prompt: ${prompt.trim()}`;
  }

  return `Generated output for request ${request.requestId}`;
};

const getRegistrySelector = (context: GenerationMachineContext) => {
  const registrySnapshotRef =
    (context.registrySnapshotRef ?? `snapshot:${context.requestId}`) as never;

  if (context.registryVersion) {
    return {
      registryVersion: context.registryVersion,
      registrySnapshotRef,
    };
  }

  return {
    registrySnapshotRef,
  };
};

const normalizeValue = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const getRouteType = (
  toolKey: string | null,
  workflowType: RegistryBackedWorkflowType,
  artifactType: string,
): RouteType => {
  const normalizedToolKey = normalizeValue(toolKey);
  const normalizedWorkflowType = normalizeValue(workflowType ?? null);
  const normalizedArtifactType = normalizeValue(artifactType);

  if (
    normalizedToolKey === 'extraction' ||
    normalizedWorkflowType === 'extraction' ||
    normalizedArtifactType === 'extraction'
  ) {
    return 'extraction';
  }

  if (normalizedToolKey !== null && normalizedToolKey !== 'extraction') {
    return 'tool';
  }

  if (normalizedToolKey === null && normalizedWorkflowType === null) {
    return 'generic';
  }

  return null;
};

export const generationSystemMachine = setup({
  types: {
    context: {} as GenerationMachineContext,
    input: {} as GenerationSystemInput,
    events: {} as GenerationSystemEvent,
  },
  actions: {
    cacheRequestMeta: assign({
      requestId: (_, params: CacheRequestMetaParams) => params.requestId,
      projectId: (_, params: CacheRequestMetaParams) => params.projectId,
      toolKey: (_, params: CacheRequestMetaParams) => params.toolKey,
      artifactType: (_, params: CacheRequestMetaParams) => params.artifactType,
      workflowType: (_, params: CacheRequestMetaParams) => params.workflowType,
      model: (_, params: CacheRequestMetaParams) => params.model,
      requestInput: (_, params: CacheRequestMetaParams) => params.input,
      idempotencyKey: (_, params: CacheRequestMetaParams) => params.idempotencyKey,
      outputFormat: (_, params: CacheRequestMetaParams) => params.outputFormat,
      registryVersion: (_, params: CacheRequestMetaParams) => params.registryVersion,
      registrySnapshotRef: (_, params: CacheRequestMetaParams) => params.registrySnapshotRef,
      routeType: (_, params: CacheRequestMetaParams) => params.routeType,
      failureReason: null,
      syntheticResponse: (_, params: CacheRequestMetaParams) => params.syntheticResponse,
      contentBuffer: '',
      artifactId: null,
    }),
    setUserId: assign({
      userId: (_, params: { userId: string }) => params.userId,
    }),
    setValidationData: assign({
      workflowType: (_, params: SetValidationDataParams) => params.workflowType,
      registryVersion: (_, params: SetValidationDataParams) => params.registryVersion,
      registrySnapshotRef: (_, params: SetValidationDataParams) => params.registrySnapshotRef,
      routeType: (_, params: SetValidationDataParams) => params.routeType,
    }),
    setFailureReason: assign({
      failureReason: (_, params: { reason: string }) => params.reason,
    }),
    setAmbiguousRoutingFailure: assign({
      failureReason: 'ambiguous_routing',
    }),
    setMissingRegistrySelectorFailure: assign({
      failureReason: 'missing_registry_selector',
    }),
    setExtractionFailedFailure: assign({
      failureReason: 'extraction_failed',
    }),
    setWorkflowFailedFailure: assign({
      failureReason: 'workflow_failed',
    }),
    setIdempotencyConflictFailure: assign({
      failureReason: 'idempotency_conflict',
    }),
    setUsageFailedFailure: assign({
      failureReason: 'usage_failed',
    }),
    setStreamFailureFailure: assign({
      failureReason: 'stream_failure',
    }),
    setPersistenceFinalizeFailedFailure: assign({
      failureReason: 'persistence_finalize_failed',
    }),
    cacheReplayPayload: assign({
      artifactId: (_, params: CacheReplayPayloadParams) => params.artifactId,
      contentBuffer: (_, params: CacheReplayPayloadParams) => params.content,
    }),
    cacheArtifactId: assign({
      artifactId: ({ event, context }) => {
        if (event.type === 'STREAM_SESSION_STARTED') {
          return event.artifactId;
        }
        return context.artifactId;
      },
    }),
    ensureArtifactId: assign({
      artifactId: ({ context }) => context.artifactId ?? context.artifactIdFactory(),
    }),
    cacheSyntheticChunk: assign({
      contentBuffer: ({ context }) => context.syntheticResponse,
    }),
    drivePersistenceFinalizeSuccess: enqueueActions(({ enqueue, context }) => {
      enqueue.sendTo('persistenceActor', {
        type: 'STREAM_TERMINATED_SUCCESS',
        requestId: context.requestId,
        sourceActor: 'streamTransportMachine',
        timestamp: context.runtimeNow().toISOString(),
        artifactId: context.artifactId ?? context.artifactIdFactory(),
      });
    }),
    drivePersistenceFinalizeFailure: enqueueActions(({ enqueue, context }) => {
      enqueue.sendTo('persistenceActor', {
        type: 'STREAM_TERMINATED_FAILURE',
        requestId: context.requestId,
        sourceActor: 'streamTransportMachine',
        timestamp: context.runtimeNow().toISOString(),
        artifactId: context.artifactId ?? context.artifactIdFactory(),
        reason: context.failureReason ?? 'generation_failed',
      });
    }),
    setFailureFromInvokeOutput: assign({
      failureReason: ({ event }) => {
        const output = (event as { output?: { reason?: string } }).output;
        return output?.reason ?? 'generation_failed';
      },
    }),
    cacheToolArtifactFromOutput: assign({
      artifactId: ({ event, context }) => {
        const output = (event as { output?: ToolDoneOutput }).output;
        if (output?.type === 'WORKFLOW_STEP_COMPLETED') {
          return output.artifactId;
        }
        return context.artifactId;
      },
    }),
    appendStreamChunk: assign({
      contentBuffer: ({ event, context }) =>
        event.type === 'STREAM_CHUNK_RECEIVED'
          ? `${context.contentBuffer}${event.metadata.chunk}`
          : context.contentBuffer,
    }),
    resetVolatileContext: assign({
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
      routeType: null,
    }),
  },
  guards: {
    hasRegistrySelector: ({ event }) =>
      event.type !== 'REQUEST_RECEIVED'
        ? true
        : Boolean(event.registryVersion || event.registrySnapshotRef),
    hasAmbiguousRouting: ({ context }) => context.routeType === null,
    routeIsExtraction: ({ context }) => context.routeType === 'extraction',
    routeIsTool: ({ context }) => context.routeType === 'tool',
    routeIsGeneric: ({ context }) => context.routeType === 'generic',
    idempotencyOutputIsReplay: ({ event }) =>
      ((event as { output?: IdempotencyDoneOutput }).output?.type ?? '') === 'IDEMPOTENCY_REPLAY_READY',
    idempotencyOutputIsConflict: ({ event }) =>
      ((event as { output?: IdempotencyDoneOutput }).output?.type ?? '') === 'IDEMPOTENCY_CONFLICT',
    usageOutputIsRejected: ({ event }) =>
      ((event as { output?: UsageDoneOutput }).output?.type ?? '') === 'USAGE_REJECTED',
    streamOutputIsFailure: ({ event }) =>
      ((event as { output?: StreamDoneOutput }).output?.type ?? '') === 'STREAM_TERMINATED_FAILURE',
    extractionOutputIsAccepted: ({ event }) =>
      ((event as { output?: ExtractionDoneOutput }).output?.type ?? '') === 'EXTRACTION_ATTEMPT_ACCEPTED',
    toolOutputIsCompleted: ({ event }) =>
      ((event as { output?: ToolDoneOutput }).output?.type ?? '') === 'WORKFLOW_STEP_COMPLETED',
  },
  actors: {
    invokeIdempotency: idempotencyCoordinatorMachine,
    invokeUsage: usageMachine,
    invokeStream: streamTransportMachine,
    invokePersistence: persistenceBatchMachine,
    invokeExtraction: extractionChainMachine,
    invokeToolWorkflow: toolWorkflowMachine,
    markCompletedIdempotency: fromPromise(
      async ({ input }: { input: { context: GenerationMachineContext } }) => {
        const { context } = input;
        if (!context.userId || !context.projectId || !context.idempotencyKey || !context.artifactId) {
          return;
        }

        await context.adapters.idempotency.markCompleted(
          {
            requestId: context.requestId,
            userId: context.userId,
            projectId: context.projectId,
            workflowType: context.workflowType,
            idempotencyKey: context.idempotencyKey,
            ...getRegistrySelector(context),
          },
          context.artifactId,
          context.contentBuffer,
        );
      },
    ),
    markFailedIdempotency: fromPromise(async ({ input }: { input: { context: GenerationMachineContext } }) => {
      const { context } = input;
      if (!context.userId || !context.projectId || !context.idempotencyKey) {
        return;
      }

      await context.adapters.idempotency.markFailed({
        requestId: context.requestId,
        userId: context.userId,
        projectId: context.projectId,
        workflowType: context.workflowType,
        idempotencyKey: context.idempotencyKey,
        ...getRegistrySelector(context),
      });
    }),
  },
}).createMachine({
  id: 'generationSystemMachine',
  initial: 'idle',
  context: ({ input }) => ({
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
    routeType: null,
    adapters: input.adapters,
    runtimeNow: input.runtime?.now ?? (() => new Date()),
    artifactIdFactory: input.runtime?.artifactIdFactory ?? defaultArtifactIdFactory,
    responseBuilder: input.runtime?.responseBuilder ?? defaultResponseBuilder,
    ...input.initialContext,
  }),
  states: {
    idle: {
      on: {
        REQUEST_RECEIVED: [
          {
            guard: 'hasRegistrySelector',
            target: 'gateway',
            actions: {
              type: 'cacheRequestMeta',
              params: ({ event, context }) => ({
                requestId: event.requestId,
                projectId: event.projectId,
                toolKey: event.toolKey,
                artifactType: event.artifactType,
                workflowType: event.workflowType ?? null,
                model: event.model,
                input: event.input,
                idempotencyKey: event.idempotencyKey ?? null,
                outputFormat: normalizeOutputFormat(event.input?.outputFormat),
                registryVersion: event.registryVersion ?? null,
                registrySnapshotRef: event.registrySnapshotRef ?? null,
                routeType: getRouteType(
                  event.toolKey,
                  event.workflowType ?? null,
                  String(event.artifactType),
                ),
                syntheticResponse: context.responseBuilder(event),
              }),
            },
          },
          {
            target: 'failed',
            actions: 'setMissingRegistrySelectorFailure',
          },
        ],
      },
    },
    gateway: {
      on: {
        AUTH_OK: {
          actions: {
            type: 'setUserId',
            params: ({ event }) => ({ userId: event.userId }),
          },
        },
        VALIDATION_OK: {
          target: 'routing',
          actions: {
            type: 'setValidationData',
            params: ({ event, context }) => ({
              workflowType: event.workflowType,
              registryVersion: event.registryVersion,
              registrySnapshotRef: event.registrySnapshotRef,
              routeType: getRouteType(
                context.toolKey,
                event.workflowType,
                String(context.artifactType),
              ),
            }),
          },
        },
        AUTH_FAIL: {
          target: 'failed',
          actions: {
            type: 'setFailureReason',
            params: { reason: 'unauthorized' },
          },
        },
        VALIDATION_FAIL: {
          target: 'failed',
          actions: {
            type: 'setFailureReason',
            params: ({ event }) => ({ reason: event.reason }),
          },
        },
      },
    },
    routing: {
      always: [
        {
          guard: 'routeIsExtraction',
          target: 'extractionFlow',
        },
        {
          guard: 'routeIsTool',
          target: 'toolGenerationFlow',
        },
        {
          guard: 'routeIsGeneric',
          target: 'genericGenerationFlow',
        },
        {
          guard: 'hasAmbiguousRouting',
          target: 'failed',
          actions: 'setAmbiguousRoutingFailure',
        },
      ],
    },
    extractionFlow: {
      entry: ['ensureArtifactId'],
      invoke: {
        id: 'extractionActor',
        src: 'invokeExtraction',
        input: ({ context }) => ({
          requestId: context.requestId,
          artifactId: context.artifactId ?? context.artifactIdFactory(),
          workflowType: context.workflowType ?? 'extraction',
          attemptPlan: [
            { attemptIndex: 0, model: context.model, responseMode: 'text' },
          ],
          bootstrap: {
            autoAccept: true,
          },
          ...getRegistrySelector(context),
        }),
        onDone: {
          target: 'usageAndIdempotency',
        },
        onError: {
          target: 'persistingFailure',
          actions: 'setExtractionFailedFailure',
        },
      },
    },
    toolGenerationFlow: {
      entry: ['ensureArtifactId'],
      invoke: {
        id: 'toolActor',
        src: 'invokeToolWorkflow',
        input: ({ context }) => ({
          requestId: context.requestId,
          toolKey: context.toolKey ?? 'workflow',
          workflowType: context.workflowType ?? 'generic',
          runMode: 'new',
          steps: [{ key: context.toolKey ?? 'workflow_step', dependencies: [] }],
          dependencyGraph: {},
          bootstrap: {
            stepKey: context.toolKey ?? 'workflow_step',
            output: context.syntheticResponse,
            artifactId: context.artifactId ?? context.artifactIdFactory(),
          },
          ...getRegistrySelector(context),
        }),
        onDone: [
          {
            guard: 'toolOutputIsCompleted',
            target: 'usageAndIdempotency',
            actions: 'cacheToolArtifactFromOutput',
          },
          {
            target: 'usageAndIdempotency',
          },
        ],
        onError: {
          target: 'persistingFailure',
          actions: 'setWorkflowFailedFailure',
        },
      },
    },
    genericGenerationFlow: {
      always: 'usageAndIdempotency',
    },
    usageAndIdempotency: {
      initial: 'idempotency',
      states: {
        idempotency: {
          invoke: {
            src: 'invokeIdempotency',
            input: ({ context }) => ({
              requestId: context.requestId,
              userId: context.userId ?? 'anonymous',
              projectId: context.projectId ?? 'unknown-project',
              workflowType: context.workflowType,
              idempotencyKey: context.idempotencyKey ?? `${context.requestId}:auto`,
              ...getRegistrySelector(context),
              adapters: {
                idempotency: context.adapters.idempotency,
              },
            }),
            onDone: [
              {
                guard: 'idempotencyOutputIsReplay',
                target: '#generationSystemMachine.completed',
                actions: {
                  type: 'cacheReplayPayload',
                  params: ({ event }) => getReplayPayloadParams(event),
                },
              },
              {
                guard: 'idempotencyOutputIsConflict',
                target: '#generationSystemMachine.persistingFailure',
                actions: 'setFailureFromInvokeOutput',
              },
              {
                target: 'usage',
              },
            ],
            onError: {
              target: '#generationSystemMachine.persistingFailure',
              actions: 'setIdempotencyConflictFailure',
            },
          },
        },
        usage: {
          invoke: {
            src: 'invokeUsage',
            input: ({ context }) => ({
              requestId: context.requestId,
              userId: context.userId ?? 'anonymous',
              artifactType: context.artifactType,
              workflowType: context.workflowType,
              ...getRegistrySelector(context),
              adapters: {
                usage: context.adapters.usage,
              },
            }),
            onDone: [
              {
                guard: 'usageOutputIsRejected',
                target: '#generationSystemMachine.persistingFailure',
                actions: 'setFailureFromInvokeOutput',
              },
              {
                target: '#generationSystemMachine.streaming',
              },
            ],
            onError: {
              target: '#generationSystemMachine.persistingFailure',
              actions: 'setUsageFailedFailure',
            },
          },
        },
      },
    },
    streaming: {
      entry: ['ensureArtifactId', 'cacheSyntheticChunk'],
      invoke: {
        id: 'streamActor',
        src: 'invokeStream',
        input: ({ context }) => ({
          requestId: context.requestId,
          artifactId: context.artifactId ?? context.artifactIdFactory(),
          model: context.model,
          workflowType: context.workflowType,
          outputFormat: context.outputFormat,
          bootstrap: {
            autoComplete: true,
            initialChunk: context.syntheticResponse,
          },
          runtime: {
            now: context.runtimeNow,
          },
          ...getRegistrySelector(context),
          adapters: {
            stream: context.adapters.stream,
          },
        }),
        onDone: [
          {
            guard: 'streamOutputIsFailure',
            target: 'persistingFailure',
            actions: 'setFailureFromInvokeOutput',
          },
          {
            target: 'persistingSuccess',
          },
        ],
        onError: {
          target: 'persistingFailure',
          actions: 'setStreamFailureFailure',
        },
      },
    },
    persistingSuccess: {
      entry: 'drivePersistenceFinalizeSuccess',
      invoke: {
        id: 'persistenceActor',
        src: 'invokePersistence',
        input: ({ context }) => ({
          requestId: context.requestId,
          artifactId: context.artifactId ?? context.artifactIdFactory(),
          artifactType: context.artifactType,
          workflowType: context.workflowType,
          contentBuffer: context.contentBuffer,
          ...(context.userId ? { userId: context.userId } : {}),
          ...(context.projectId ? { projectId: context.projectId } : {}),
          model: context.model,
          inputJson: context.requestInput,
          inputTokens: Math.max(0, Math.ceil(JSON.stringify(context.requestInput).length / 4)),
          outputTokens: Math.max(0, Math.ceil(context.contentBuffer.length / 4)),
          costUsd: Number((Math.max(1, context.contentBuffer.length) * 0.000001).toFixed(6)),
          ...getRegistrySelector(context),
          adapters: {
            persistence: context.adapters.persistence,
          },
        }),
        onDone: 'finalizeIdempotencySuccess',
        onError: {
          target: 'persistingFailure',
          actions: 'setPersistenceFinalizeFailedFailure',
        },
      },
    },
    persistingFailure: {
      entry: 'drivePersistenceFinalizeFailure',
      invoke: {
        id: 'persistenceActor',
        src: 'invokePersistence',
        input: ({ context }) => ({
          requestId: context.requestId,
          artifactId: context.artifactId ?? context.artifactIdFactory(),
          artifactType: context.artifactType,
          workflowType: context.workflowType,
          contentBuffer: context.contentBuffer,
          ...(context.userId ? { userId: context.userId } : {}),
          ...(context.projectId ? { projectId: context.projectId } : {}),
          model: context.model,
          inputJson: context.requestInput,
          inputTokens: Math.max(0, Math.ceil(JSON.stringify(context.requestInput).length / 4)),
          outputTokens: Math.max(0, Math.ceil(context.contentBuffer.length / 4)),
          costUsd: Number((Math.max(1, context.contentBuffer.length) * 0.000001).toFixed(6)),
          ...getRegistrySelector(context),
          adapters: {
            persistence: context.adapters.persistence,
          },
        }),
        onDone: 'finalizeIdempotencyFailure',
        onError: 'finalizeIdempotencyFailure',
      },
    },
    finalizeIdempotencySuccess: {
      invoke: {
        src: 'markCompletedIdempotency',
        input: ({ context }) => ({ context }),
        onDone: 'completed',
        onError: 'completed',
      },
    },
    finalizeIdempotencyFailure: {
      invoke: {
        src: 'markFailedIdempotency',
        input: ({ context }) => ({ context }),
        onDone: 'failed',
        onError: 'failed',
      },
    },
    completed: {
      on: {
        RESET: {
          target: 'idle',
          reenter: true,
          actions: 'resetVolatileContext',
        },
      },
    },
    failed: {
      on: {
        RESET: {
          target: 'idle',
          reenter: true,
          actions: 'resetVolatileContext',
        },
      },
    },
  },
});
