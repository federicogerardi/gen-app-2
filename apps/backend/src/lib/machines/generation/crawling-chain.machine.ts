import { setup } from 'xstate';

export type CrawlingChainInput = {
  requestId: string;
  stepKey: string;
  baseQuery: string;
  language: string;
  country: string;
  sessionId: string;
};

export type CrawlingChainOutput = {
  type: 'CRAWLING_COMPLETED';
  requestId: string;
  stepKey: string;
  crawlArtifacts: { query: string; isPaa: boolean; content: string; structuredPayload: Record<string, unknown> }[];
  paaQueries: string[];
};

type CrawlingChainContext = {
  input: CrawlingChainInput;
};

export const crawlingChainMachine = setup({
  types: {
    context: {} as CrawlingChainContext,
    input: {} as CrawlingChainInput,
    output: {} as CrawlingChainOutput,
  },
}).createMachine({
  id: 'crawlingChainMachine',
  initial: 'done',
  context: ({ input }) => ({ input }),
  states: {
    done: {
      type: 'final',
      output: ({ context }) => ({
        type: 'CRAWLING_COMPLETED',
        requestId: context.input.requestId,
        stepKey: context.input.stepKey,
        crawlArtifacts: [],
        paaQueries: [],
      }),
    },
  },
});
