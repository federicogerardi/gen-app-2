import { fromPromise } from 'xstate';

import { idempotencyCoordinatorMachine } from './idempotency-coordinator.machine';
import { persistenceBatchMachine } from './persistence-batch.machine';
import { streamTransportMachine } from './stream-transport.machine';
import { toolWorkflowMachine } from './tool-workflow.machine';
import { usageMachine } from './usage.machine';
import { generationActor } from './generation-actor';
import { extractionErrorActor, toolWorkflowErrorActor, genericErrorActor } from './generation-system.error-actors';
import { buildExtractionStructuredPayload } from './generation/extraction-parsers';
import { getRegistrySelector } from './generation-routing';
import { isExtractionPayloadSemanticallyValid } from './generation-system.events';
import type { GenerationMachineContext } from './generation-system.types';
import { executeApiAcquisition } from '../runtime/integrations/api-acquisition.adapter';
import type { ResolvedApiServiceForAcquisition } from '../adapters/api-service.adapter';
import { crawlSerp, discoverPAAQueries } from '../runtime/integrations/crawling.adapter';
import { resolveSerpApiService } from '../runtime/integrations/serpapi-service-resolver';
import { computeCompetitorRanking } from '../runtime/analysis/scoring-engine';
import { createComponentLogger, LogComponent } from '../runtime/log-components';

const glog = createComponentLogger(LogComponent.GEOMETRIC);

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const toStringRecord = (value: unknown): Record<string, string> => {
  if (!isPlainRecord(value)) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === null || item === undefined) {
      continue;
    }
    normalized[key] = String(item);
  }

  return normalized;
};

const toUnknownRecord = (value: unknown): Record<string, unknown> => {
  return isPlainRecord(value) ? value : {};
};

const resolveAcquisitionInput = (context: GenerationMachineContext): {
  service: ResolvedApiServiceForAcquisition;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: Record<string, unknown>;
} | null => {
  const directAcquisition = context.requestInput.acquisition;
  const extractionPayload = context.requestInput.extractionPayload;
  const payloadAcquisition = isPlainRecord(extractionPayload)
    ? extractionPayload.acquisition
    : undefined;
  const acquisition = isPlainRecord(directAcquisition)
    ? directAcquisition
    : payloadAcquisition;

  if (!isPlainRecord(acquisition)) {
    return null;
  }

  const service = acquisition.service;
  if (!isPlainRecord(service)) {
    return null;
  }

  return {
    service: service as ResolvedApiServiceForAcquisition,
    query: toStringRecord(acquisition.query),
    headers: toStringRecord(acquisition.headers),
    body: toUnknownRecord(acquisition.body),
  };
};

export const generationSystemActors = {
  invokeIdempotency: idempotencyCoordinatorMachine,
  invokeUsage: usageMachine,
  invokeOwnership: fromPromise(
    async ({ input }: { input: { context: GenerationMachineContext } }) => {
      const { context } = input;
      const result = await context.adapters.ownership.checkProjectOwnership({
        userId: context.userId ?? 'anonymous',
        projectId: context.projectId ?? 'unknown-project',
      });

      if (!result.owned) {
        return {
          type: 'OWNERSHIP_REJECTED' as const,
          reason: result.reason ?? 'ownership_forbidden',
        };
      }

      return {
        type: 'OWNERSHIP_OK' as const,
      };
    },
  ),
  invokeStream: streamTransportMachine,
  invokePersistence: persistenceBatchMachine,
  invokeGeneration: generationActor,
  invokeExtraction: fromPromise(async ({ input }: { input: { context: GenerationMachineContext } }) => {
    const payload = buildExtractionStructuredPayload(input.context);

    if (!isExtractionPayloadSemanticallyValid(payload)) {
      return {
        type: 'EXTRACTION_ATTEMPT_REJECTED' as const,
        reason: 'extraction_context_insufficient',
      };
    }

    return {
      type: 'EXTRACTION_ATTEMPT_ACCEPTED' as const,
      artifactId: input.context.artifactId ?? input.context.artifactIdFactory(),
      content: JSON.stringify(payload, null, 2),
      structuredPayload: payload,
    };
  }),
  invokeApiAcquisition: fromPromise(async ({ input }: { input: { context: GenerationMachineContext } }) => {
    const acquisitionInput = resolveAcquisitionInput(input.context);
    if (!acquisitionInput) {
      return {
        type: 'ACQUISITION_ATTEMPT_SKIPPED' as const,
        reason: 'acquisition_not_configured',
      };
    }

    const result = await executeApiAcquisition({
      service: acquisitionInput.service,
      query: acquisitionInput.query,
      headers: acquisitionInput.headers,
      body: acquisitionInput.body,
    });

    return {
      type: 'ACQUISITION_ATTEMPT_ACCEPTED' as const,
      statusCode: result.statusCode,
      payload: result.payload,
    };
  }),
  invokeToolWorkflow: toolWorkflowMachine,
  extractionErrorActor,
  toolWorkflowErrorActor,
  genericErrorActor,
  markCompletedIdempotency: fromPromise(
    async ({ input }: { input: { context: GenerationMachineContext } }) => {
      const { context } = input;
      if (!context.userId || !context.projectId || !context.idempotencyKey || !context.artifactId) {
        return;
      }

      await context.adapters.idempotency.markCompleted(
        {
          requestId: context.requestId,
          userId: context.userId,
          projectId: context.projectId,
          workflowType: context.workflowType,
          idempotencyKey: context.idempotencyKey,
          ...getRegistrySelector(context),
        },
        context.artifactId,
        context.contentBuffer,
      );
    },
  ),
  markFailedIdempotency: fromPromise(async ({ input }: { input: { context: GenerationMachineContext } }) => {
    const { context } = input;
    if (!context.userId || !context.projectId || !context.idempotencyKey) {
      return;
    }

    await context.adapters.idempotency.markFailed({
      requestId: context.requestId,
      userId: context.userId,
      projectId: context.projectId,
      workflowType: context.workflowType,
      idempotencyKey: context.idempotencyKey,
      ...getRegistrySelector(context),
    });
  }),
  invokeConsumeCredits: fromPromise(async ({ input }: { input: { context: GenerationMachineContext; creditCost: number } }) => {
    const { context, creditCost } = input;
    if (!context.userId) {
      return;
    }

    await context.adapters.usage.consumeCredits({
      userId: context.userId,
      ...(context.projectId !== null ? { projectId: context.projectId } : {}),
      ...(context.sessionId !== null ? { sessionId: context.sessionId } : {}),
      requestId: context.requestId,
      creditCost,
      ...(context.workflowType !== null ? { workflowType: context.workflowType } : {}),
      model: context.model,
      runtime: { now: context.runtimeNow },
    });
  }),
  invokeRecordArtifactSuccess: fromPromise(async ({ input }: { input: { context: GenerationMachineContext } }) => {
    const { context } = input;
    if (!context.userId) {
      return;
    }

    await context.adapters.usage.recordArtifactSuccess({
      userId: context.userId,
      ...(context.projectId !== null ? { projectId: context.projectId } : {}),
      ...(context.sessionId !== null ? { sessionId: context.sessionId } : {}),
      requestId: context.requestId,
      ...(context.artifactId !== null ? { artifactId: context.artifactId } : {}),
      runtime: { now: context.runtimeNow },
    });
  }),
  invokeCrawling: fromPromise(async ({ input }: { input: { context: GenerationMachineContext } }) => {
    const { context } = input;
    const requestInput = context.requestInput as Record<string, unknown>;
    const extractionPayload = requestInput.extractionPayload as Record<string, unknown> | undefined;
    const baseQuery = typeof requestInput.baseQuery === 'string'
      ? requestInput.baseQuery
      : (typeof extractionPayload?.baseQuery === 'string' ? extractionPayload.baseQuery : '');
    const language = typeof requestInput.language === 'string'
      ? requestInput.language
      : (typeof extractionPayload?.language === 'string' ? extractionPayload.language : 'it');
    const country = typeof requestInput.country === 'string'
      ? requestInput.country
      : (typeof extractionPayload?.country === 'string' ? extractionPayload.country : 'google.it');
    const brandName = typeof requestInput.brandName === 'string'
      ? requestInput.brandName
      : (typeof extractionPayload?.brandName === 'string' ? extractionPayload.brandName : '');
    const requestId = context.requestId ?? 'unknown';

    // Resolve SerpApi service — required, no fallback
    if (!context.adapters.apiService) {
      glog.error({ requestId, operation: 'invokeCrawling' }, 'crawling.failed.api_service_adapter_missing');
      return {
        type: 'CRAWLING_FAILED' as const,
        reason: 'api_service_adapter_missing',
      };
    }

    let serpApiService: ResolvedApiServiceForAcquisition | undefined;
    try {
      serpApiService = await resolveSerpApiService(context.adapters.apiService);
    } catch (error) {
      glog.error({ requestId, operation: 'invokeCrawling', error: error instanceof Error ? error.message : 'Unknown error' }, 'crawling.failed.service_resolution');
      return {
        type: 'CRAWLING_FAILED' as const,
        reason: 'serpapi_resolution_failed',
      };
    }

    if (!serpApiService) {
      glog.error({ requestId, operation: 'invokeCrawling' }, 'crawling.failed.service_not_found');
      return {
        type: 'CRAWLING_FAILED' as const,
        reason: 'serpapi_service_not_found',
      };
    }

    glog.info({ requestId, operation: 'invokeCrawling', baseQuery, language, country, brandName }, 'crawling.start');

    if (!baseQuery) {
      glog.error({ requestId, operation: 'invokeCrawling' }, 'crawling.failed.base_query_missing');
      return {
        type: 'CRAWLING_FAILED' as const,
        reason: 'base_query_missing',
      };
    }

    const startMs = Date.now();
    try {
      const baseResult = await crawlSerp(baseQuery, language, country, serpApiService);
      const paaQueries = await discoverPAAQueries(baseQuery, language, country, serpApiService);

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
        glog.info({ requestId, operation: 'invokeCrawling', paaCount: paaQueries.length }, 'crawling.paa.discovered');

        const paaResults = await Promise.all(
          paaQueries.slice(0, 4).map(async (paaQuery) => {
            try {
              const result = await crawlSerp(paaQuery, language, country, serpApiService);
              return {
                query: paaQuery,
                isPaa: true,
                content: result.aiOverviewSnippet ?? '',
                structuredPayload: { sources: result.sources },
              };
            } catch {
              glog.warn({ requestId, operation: 'invokeCrawling', paaQuery }, 'crawling.paa.single_failed');
              return null;
            }
          }),
        );
        crawlArtifacts.push(...paaResults.filter((r): r is NonNullable<typeof r> => r !== null));
      }

      const durationMs = Date.now() - startMs;
      glog.info({ requestId, operation: 'invokeCrawling', durationMs, sourceCount: baseResult.sources.length, paaCount: paaQueries.length }, 'crawling.completed');

      return {
        type: 'CRAWLING_COMPLETED' as const,
        crawlArtifacts,
        paaQueries: paaQueries.slice(0, 4),
      };
    } catch (err) {
      const durationMs = Date.now() - startMs;
      glog.error({ requestId, operation: 'invokeCrawling', durationMs, error: err instanceof Error ? err.message : 'crawling_error' }, 'crawling.failed');
      return {
        type: 'CRAWLING_FAILED' as const,
        reason: err instanceof Error ? err.message : 'crawling_error',
      };
    }
  }),
  invokeScoring: fromPromise(async ({ input }: { input: { context: GenerationMachineContext } }) => {
    const { context } = input;
    const requestInput = context.requestInput as Record<string, unknown>;
    const crawling = requestInput.crawling as Record<string, unknown> | undefined;
    const sources = Array.isArray(crawling?.sources)
      ? (crawling.sources as { url: string; sourceType?: string }[])
      : [];
    const requestId = context.requestId ?? 'unknown';

    glog.info({ requestId, operation: 'invokeScoring', sourceCount: sources.length }, 'scoring.start');

    if (sources.length === 0) {
      glog.error({ requestId, operation: 'invokeScoring' }, 'scoring.failed.no_sources');
      return {
        type: 'SCORING_FAILED' as const,
        reason: 'no_crawling_sources_for_scoring',
      };
    }

    const startMs = Date.now();
    try {
      const ranking = computeCompetitorRanking(sources);
      const durationMs = Date.now() - startMs;
      const competitorCount = Object.keys(ranking).length;

      glog.info({ requestId, operation: 'invokeScoring', durationMs, competitorCount }, 'scoring.completed');

      return {
        type: 'SCORING_COMPLETED' as const,
        ranking,
      };
    } catch (err) {
      const durationMs = Date.now() - startMs;
      glog.error({ requestId, operation: 'invokeScoring', durationMs, error: err instanceof Error ? err.message : 'scoring_error' }, 'scoring.failed');
      return {
        type: 'SCORING_FAILED' as const,
        reason: err instanceof Error ? err.message : 'scoring_error',
      };
    }
  }),
};

export type GenerationSystemProvidedActor =
  | { src: 'invokeIdempotency'; logic: typeof generationSystemActors.invokeIdempotency; id: string | undefined }
  | { src: 'invokeUsage'; logic: typeof generationSystemActors.invokeUsage; id: string | undefined }
  | { src: 'invokeOwnership'; logic: typeof generationSystemActors.invokeOwnership; id: string | undefined }
  | { src: 'invokeStream'; logic: typeof generationSystemActors.invokeStream; id: string | undefined }
  | { src: 'invokePersistence'; logic: typeof generationSystemActors.invokePersistence; id: string | undefined }
  | { src: 'invokeExtraction'; logic: typeof generationSystemActors.invokeExtraction; id: string | undefined }
  | { src: 'invokeApiAcquisition'; logic: typeof generationSystemActors.invokeApiAcquisition; id: string | undefined }
  | { src: 'invokeCrawling'; logic: typeof generationSystemActors.invokeCrawling; id: string | undefined }
  | { src: 'invokeScoring'; logic: typeof generationSystemActors.invokeScoring; id: string | undefined }
  | { src: 'invokeToolWorkflow'; logic: typeof generationSystemActors.invokeToolWorkflow; id: string | undefined }
  | { src: 'markCompletedIdempotency'; logic: typeof generationSystemActors.markCompletedIdempotency; id: string | undefined }
  | { src: 'markFailedIdempotency'; logic: typeof generationSystemActors.markFailedIdempotency; id: string | undefined }
  | { src: 'invokeConsumeCredits'; logic: typeof generationSystemActors.invokeConsumeCredits; id: string | undefined }
  | { src: 'invokeRecordArtifactSuccess'; logic: typeof generationSystemActors.invokeRecordArtifactSuccess; id: string | undefined }
  | { src: 'invokeGeneration'; logic: typeof generationSystemActors.invokeGeneration; id: string | undefined }
  | { src: 'extractionErrorActor'; logic: typeof generationSystemActors.extractionErrorActor; id: string | undefined }
  | { src: 'toolWorkflowErrorActor'; logic: typeof generationSystemActors.toolWorkflowErrorActor; id: string | undefined }
  | { src: 'genericErrorActor'; logic: typeof generationSystemActors.genericErrorActor; id: string | undefined };