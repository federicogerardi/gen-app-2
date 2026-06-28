import type {
  AuthOkEvent,
  RequestReceivedEvent,
  ValidationFailEvent,
  ValidationOkEvent,
} from '../types/xstate';
import { getInvokeFailureReason, getReplayPayloadParams } from './generation-system.events';
import { normalizeOutputFormat } from './generation-system.runtime';
import type { GenerationMachineContext } from './generation-system.types';
import {
  getRegistrySelector,
  getRouteType,
} from './generation-routing';
import { toOptionalString } from './generation/request-normalizers';

type ContextArgs = {
  context: GenerationMachineContext;
};

type RequestArgs = {
  context: GenerationMachineContext;
  event: RequestReceivedEvent;
};

type AuthArgs = {
  event: AuthOkEvent;
};

type ValidationOkArgs = {
  context: GenerationMachineContext;
  event: ValidationOkEvent;
};

type ValidationFailArgs = {
  event: ValidationFailEvent;
};

type UnknownEventArgs = {
  event: unknown;
};

export const generationSystemRequestStates = {
  idle: {
    on: {
      REQUEST_RECEIVED: [
        {
          guard: 'hasRegistrySelector',
          target: 'gateway',
          actions: {
            type: 'cacheRequestMeta',
            params: ({ event, context }: RequestArgs) => ({
              requestId: event.requestId,
              projectId: event.projectId,
              sessionId: toOptionalString(event.sessionId),
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
          params: ({ event }: AuthArgs) => ({ userId: event.userId }),
        },
      },
      VALIDATION_OK: {
        target: 'preGenerationGuards',
        actions: {
          type: 'setValidationData',
          params: ({ event, context }: ValidationOkArgs) => ({
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
          params: ({ event }: ValidationFailArgs) => ({ reason: event.reason }),
        },
      },
    },
  },
  preGenerationGuards: {
    initial: 'idempotency',
    states: {
      idempotency: {
        invoke: {
          src: 'invokeIdempotency',
          input: ({ context }: ContextArgs) => ({
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
                params: ({ event }: UnknownEventArgs) => getReplayPayloadParams(event),
              },
            },
            {
              guard: 'idempotencyOutputIsConflict',
              target: '#generationSystemMachine.resolvingFallbackPolicy',
              actions: {
                type: 'queueFallbackDecision',
                params: ({ event }: UnknownEventArgs) => ({
                  reason: getInvokeFailureReason(event),
                  defaultReason: 'idempotency_conflict',
                }),
              },
            },
            {
              target: 'ownershipCheck',
            },
          ],
          onError: {
            target: '#generationSystemMachine.resolvingFallbackPolicy',
            actions: {
              type: 'queueFallbackDecision',
              params: {
                defaultReason: 'idempotency_conflict',
              },
            },
          },
        },
      },
      ownershipCheck: {
        invoke: {
          src: 'invokeOwnership',
          input: ({ context }: ContextArgs) => ({ context }),
          onDone: [
            {
              guard: 'ownershipOutputIsRejected',
              target: '#generationSystemMachine.resolvingFallbackPolicy',
              actions: {
                type: 'queueFallbackDecision',
                params: ({ event }: UnknownEventArgs) => ({
                  reason: getInvokeFailureReason(event),
                  defaultReason: 'ownership_failed',
                }),
              },
            },
            {
              target: 'usage',
            },
          ],
          onError: {
            target: '#generationSystemMachine.resolvingFallbackPolicy',
            actions: {
              type: 'queueFallbackDecision',
              params: {
                defaultReason: 'ownership_failed',
              },
            },
          },
        },
      },
      usage: {
        invoke: {
          src: 'invokeUsage',
          input: ({ context }: ContextArgs) => ({
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
              target: '#generationSystemMachine.resolvingFallbackPolicy',
              actions: {
                type: 'queueFallbackDecision',
                params: ({ event }: UnknownEventArgs) => ({
                  reason: getInvokeFailureReason(event),
                  defaultReason: 'usage_failed',
                }),
              },
            },
            {
              target: '#generationSystemMachine.routing',
              actions: {
                type: 'cacheCreditCost',
                params: ({ event }: UnknownEventArgs) => {
                  const output = (event as { output?: { creditCost?: number } })?.output;
                  return { creditCost: output?.creditCost ?? 1 };
                },
              },
            },
          ],
          onError: {
            target: '#generationSystemMachine.resolvingFallbackPolicy',
            actions: {
              type: 'queueFallbackDecision',
              params: {
                defaultReason: 'usage_failed',
              },
            },
          },
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
        guard: 'routeIsGeometric',
        target: 'crawlingFlow',
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
} as const;