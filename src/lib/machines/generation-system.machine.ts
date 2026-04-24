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
      requestId: ({ event, context }) =>
        event.type === 'REQUEST_RECEIVED' ? event.requestId : context.requestId,
      projectId: ({ event, context }) =>
        event.type === 'REQUEST_RECEIVED' ? event.projectId : context.projectId,
      toolKey: ({ event, context }) =>
        event.type === 'REQUEST_RECEIVED' ? event.toolKey : context.toolKey,
      artifactType: ({ event, context }) =>
        event.type === 'REQUEST_RECEIVED' ? event.artifactType : context.artifactType,
      workflowType: ({ event, context }) =>
        event.type === 'REQUEST_RECEIVED' ? event.workflowType ?? null : context.workflowType,
      model: ({ event, context }) =>
        event.type === 'REQUEST_RECEIVED' ? event.model : context.model,
      requestInput: ({ event, context }) =>
        event.type === 'REQUEST_RECEIVED' ? event.input : context.requestInput,
      idempotencyKey: ({ event, context }) =>
        event.type === 'REQUEST_RECEIVED' ? event.idempotencyKey ?? null : context.idempotencyKey,
      outputFormat: ({ event, context }) =>
        event.type === 'REQUEST_RECEIVED'
          ? normalizeOutputFormat(event.input?.outputFormat)
          : context.outputFormat,
      registryVersion: ({ event, context }) =>
        event.type === 'REQUEST_RECEIVED' ? event.registryVersion ?? null : context.registryVersion,
      registrySnapshotRef: ({ event, context }) =>
        event.type === 'REQUEST_RECEIVED' ? event.registrySnapshotRef ?? null : context.registrySnapshotRef,
      routeType: ({ event, context }) =>
        event.type === 'REQUEST_RECEIVED'
          ? getRouteType(event.toolKey, event.workflowType ?? null, String(event.artifactType))
          : context.routeType,
      failureReason: null,
      syntheticResponse: ({ event, context }) =>
        event.type === 'REQUEST_RECEIVED' ? context.responseBuilder(event) : context.syntheticResponse,
      contentBuffer: '',
      artifactId: null,
    }),
    setUserId: assign({
      userId: ({ event, context }) => (event.type === 'AUTH_OK' ? event.userId : context.userId),
    }),
    setValidationData: assign({
      workflowType: ({ event, context }) =>
        event.type === 'VALIDATION_OK' ? event.workflowType : context.workflowType,
      registryVersion: ({ event, context }) =>
        event.type === 'VALIDATION_OK' ? event.registryVersion : context.registryVersion,
      registrySnapshotRef: ({ event, context }) =>
        event.type === 'VALIDATION_OK' ? event.registrySnapshotRef : context.registrySnapshotRef,
      routeType: ({ event, context }) =>
        event.type === 'VALIDATION_OK'
          ? getRouteType(
            context.toolKey,
            event.workflowType,
            String(context.artifactType),
          )
          : context.routeType,
    }),
    setFailureReason: assign({
      failureReason: ({ event }) => {
        if (event.type === 'AUTH_FAIL') {
          return 'unauthorized';
        }
        if (event.type === 'VALIDATION_FAIL') {
          return event.reason;
        }
        if (event.type === 'USAGE_REJECTED') {
          return event.reason;
        }
        if (event.type === 'IDEMPOTENCY_CONFLICT') {
          return 'idempotency_conflict';
        }
        if (event.type === 'STREAM_TERMINATED_FAILURE') {
          return event.reason;
        }
        if (event.type === 'PERSISTENCE_FINALIZE_FAILED') {
          return event.reason;
        }
        return 'generation_failed';
      },
    }),
    setAmbiguousRoutingFailure: assign({
      failureReason: 'ambiguous_routing',
    }),
    cacheReplayPayload: assign({
      artifactId: ({ event, context }) =>
        event.type === 'IDEMPOTENCY_REPLAY_READY' ? event.artifactId : context.artifactId,
      contentBuffer: ({ event, context }) =>
        event.type === 'IDEMPOTENCY_REPLAY_READY' ? event.metadata.content : context.contentBuffer,
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
    driveExtractionAttempt: enqueueActions(({ enqueue }) => {
      enqueue.sendTo('extractionActor', { type: 'ATTEMPT_ACCEPTED' });
    }),
    driveToolWorkflow: enqueueActions(({ enqueue, context }) => {
      const stepKey = context.toolKey ?? 'workflow_step';
      const artifactId = context.artifactId ?? context.artifactIdFactory();

      enqueue.sendTo('toolActor', { type: 'STEP_START', stepKey });
      enqueue.sendTo('toolActor', {
        type: 'STEP_SUCCESS',
        stepKey,
        output: context.syntheticResponse,
        artifactId,
      });
      enqueue.sendTo('toolActor', { type: 'WORKFLOW_COMPLETE' });
    }),
    driveSyntheticStream: enqueueActions(({ enqueue, context }) => {
      enqueue.sendTo('streamActor', { type: 'STREAM_READY' });
      enqueue.sendTo('streamActor', {
        type: 'STREAM_CHUNK',
        chunk: context.syntheticResponse,
      });
      enqueue.sendTo('streamActor', { type: 'STREAM_COMPLETE' });
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
            actions: 'cacheRequestMeta',
          },
          {
            target: 'failed',
            actions: assign({ failureReason: 'missing_registry_selector' }),
          },
        ],
      },
    },
    gateway: {
      on: {
        AUTH_OK: {
          actions: 'setUserId',
        },
        VALIDATION_OK: {
          target: 'routing',
          actions: 'setValidationData',
        },
        AUTH_FAIL: {
          target: 'failed',
          actions: 'setFailureReason',
        },
        VALIDATION_FAIL: {
          target: 'failed',
          actions: 'setFailureReason',
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
      entry: ['ensureArtifactId', 'driveExtractionAttempt'],
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
          ...getRegistrySelector(context),
        }),
        onDone: [
          {
            guard: 'extractionOutputIsAccepted',
            target: 'usageAndIdempotency',
          },
          {
            target: 'persistingFailure',
            actions: 'setFailureFromInvokeOutput',
          },
        ],
        onError: {
          target: 'persistingFailure',
          actions: assign({ failureReason: 'extraction_failed' }),
        },
      },
    },
    toolGenerationFlow: {
      entry: ['ensureArtifactId', 'driveToolWorkflow'],
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
          actions: assign({ failureReason: 'workflow_failed' }),
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
                actions: 'cacheReplayPayload',
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
              actions: assign({ failureReason: 'idempotency_conflict' }),
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
              actions: assign({ failureReason: 'usage_failed' }),
            },
          },
        },
      },
    },
    streaming: {
      entry: ['ensureArtifactId', 'cacheSyntheticChunk', 'driveSyntheticStream'],
      invoke: {
        id: 'streamActor',
        src: 'invokeStream',
        input: ({ context }) => ({
          requestId: context.requestId,
          artifactId: context.artifactId ?? context.artifactIdFactory(),
          model: context.model,
          workflowType: context.workflowType,
          outputFormat: context.outputFormat,
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
          actions: assign({ failureReason: 'stream_failure' }),
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
          actions: assign({ failureReason: 'persistence_finalize_failed' }),
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
