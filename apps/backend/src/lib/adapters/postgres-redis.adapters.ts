import type { GenerationAdapters } from './generation.adapters';
import type { PostgresRedisAdapterDependencies } from './postgres-redis.interfaces';

export const createPostgresRedisGenerationAdapters = (
  dependencies: PostgresRedisAdapterDependencies,
): GenerationAdapters => {
  return {
    ownership: {
      checkProjectOwnership: (input) => dependencies.ownership.checkProjectOwnership(input),
    },
    usage: {
      claimUsage: (input) => dependencies.quota.claimUsage(input),
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
    persistence: {
      flushProgress: (input, sequence) => dependencies.persistence.flushProgress(input, sequence),
      finalizeSuccess: (input) => dependencies.persistence.finalizeSuccess(input),
      finalizeFailure: (input, reason) => dependencies.persistence.finalizeFailure(input, reason),
    },
  };
};
