import { fromPromise, setup } from 'xstate';
import { crawlSerp, discoverPAAQueries } from '../../runtime/integrations/crawling.adapter';
import { logGeometricInfo, logGeometricWarn, logGeometricError } from '../../runtime/integrations/geometric-logger';
import type { ResolvedApiServiceForAcquisition } from '../../adapters/api-service.adapter';

export type CrawlingChainInput = {
  requestId: string;
  stepKey: string;
  baseQuery: string;
  language: string;
  country: string;
  sessionId: string;
  apiService: ResolvedApiServiceForAcquisition; // Required SerpApi service — no fallback
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
  actors: {
    invokeCrawling: fromPromise(async ({ input }: { input: { context: CrawlingChainContext } }) => {
      const { input: chainInput } = input.context;
      const requestId = chainInput.requestId ?? 'unknown';
      const baseQuery = chainInput.baseQuery;
      const language = chainInput.language || 'it';
      const country = chainInput.country || 'google.it';

      logGeometricInfo('crawling.start', {
        requestId,
        operation: 'crawlingChainMachine',
        baseQuery,
        language,
        country,
      });

      if (!baseQuery) {
        logGeometricError('crawling.failed.base_query_missing', { requestId, operation: 'crawlingChainMachine' });
        throw new Error('base_query_missing');
      }

      if (!chainInput.apiService) {
        logGeometricError('crawling.failed.api_service_missing', { requestId, operation: 'crawlingChainMachine' });
        throw new Error('api_service_missing');
      }

      const startMs = Date.now();
      try {
        const baseResult = await crawlSerp(baseQuery, language, country, chainInput.apiService);
        const paaQueries = await discoverPAAQueries(baseQuery, language, country, chainInput.apiService);

        const crawlArtifacts: { query: string; isPaa: boolean; content: string; structuredPayload: Record<string, unknown> }[] = [
          {
            query: baseQuery,
            isPaa: false,
            content: baseResult.aiOverviewSnippet ?? '',
            structuredPayload: {
              sources: baseResult.sources,
              paaQueries: paaQueries,
            },
          },
        ];

        if (paaQueries.length > 0) {
          logGeometricInfo('crawling.paa.discovered', {
            requestId,
            operation: 'crawlingChainMachine',
            paaCount: paaQueries.length,
          });

          const paaResults = await Promise.all(
            paaQueries.slice(0, 4).map(async (paaQuery) => {
              try {
                const result = await crawlSerp(paaQuery, language, country, chainInput.apiService);
                return {
                  query: paaQuery,
                  isPaa: true,
                  content: result.aiOverviewSnippet ?? '',
                  structuredPayload: { sources: result.sources },
                };
              } catch {
                logGeometricWarn('crawling.paa.single_failed', {
                  requestId,
                  operation: 'crawlingChainMachine',
                  paaQuery,
                });
                return null;
              }
            }),
          );
          crawlArtifacts.push(...paaResults.filter((r): r is NonNullable<typeof r> => r !== null));
        }

        const durationMs = Date.now() - startMs;
        logGeometricInfo('crawling.completed', {
          requestId,
          operation: 'crawlingChainMachine',
          durationMs,
          sourceCount: baseResult.sources.length,
          paaCount: paaQueries.length,
        });

        return {
          type: 'CRAWLING_COMPLETED' as const,
          requestId,
          stepKey: chainInput.stepKey,
          crawlArtifacts,
          paaQueries: paaQueries.slice(0, 4),
        };
      } catch (err) {
        const durationMs = Date.now() - startMs;
        logGeometricError('crawling.failed', {
          requestId,
          operation: 'crawlingChainMachine',
          durationMs,
          error: err instanceof Error ? err.message : 'crawling_error',
        });
        throw err;
      }
    }),
  },
}).createMachine({
  id: 'crawlingChainMachine',
  initial: 'crawling',
  context: ({ input }) => ({ input }),
  states: {
    crawling: {
      invoke: {
        id: 'crawlingActor',
        src: 'invokeCrawling',
        input: ({ context }) => ({ context }),
        onDone: {
          target: 'done',
        },
        onError: {
          target: 'done',
        },
      },
    },
    done: {
      type: 'final',
      output: ({ context }) => {
        const output = (context as unknown as { output?: CrawlingChainOutput }).output;
        return output ?? {
          type: 'CRAWLING_COMPLETED' as const,
          requestId: context.input.requestId,
          stepKey: context.input.stepKey,
          crawlArtifacts: [],
          paaQueries: [],
        };
      },
    },
  },
});
