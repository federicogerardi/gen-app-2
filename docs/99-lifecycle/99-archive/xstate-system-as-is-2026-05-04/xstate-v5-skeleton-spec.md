## 18. Allegato: Skeleton TypeScript XState v5

```ts
import { setup, assign, createActor, fromPromise } from 'xstate';

type RequestContext = {
  requestId: string;
  userId: string | null;
  projectId: string | null;
  toolKey: string | null;
  registryVersion: string | null;
  registrySnapshotRef: string | null;
  workflowType: string | null;
  artifactType: string;
  artifactId: string | null;
  contentBuffer: string;
  failureReason: string | null;
};

type RequestEvent =
  | {
    type: 'REQUEST_RECEIVED';
    requestId: string;
    projectId: string;
    toolKey: string | null;
    artifactType: string;
    model: string;
    input: Record<string, unknown>;
    workflowType?: string | null;
    idempotencyKey?: string;
    registryVersion: string;
    registrySnapshotRef?: string;
  }
  | {
    type: 'REQUEST_RECEIVED';
    requestId: string;
    projectId: string;
    toolKey: string | null;
    artifactType: string;
    model: string;
    input: Record<string, unknown>;
    workflowType?: string | null;
    idempotencyKey?: string;
    registryVersion?: string;
    registrySnapshotRef: string;
  }
  | { type: 'AUTH_OK'; userId: string }
  | { type: 'AUTH_FAIL' }
  | {
    type: 'VALIDATION_OK';
    workflowType: string | null;
    registryVersion: string | null;
    registrySnapshotRef: string | null;
  }
  | { type: 'VALIDATION_FAIL'; reason: string }
  | { type: 'USAGE_GRANTED'; requestId: string; sourceActor: 'usageMachine'; timestamp: string }
  | { type: 'USAGE_REJECTED'; requestId: string; sourceActor: 'usageMachine'; timestamp: string; reason: string }
  | { type: 'IDEMPOTENCY_CLAIMED'; requestId: string; sourceActor: 'idempotencyCoordinatorMachine'; timestamp: string }
  | {
    type: 'IDEMPOTENCY_REPLAY_READY';
    requestId: string;
    sourceActor: 'idempotencyCoordinatorMachine';
    timestamp: string;
    artifactId: string;
    metadata: { content: string };
  }
  | { type: 'IDEMPOTENCY_CONFLICT'; requestId: string; sourceActor: 'idempotencyCoordinatorMachine'; timestamp: string; reason: string }
  | { type: 'STREAM_SESSION_STARTED'; requestId: string; sourceActor: 'streamTransportMachine'; timestamp: string; artifactId: string }
  | {
    type: 'STREAM_CHUNK_RECEIVED';
    requestId: string;
    sourceActor: 'streamTransportMachine';
    timestamp: string;
    artifactId: string;
    metadata: { chunk: string; sequence: number };
  }
  | {
    type: 'STREAM_HEARTBEAT_DUE';
    requestId: string;
    sourceActor: 'streamTransportMachine';
    timestamp: string;
    artifactId: string;
    metadata: { estimatedTokens: { input: number; output: number }; costEstimate: number };
  }
  | { type: 'STREAM_TERMINATED_SUCCESS'; requestId: string; sourceActor: 'streamTransportMachine'; timestamp: string; artifactId: string }
  | { type: 'STREAM_TERMINATED_FAILURE'; requestId: string; sourceActor: 'streamTransportMachine'; timestamp: string; artifactId: string; reason: string }
  | { type: 'PERSISTENCE_FLUSH_COMMITTED'; requestId: string; sourceActor: 'persistenceBatchMachine'; timestamp: string; artifactId: string }
  | { type: 'PERSISTENCE_FINALIZE_SUCCEEDED'; requestId: string; sourceActor: 'persistenceBatchMachine'; timestamp: string; artifactId: string }
  | { type: 'PERSISTENCE_FINALIZE_FAILED'; requestId: string; sourceActor: 'persistenceBatchMachine'; timestamp: string; artifactId: string; reason: string }
  | { type: 'WORKFLOW_STEP_UNLOCKED'; requestId: string; sourceActor: 'toolWorkflowMachine'; timestamp: string; stepKey: string }
  | {
    type: 'WORKFLOW_STEP_COMPLETED';
    requestId: string;
    sourceActor: 'toolWorkflowMachine';
    timestamp: string;
    stepKey: string;
    artifactId: string;
  }
  | {
    type: 'EXTRACTION_ATTEMPT_ACCEPTED';
    requestId: string;
    sourceActor: 'extractionChainMachine';
    timestamp: string;
    artifactId: string;
    attemptIndex: number;
  }
  | {
    type: 'EXTRACTION_ATTEMPT_REJECTED';
    requestId: string;
    sourceActor: 'extractionChainMachine';
    timestamp: string;
    artifactId: string;
    attemptIndex: number;
    reason: string;
  }
  | {
    type: 'EXTRACTION_CHAIN_EXHAUSTED';
    requestId: string;
    sourceActor: 'extractionChainMachine';
    timestamp: string;
    artifactId: string;
    reason: string;
  }
  | { type: 'RESET' };

const usageMachine = setup({
  types: {
    input: {} as { userId: string },
  },
  actors: {
    claimUsage: fromPromise(async ({ input }) => {
      return { userId: input.userId };
    }),
  },
}).createMachine({
  id: 'usage',
  initial: 'checking',
  states: {
    checking: {
      invoke: {
        src: 'claimUsage',
        input: ({ input }) => input,
        onDone: { target: 'granted' },
        onError: { target: 'rejected' },
      },
    },
    granted: { type: 'final' },
    rejected: { type: 'final' },
  },
});

export const generationSystemMachine = setup({
  types: { context: {} as RequestContext, events: {} as RequestEvent },
  guards: {
    hasReplay: ({ event }) => event.type === 'IDEMPOTENCY_REPLAY_READY',
  },
}).createMachine({
  id: 'generation-system',
  initial: 'idle',
  context: {
    requestId: '',
    userId: null,
    projectId: null,
    toolKey: null,
    registryVersion: null,
    registrySnapshotRef: null,
    workflowType: null,
    artifactType: 'content',
    artifactId: null,
    contentBuffer: '',
    failureReason: null,
  },
  states: {
    idle: {
      on: {
        REQUEST_RECEIVED: {
          target: 'gateway',
          actions: assign(({ event }) => ({
            requestId: event.requestId,
            projectId: event.projectId,
            toolKey: event.toolKey,
            registryVersion: event.registryVersion ?? null,
            registrySnapshotRef: event.registrySnapshotRef ?? null,
            artifactType: event.artifactType,
            contentBuffer: '',
            failureReason: null,
          })),
        },
      },
    },
    gateway: {
      on: {
        AUTH_OK: { actions: assign(({ event }) => ({ userId: event.userId })) },
        VALIDATION_OK: {
          target: 'usageAndIdempotency',
          actions: assign(({ event }) => ({
            workflowType: event.workflowType,
            registryVersion: event.registryVersion,
            registrySnapshotRef: event.registrySnapshotRef,
          })),
        },
        AUTH_FAIL: 'failed',
        VALIDATION_FAIL: {
          target: 'failed',
          actions: assign(({ event }) => ({ failureReason: event.reason })),
        },
      },
    },
    usageAndIdempotency: {
      on: {
        USAGE_GRANTED: 'streaming',
        USAGE_REJECTED: {
          target: 'failed',
          actions: assign(({ event }) => ({ failureReason: event.reason })),
        },
        IDEMPOTENCY_REPLAY_READY: {
          target: 'completed',
          actions: assign(({ event }) => ({
            artifactId: event.artifactId,
            contentBuffer: event.metadata.content,
          })),
        },
        IDEMPOTENCY_CONFLICT: {
          target: 'failed',
          actions: assign({ failureReason: 'idempotency_conflict' }),
        },
      },
    },
    streaming: {
      on: {
        STREAM_SESSION_STARTED: {
          actions: assign(({ event }) => ({ artifactId: event.artifactId })),
        },
        STREAM_CHUNK_RECEIVED: {
          actions: assign(({ context, event }) => ({
            contentBuffer: context.contentBuffer + event.metadata.chunk,
          })),
        },
        STREAM_TERMINATED_SUCCESS: 'persisting',
        STREAM_TERMINATED_FAILURE: {
          target: 'failed',
          actions: assign(({ event }) => ({ failureReason: event.reason })),
        },
      },
    },
    persisting: {
      on: {
        PERSISTENCE_FINALIZE_SUCCEEDED: 'completed',
        PERSISTENCE_FINALIZE_FAILED: {
          target: 'failed',
          actions: assign(({ event }) => ({ failureReason: event.reason })),
        },
      },
    },
    completed: {
      on: {
        RESET: { target: 'idle', reenter: true },
      },
    },
    failed: {
      on: {
        RESET: { target: 'idle', reenter: true },
      },
    },
  },
});

export const generationSystemActor = createActor(generationSystemMachine);
```

