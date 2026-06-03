import { createPostgresRedisGenerationAdapters } from './postgres-redis.adapters';
import {
  createSyntheticLlmStreamAdapter,
  type LlmStreamAdapter,
} from './generation.adapters';
import { createOpenRouterLlmStreamAdapterFromEnv } from './openrouter.adapter';

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
    persistence: new PostgresArtifactRepository(clients.pg, options.persistence),
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
