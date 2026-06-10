import { createPostgresRedisGenerationAdapters } from './postgres-redis.adapters';
import {
  createSyntheticLlmStreamAdapter,
  createSyntheticLlmGenerateAdapter,
  type LlmStreamAdapter,
  type LlmGenerateAdapter,
} from './generation.adapters';
import { createOpenRouterLlmStreamAdapterFromEnv, createOpenRouterLlmGenerateAdapterFromEnv } from './openrouter.adapter';

import type { PostgresRedisAdapterDependencies } from './postgres-redis.interfaces';
import {
  type PostgresRedisProductionClients,
  type PostgresRedisProductionOptions,
} from './postgres-redis.shared.types';

import { PostgresRedisUsageRepository } from './postgres-redis.usage.repository';
import { PostgresProjectOwnershipRepository } from './postgres.project-ownership.repository';
import { PostgresRedisIdempotencyRepository } from './postgres-redis.idempotency.repository';
import { PostgresRedisStreamSessionRepository } from './postgres-redis.stream.repository';
import { PostgresArtifactRepository } from './postgres.artifact.repository';
import { PostgresProjectQueryRepository } from './postgres.project-query.repository';
import { PostgresArtifactQueryRepository } from './postgres.artifact-query.repository';
import { RedisOrchestrateArtifactCache } from './redis-orchestrate-artifact-cache';

export {
  PostgresRedisUsageRepository,
  PostgresProjectOwnershipRepository,
  PostgresRedisIdempotencyRepository,
  PostgresRedisStreamSessionRepository,
  PostgresArtifactRepository,
  PostgresProjectQueryRepository,
  PostgresArtifactQueryRepository,
};

export type {
  PostgresRedisProductionClients,
  PostgresRedisProductionOptions,
};

export const createPostgresRedisProductionDependencies = (
  clients: PostgresRedisProductionClients,
  options: PostgresRedisProductionOptions = {},
): PostgresRedisAdapterDependencies => {
  const explicitLlmAdapter = options.llm?.adapter;
  const openRouterLlmAdapter = explicitLlmAdapter
    ? null
    : createOpenRouterLlmStreamAdapterFromEnv();

  const llm: LlmStreamAdapter | null = explicitLlmAdapter ?? openRouterLlmAdapter;
  if (!llm) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'production_llm_adapter_missing: provide options.llm.adapter or set OPENROUTER_API_KEY',
      );
    }
    console.warn(
      '[adapter][llm] OPENROUTER_API_KEY is not set; falling back to synthetic LLM adapter. ' +
        'All generation requests will return stubbed content instead of calling a real LLM.',
    );
  }

  const explicitGenerateAdapter = options.generate?.adapter;
  const openRouterGenerateAdapter = explicitGenerateAdapter
    ? null
    : createOpenRouterLlmGenerateAdapterFromEnv();

  const generate: LlmGenerateAdapter | null = explicitGenerateAdapter ?? openRouterGenerateAdapter;
  if (!generate) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'production_generate_adapter_missing: provide options.generate.adapter or set OPENROUTER_API_KEY',
      );
    }
    console.warn(
      '[adapter][generate] OPENROUTER_API_KEY is not set; falling back to synthetic generate adapter. ' +
        'All non-streaming generation requests will return stubbed content instead of calling a real LLM.',
    );
  }

  return {
    ownership: new PostgresProjectOwnershipRepository(clients.pg, options.persistence),
    quota: new PostgresRedisUsageRepository(clients.pg, clients.redis, options.usage),
    idempotency: new PostgresRedisIdempotencyRepository(
      clients.pg,
      clients.redis,
      options.idempotency,
    ),
    stream: new PostgresRedisStreamSessionRepository(
      clients.redis,
      options.runtime,
      options.stream,
    ),
    llm: llm ?? createSyntheticLlmStreamAdapter(),
    generate: generate ?? createSyntheticLlmGenerateAdapter(),
    persistence: new PostgresArtifactRepository(clients.pg, options.persistence),
    orchestrateCache: new RedisOrchestrateArtifactCache(clients.redis, options.orchestrateCache),
  };
};

export const createPostgresRedisProductionGenerationAdapters = (
  clients: PostgresRedisProductionClients,
  options: PostgresRedisProductionOptions = {},
) => {
  return createPostgresRedisGenerationAdapters(
    createPostgresRedisProductionDependencies(clients, options),
  );
};
