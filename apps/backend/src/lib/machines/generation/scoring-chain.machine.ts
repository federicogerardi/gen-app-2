/**
 * Scoring chain machine — pass-through only.
 * Receives scoring input parameters and immediately returns a typed SCORING_COMPLETED output.
 * Actual scoring computation happens in the invokeScoring fromPromise actor.
 */

import { setup } from 'xstate';

export type ScoringChainInput = {
  requestId: string;
  stepKey: string;
  sessionId: string | null;
  crawlArtifacts: { query: string; isPaa: boolean; content: string; structuredPayload: Record<string, unknown> }[];
};

export type ScoringChainOutput =
  | { type: 'SCORING_COMPLETED'; requestId: string; stepKey: string; ranking: Record<string, unknown> }
  | { type: 'SCORING_FAILED'; requestId: string; stepKey: string; reason: string };

export const scoringChainMachine = setup({
  types: {
    input: {} as ScoringChainInput,
    context: {} as ScoringChainInput,
    output: {} as ScoringChainOutput,
  },
}).createMachine({
  id: 'scoringChainMachine',
  initial: 'done',
  context: ({ input }) => input,
  states: {
    done: {
      type: 'final' as const,
      output: ({ context }: { context: ScoringChainInput }): ScoringChainOutput => ({
        type: 'SCORING_COMPLETED',
        requestId: context.requestId,
        stepKey: context.stepKey,
        ranking: {},
      }),
    },
  },
});
