import type { GenerationAdapters } from './generation.adapters';
import type { PostgresRedisAdapterDependencies } from './postgres-redis.interfaces';
import { resolveApiServiceForCrawling } from './api-service.adapter';
import { createComponentLogger, LogComponent } from '../runtime/log-components';
import { createAssetSnapshotResolver } from '../runtime/asset-injection-resolver';
import { getAssetById, getAssetVersions, getAssetGroupById } from './asset.adapter';
import { createKyselyDb } from './postgres-kysely.dialect';

export const createPostgresRedisGenerationAdapters = (
  dependencies: PostgresRedisAdapterDependencies,
): GenerationAdapters => {
  const assetDb = dependencies.pg ? createKyselyDb(dependencies.pg) : null;
  return {
    ownership: {
      checkProjectOwnership: (input) => dependencies.ownership.checkProjectOwnership(input),
    },
    usage: {
      claimUsage: (input) => dependencies.quota.claimUsage(input),
      consumeCredits: (input) => dependencies.quota.consumeCredits(input),
      recordArtifactSuccess: (input) => dependencies.quota.recordArtifactSuccess(input),
    },
    idempotency: {
      checkAndClaim: (input) => dependencies.idempotency.checkAndClaim(input),
      markCompleted: (input, artifactId, content) =>
        dependencies.idempotency.markCompleted(input, artifactId, content),
      markFailed: (input) => dependencies.idempotency.markFailed(input),
    },
    stream: {
      openSession: (input) => dependencies.stream.openSession(input),
    },
    llm: {
      streamText: (input) => dependencies.llm.streamText(input),
    },
    generate: {
      generateText: (input) => dependencies.generate.generateText(input),
    },
    persistence: {
      flushProgress: (input, sequence) => dependencies.persistence.flushProgress(input, sequence),
      finalizeSuccess: async (input) => {
        await dependencies.persistence.finalizeSuccess(input);
        if (
          dependencies.orchestrateCache
          && input.userId
          && input.projectId
          && input.inputJson
        ) {
          const twRaw = input.inputJson.toolWorkflow;
          const tw =
            twRaw && typeof twRaw === 'object' && !Array.isArray(twRaw)
              ? (twRaw as Record<string, unknown>)
              : null;
          const stepKey =
            tw
            && typeof tw.stepKey === 'string'
            && tw.stepKey.trim().length > 0
              ? tw.stepKey.trim()
              : null;
          if (stepKey) {
            void dependencies.orchestrateCache
              .setStepArtifact(
                input.userId,
                input.projectId,
                String(input.workflowType),
                stepKey,
                input.artifactId,
              )
              .catch((err) => {
                const cacheLog = createComponentLogger(LogComponent.POSTGRES_REDIS);
                cacheLog.warn({ err }, 'orchestrate cache setStepArtifact failed (non-fatal)');
              });
          }
        }
      },
      finalizeFailure: (input, reason) => dependencies.persistence.finalizeFailure(input, reason),
    },
    orchestrateCache: dependencies.orchestrateCache,
    apiService: dependencies.pg ? {
      resolveApiServiceForCrawling: (id) => resolveApiServiceForCrawling(dependencies.pg!, id),
    } : null,
    assetSnapshotResolver: assetDb
      ? createAssetSnapshotResolver(
          (id) => getAssetById(assetDb, id),
          (id) => getAssetVersions(assetDb, id),
          (id) => getAssetGroupById(assetDb, id),
        )
      : {
          getAssetSnapshot: async () => null,
          getGroupAssetSnapshots: async () => [],
        },
  };
};
