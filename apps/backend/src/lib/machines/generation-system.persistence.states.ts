/**
 * Persistence States - Infrastructure Context Primary
 *
 * States: resolvingFallbackPolicy, persistingSuccess, persistingFailure,
 *         persistingSuccessSync, persistingFailureSync,
 *         finalizeIdempotencySuccess, finalizeIdempotencyFailure,
 *         routeAfterIdempotency, recordingUsage, consumingCredits,
 *         completed, failed
 * Context Access: Primarily GenerationInfraContext + GenerationErrorContext
 * Primary Concerns: Artifact persistence, error recovery, finalization
 *
 * Context Usage Patterns:
 * - Infrastructure Context: Adapter method calls, artifact storage
 * - Error Context: Route-specific recovery, fallback policies
 * - Domain Context: Final artifact ID assignment, failure reason recording
 */

import type { ErrorActorOutput } from './generation-system.error-actors';
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
    initial: 'route',
    states: {
      route: {
        always: [
          { guard: 'routeIsExtraction', target: 'extractionRecovery' },
          { guard: 'routeIsTool', target: 'toolWorkflowRecovery' },
          { target: 'genericRecovery' },
        ],
      },
      extractionRecovery: {
        invoke: {
          id: 'extractionErrorActor',
          src: 'extractionErrorActor',
          input: ({ context }: ContextArgs) => ({
            pendingFallback: context.pendingFallback,
            registryVersion: context.registryVersion,
            registrySnapshotRef: context.registrySnapshotRef,
            reason: context.pendingFallback?.reason ?? context.failureReason ?? 'extraction_failed',
            hasContent: context.contentBuffer.trim().length > 0,
          }),
          onDone: [
            {
              target: '#generationSystemMachine.persistingFailure',
              actions: {
                type: 'applyRouteErrorOutput',
                params: ({ event }: UnknownEventArgs) => ({
                  output: (event as { output?: ErrorActorOutput }).output!,
                }),
              },
            },
          ],
          onError: [
            { target: '#generationSystemMachine.persistingFailure', actions: 'setFallbackPolicyFailure' },
          ],
        },
      },
      toolWorkflowRecovery: {
        invoke: {
          id: 'toolWorkflowErrorActor',
          src: 'toolWorkflowErrorActor',
          input: ({ context }: ContextArgs) => ({
            pendingFallback: context.pendingFallback,
            registryVersion: context.registryVersion,
            registrySnapshotRef: context.registrySnapshotRef,
            reason: context.pendingFallback?.reason ?? context.failureReason ?? 'workflow_failed',
            hasContent: context.contentBuffer.trim().length > 0,
          }),
          onDone: [
            {
              target: '#generationSystemMachine.persistingFailure',
              actions: {
                type: 'applyRouteErrorOutput',
                params: ({ event }: UnknownEventArgs) => ({
                  output: (event as { output?: ErrorActorOutput }).output!,
                }),
              },
            },
          ],
          onError: [
            { target: '#generationSystemMachine.persistingFailure', actions: 'setFallbackPolicyFailure' },
          ],
        },
      },
      genericRecovery: {
        invoke: {
          id: 'genericErrorActor',
          src: 'genericErrorActor',
          input: ({ context }: ContextArgs) => ({
            pendingFallback: context.pendingFallback,
            registryVersion: context.registryVersion,
            registrySnapshotRef: context.registrySnapshotRef,
            reason: context.pendingFallback?.reason ?? context.failureReason ?? 'generation_failed',
            hasContent: context.contentBuffer.trim().length > 0,
          }),
          onDone: [
            {
              target: '#generationSystemMachine.persistingFailure',
              actions: {
                type: 'applyRouteErrorOutput',
                params: ({ event }: UnknownEventArgs) => ({
                  output: (event as { output?: ErrorActorOutput }).output!,
                }),
              },
            },
          ],
          onError: [
            { target: '#generationSystemMachine.persistingFailure', actions: 'setFallbackPolicyFailure' },
          ],
        },
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
      onDone: 'routeAfterIdempotency',
      onError: 'routeAfterIdempotency',
    },
  },
  routeAfterIdempotency: {
    always: [
      {
        guard: ({ context }: ContextArgs) => context.routeType === 'extraction',
        target: 'completed',
      },
      {
        target: 'recordingUsage',
      },
    ],
  },
  recordingUsage: {
    invoke: {
      id: 'recordArtifactActor',
      src: 'invokeRecordArtifactSuccess',
      input: ({ context }: ContextArgs) => ({ context }),
      onDone: [
        {
          guard: 'isNotFinalArtifact',
          target: 'completed',
        },
        {
          target: 'consumingCredits',
        },
      ],
      onError: [
        {
          guard: 'isNotFinalArtifact',
          target: 'completed',
        },
        {
          target: 'consumingCredits',
        },
      ],
    },
  },
  consumingCredits: {
    invoke: {
      id: 'consumeCreditsActor',
      src: 'invokeConsumeCredits',
      input: ({ context }: ContextArgs) => ({
        context,
        creditCost: context._creditCost ?? 1,
      }),
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
} as const;