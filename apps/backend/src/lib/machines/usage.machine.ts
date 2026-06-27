import { assign, fromPromise, setup } from 'xstate';
import type { GenerationAdapters } from '../adapters/generation.adapters';
import { TOOL_KEY_BY_WORKFLOW_TYPE, TOOL_WORKFLOW_BY_TOOL_KEY, isToolWorkflowType } from '@gen-app-2/contracts';

import type {
  UsageActorEvent,
  UsageActorInput,
  UsageGrantedEvent,
  UsageRejectedEvent,
} from '../types/xstate';

type UsageMachineContext = {
  input: UsageMachineInput;
  rejectionReason: string | null;
  _claimResult: ClaimUsageResult | null;
};

type UsageMachineInput = UsageActorInput & {
  adapters: Pick<GenerationAdapters, 'usage'>;
};

type UsageMachineEvent = { type: 'RETRY' };

type ClaimUsageResult = {
  granted: boolean;
  reason?: string;
  creditCost?: number;
};

const getClaimUsageResult = (event: unknown): ClaimUsageResult =>
  (event as { output: ClaimUsageResult }).output;

const getNow = (input: UsageMachineInput): Date =>
  (input.runtime?.now ?? (() => new Date()))();

export const usageMachine = setup({
  types: {
    context: {} as UsageMachineContext,
    input: {} as UsageMachineInput,
    events: {} as UsageMachineEvent,
    output: {} as UsageActorEvent,
  },
  actors: {
    claimUsage: fromPromise(async ({ input }: { input: UsageMachineInput }) => {
      let resolvedCreditCost = input.creditCost ?? 1;
      if (!input.creditCost && input.workflowType && isToolWorkflowType(input.workflowType)) {
        const toolKey = TOOL_KEY_BY_WORKFLOW_TYPE[input.workflowType];
        resolvedCreditCost = TOOL_WORKFLOW_BY_TOOL_KEY[toolKey]?.creditCost ?? 1;
      }
      const decision = await input.adapters.usage.claimUsage({
        ...input,
        creditCost: resolvedCreditCost,
      });
      return decision satisfies ClaimUsageResult;
    }),
  },
  guards: {
    isGranted: (_, params: { granted: boolean }) => params.granted,
  },
  actions: {
    setRejectionReason: assign({
      rejectionReason: (_, params: { reason: string }) => params.reason,
    }),
    setUsageFailedRejectionReason: assign({
      rejectionReason: 'usage_failed',
    }),
    cacheClaimResult: assign({
      _claimResult: (_, params: { result: ClaimUsageResult }) => params.result,
    }),
  },
}).createMachine({
  id: 'usageMachine',
  initial: 'checking',
  output: ({ event }) => (event as { output: UsageActorEvent }).output,
  context: ({ input }) => ({
    input,
    rejectionReason: null,
    _claimResult: null,
  }),
  states: {
    checking: {
      invoke: {
        src: 'claimUsage',
        input: ({ context }) => context.input as UsageMachineInput,
        onDone: [
          {
            guard: {
              type: 'isGranted',
              params: ({ event }) => ({ granted: getClaimUsageResult(event).granted }),
            },
            target: 'granted',
            actions: {
              type: 'cacheClaimResult',
              params: ({ event }) => ({ result: getClaimUsageResult(event) }),
            },
          },
          {
            target: 'rejected',
            actions: [
              {
                type: 'cacheClaimResult',
                params: ({ event }) => ({ result: getClaimUsageResult(event) }),
              },
              {
                type: 'setRejectionReason',
                params: ({ event }) => ({
                  reason: getClaimUsageResult(event).reason ?? 'usage_failed',
                }),
              },
            ],
          },
        ],
        onError: {
          target: 'rejected',
          actions: 'setUsageFailedRejectionReason',
        },
      },
      on: {
        RETRY: {
          target: 'checking',
          reenter: true,
        },
      },
    },
    granted: {
      type: 'final',
      output: ({ context }) => {
        const claimResult = context._claimResult;
        const event: UsageGrantedEvent = {
          type: 'USAGE_GRANTED',
          requestId: context.input.requestId,
          sourceActor: 'usageMachine',
          timestamp: getNow(context.input).toISOString(),
          ...(claimResult?.creditCost !== undefined ? { creditCost: claimResult.creditCost } : {}),
        };
        return event;
      },
    },
    rejected: {
      type: 'final',
      output: ({ context }) => {
        const event: UsageRejectedEvent = {
          type: 'USAGE_REJECTED',
          requestId: context.input.requestId,
          sourceActor: 'usageMachine',
          timestamp: getNow(context.input).toISOString(),
          reason: context.rejectionReason ?? 'usage_failed',
        };
        return event;
      },
    },
  },
});
