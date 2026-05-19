import { getFallbackDoneOutput } from './generation-system.events';
import type { GenerationMachineContext } from './generation-system.types';
import { buildPersistenceBatchInput } from './generation-persistence';

type ContextArgs = {
  context: GenerationMachineContext;
};

type UnknownEventArgs = {
  event: unknown;
};

export const generationSystemPersistenceStates = {
  resolvingFallbackPolicy: {
    invoke: {
      id: 'fallbackActor',
      src: 'invokeFallbackPolicy',
      input: ({ context }: ContextArgs) => ({
        reason: context.pendingFallback?.reason ?? context.failureReason ?? null,
        defaultReason:
          context.pendingFallback?.defaultReason
          ?? context.failureReason
          ?? 'generation_failed',
        routeType: context.routeType,
        hasContent: context.contentBuffer.trim().length > 0,
        retryCount: 0,
        maxRetries: 0,
      }),
      onDone: {
        target: 'persistingFailure',
        actions: {
          type: 'applyFallbackDecision',
          params: ({ event }: UnknownEventArgs) => ({
            reason: getFallbackDoneOutput(event)?.reason ?? 'generation_failed',
          }),
        },
      },
      onError: {
        target: 'persistingFailure',
        actions: 'setFallbackPolicyFailure',
      },
    },
  },
  persistingSuccess: {
    entry: 'drivePersistenceFinalizeSuccess',
    invoke: {
      id: 'persistenceActor',
      src: 'invokePersistence',
      input: ({ context }: ContextArgs) => {
        const artifactId = context.artifactId ?? context.artifactIdFactory();
        return {
          ...buildPersistenceBatchInput(context, artifactId),
          adapters: {
            persistence: context.adapters.persistence,
          },
        };
      },
      onDone: 'finalizeIdempotencySuccess',
      onError: {
        target: 'resolvingFallbackPolicy',
        actions: {
          type: 'queueFallbackDecision',
          params: {
            defaultReason: 'persistence_finalize_failed',
          },
        },
      },
    },
  },
  persistingFailure: {
    entry: 'drivePersistenceFinalizeFailure',
    invoke: {
      id: 'persistenceActor',
      src: 'invokePersistence',
      input: ({ context }: ContextArgs) => {
        const artifactId = context.artifactId ?? context.artifactIdFactory();
        return {
          ...buildPersistenceBatchInput(context, artifactId),
          adapters: {
            persistence: context.adapters.persistence,
          },
        };
      },
      onDone: 'finalizeIdempotencyFailure',
      onError: 'finalizeIdempotencyFailure',
    },
  },
  finalizeIdempotencySuccess: {
    invoke: {
      src: 'markCompletedIdempotency',
      input: ({ context }: ContextArgs) => ({ context }),
      onDone: 'completed',
      onError: 'completed',
    },
  },
  finalizeIdempotencyFailure: {
    invoke: {
      src: 'markFailedIdempotency',
      input: ({ context }: ContextArgs) => ({ context }),
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
};