import type Redis from 'ioredis';
import type { Pool } from 'pg';

import type { IdempotencyCoordinatorInput } from '../types/xstate';

import type { LlmStreamAdapter } from './generation.adapters';
import type { ProductionAdapterRuntime } from './postgres-redis.interfaces';

export type UsageRepositoryOptions = {
  rateLimitWindowSeconds?: number;
  maxRequestsPerWindow?: number;
  redisKeyPrefix?: string;
  usersTableName?: string;
  usersSchema?: string;
};

export type IdempotencyRepositoryOptions = {
  redisKeyPrefix?: string;
  redisLockTtlSeconds?: number;
  requestIdempotencyTableName?: string;
  requestIdempotencySchema?: string;
  endpointResolver?: (input: IdempotencyCoordinatorInput) => string;
};

export type StreamRepositoryOptions = {
  redisKeyPrefix?: string;
  sessionTtlSeconds?: number;
};

export type PersistenceRepositoryOptions = {
  artifactsTableName?: string;
  artifactsSchema?: string;
  usersTableName?: string;
  usersSchema?: string;
  quotaHistoryTableName?: string;
  quotaHistorySchema?: string;
  projectsTableName?: string;
  projectsSchema?: string;
};

export type ProjectRow = {
  id: string;
  user_id: string;
  name: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type ArtifactRow = {
  id: string;
  request_id: string;
  user_id: string | null;
  user_email?: string | null;
  project_id: string | null;
  type: string;
  status: string;
  model: string;
  workflow_type: string | null;
  session_id?: string | null;
  step_key?: string | null;
  artifact_role?: string | null;
  run_mode?: string | null;
  input_json: Record<string, unknown> | null;
  content: string;
  failure_reason: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type PostgresRedisProductionClients = {
  pg: Pool;
  redis: Redis;
};

export type OrchestrateCacheOptions = {
  prefix?: string;
  ttlSeconds?: number;
};

export type PostgresRedisProductionOptions = {
  runtime?: ProductionAdapterRuntime;
  usage?: UsageRepositoryOptions;
  idempotency?: IdempotencyRepositoryOptions;
  stream?: StreamRepositoryOptions;
  persistence?: PersistenceRepositoryOptions;
  llm?: {
    adapter?: LlmStreamAdapter;
  };
  orchestrateCache?: OrchestrateCacheOptions;
};

export type IdempotencyRow = {
  status: 'in_progress' | 'completed' | 'failed';
  artifact_id: string | null;
  content: string | null;
};
