import { assign, setup } from 'xstate';

import type {
  ExtractionChainEvent,
  ExtractionChainExhaustedEvent,
  ExtractionChainInput,
  ExtractionAttemptAcceptedEvent,
  ExtractionAttemptRejectedEvent,
} from '../types/xstate';

type ExtractionChainMachineContext = {
  input: ExtractionChainInput;
  currentAttemptIndex: number;
  lastFailureReason: string | null;
};

type ExtractionChainMachineInput = ExtractionChainInput;

type ExtractionChainMachineEvent =
  | { type: 'ATTEMPT_ACCEPTED' }
  | { type: 'ATTEMPT_REJECTED'; reason: string }
  | { type: 'ATTEMPT_HARD_FAIL'; reason: string }
  | { type: 'RESET' };

const nowIso = (): string => new Date().toISOString();

export const extractionChainMachine = setup({
  types: {
    context: {} as ExtractionChainMachineContext,
    input: {} as ExtractionChainMachineInput,
    events: {} as ExtractionChainMachineEvent,
    output: {} as ExtractionChainEvent,
  },
  guards: {
    hasAvailableAttempt: ({ context }) => context.currentAttemptIndex < context.input.attemptPlan.length,
    canEscalateAttempt: ({ context }) => context.currentAttemptIndex + 1 < context.input.attemptPlan.length,
  },
  actions: {
    incrementAttemptIndex: assign({
      currentAttemptIndex: ({ context }) => context.currentAttemptIndex + 1,
    }),
    setFailureReason: assign({
      lastFailureReason: ({ event }) => ('reason' in event ? event.reason : 'attempt_failed'),
    }),
  },
}).createMachine({
  id: 'extractionChainMachine',
  initial: 'preflight',
  context: ({ input }) => ({
    input,
    currentAttemptIndex: 0,
    lastFailureReason: null,
  }),
  states: {
    preflight: {
      always: [
        {
          guard: 'hasAvailableAttempt',
          target: 'attemptPreflight',
        },
        {
          target: 'chainExhausted',
        },
      ],
    },
    attemptPreflight: {
      always: [
        {
          guard: 'hasAvailableAttempt',
          target: 'attemptRunning',
        },
        {
          target: 'chainExhausted',
        },
      ],
    },
    attemptRunning: {
      on: {
        ATTEMPT_ACCEPTED: 'attemptAccept',
        ATTEMPT_REJECTED: {
          target: 'attemptEscalate',
          actions: 'setFailureReason',
        },
        ATTEMPT_HARD_FAIL: {
          target: 'failedHard',
          actions: 'setFailureReason',
        },
      },
    },
    attemptAccept: {
      type: 'final',
      output: ({ context }): ExtractionAttemptAcceptedEvent => ({
        type: 'EXTRACTION_ATTEMPT_ACCEPTED',
        requestId: context.input.requestId,
        sourceActor: 'extractionChainMachine',
        timestamp: nowIso(),
        artifactId: context.input.artifactId,
        attemptIndex: context.currentAttemptIndex,
      }),
    },
    attemptEscalate: {
      always: [
        {
          guard: 'canEscalateAttempt',
          target: 'attemptPreflight',
          actions: 'incrementAttemptIndex',
        },
        {
          target: 'chainExhausted',
        },
      ],
    },
    chainExhausted: {
      type: 'final',
      output: ({ context }): ExtractionChainExhaustedEvent => ({
        type: 'EXTRACTION_CHAIN_EXHAUSTED',
        requestId: context.input.requestId,
        sourceActor: 'extractionChainMachine',
        timestamp: nowIso(),
        artifactId: context.input.artifactId,
        reason: context.lastFailureReason ?? 'chain_exhausted',
      }),
    },
    failedHard: {
      type: 'final',
      output: ({ context }): ExtractionAttemptRejectedEvent => ({
        type: 'EXTRACTION_ATTEMPT_REJECTED',
        requestId: context.input.requestId,
        sourceActor: 'extractionChainMachine',
        timestamp: nowIso(),
        artifactId: context.input.artifactId,
        attemptIndex: context.currentAttemptIndex,
        reason: context.lastFailureReason ?? 'hard_failure',
      }),
    },
  },
  on: {
    RESET: {
      target: '.preflight',
      reenter: true,
      actions: assign({
        currentAttemptIndex: 0,
        lastFailureReason: null,
      }),
    },
  },
});
