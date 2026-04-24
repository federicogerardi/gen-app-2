import { assign, fromPromise, setup } from 'xstate';
import type { GenerationAdapters } from '../adapters/generation.adapters';

import type {
  UsageActorEvent,
  UsageActorInput,
  UsageGrantedEvent,
  UsageRejectedEvent,
} from '../types/xstate';

type UsageMachineContext = {
  input: UsageMachineInput;
  rejectionReason: string | null;
};

type UsageMachineInput = UsageActorInput & {
  adapters: Pick<GenerationAdapters, 'usage'>;
};

type UsageMachineEvent = { type: 'RETRY' };

type ClaimUsageResult = {
  granted: boolean;
  reason?: string;
};

const nowIso = (): string => new Date().toISOString();

export const usageMachine = setup({
  types: {
    context: {} as UsageMachineContext,
    input: {} as UsageMachineInput,
    events: {} as UsageMachineEvent,
    output: {} as UsageActorEvent,
  },
  actors: {
    claimUsage: fromPromise(async ({ input }: { input: UsageMachineInput }) => {
      const decision = await input.adapters.usage.claimUsage(input);
      return decision satisfies ClaimUsageResult;
    }),
  },
  guards: {
    isGranted: ({ event }) =>
      (event as unknown as { output: ClaimUsageResult }).output.granted,
  },
  actions: {
    setRejectionReason: assign({
      rejectionReason: ({ event }) =>
        (event as unknown as { output: ClaimUsageResult }).output.reason ?? 'rate_limited',
    }),
  },
}).createMachine({
  id: 'usageMachine',
  initial: 'checking',
  context: ({ input }) => ({
    input,
    rejectionReason: null,
  }),
  states: {
    checking: {
      invoke: {
        src: 'claimUsage',
        input: ({ context }) => context.input as UsageMachineInput,
        onDone: [
          {
            guard: 'isGranted',
            target: 'granted',
          },
          {
            target: 'rejected',
            actions: 'setRejectionReason',
          },
        ],
        onError: {
          target: 'rejected',
          actions: assign({ rejectionReason: 'rate_limited' }),
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
        const event: UsageGrantedEvent = {
          type: 'USAGE_GRANTED',
          requestId: context.input.requestId,
          sourceActor: 'usageMachine',
          timestamp: nowIso(),
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
          timestamp: nowIso(),
          reason: context.rejectionReason ?? 'rate_limited',
        };
        return event;
      },
    },
  },
});
