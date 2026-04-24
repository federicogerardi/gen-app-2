import type Redis from 'ioredis';
import type { Pool, PoolClient, QueryResult } from 'pg';

import type {
  IdempotencyCoordinatorInput,
  PersistenceBatchInput,
  StreamTransportInput,
  UsageActorInput,
} from '../types/xstate';

import { createPostgresRedisGenerationAdapters } from './postgres-redis.adapters';
import {
  buildIdempotencyRedisLockKey,
  DEFAULT_IDEMPOTENCY_REDIS_KEY_PREFIX,
} from './postgres-redis.shared';
import type {
  IdempotencyDecision,
  UsageDecision,
} from './generation.adapters';
import type {
  PostgresArtifactRepository as PostgresArtifactRepositoryPort,
  PostgresRedisAdapterDependencies,
  ProductionAdapterRuntime,
  RedisIdempotencyRepository,
  RedisQuotaRepository,
  RedisStreamSessionRepository,
} from './postgres-redis.interfaces';

const nowDate = (runtime?: ProductionAdapterRuntime): Date =>
  runtime?.now?.() ?? new Date();

const randomId = (runtime?: ProductionAdapterRuntime): string =>
  runtime?.randomId?.() ?? Math.random().toString(36).slice(2, 14);

const quoteIdentifier = (identifier: string): string => {
  return `"${identifier.replace(/"/g, '""')}"`;
};

const buildQualifiedTableName = (schema: string | undefined, table: string): string => {
  if (!schema) {
    return quoteIdentifier(table);
  }

  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
};

type UsageRepositoryOptions = {
  rateLimitWindowSeconds?: number;
  maxRequestsPerWindow?: number;
  redisKeyPrefix?: string;
  usersTableName?: string;
  usersSchema?: string;
};

type IdempotencyRepositoryOptions = {
  redisKeyPrefix?: string;
  redisLockTtlSeconds?: number;
  requestIdempotencyTableName?: string;
  requestIdempotencySchema?: string;
  endpointResolver?: (input: IdempotencyCoordinatorInput) => string;
};

type StreamRepositoryOptions = {
  redisKeyPrefix?: string;
  sessionTtlSeconds?: number;
};

type PersistenceRepositoryOptions = {
  artifactsTableName?: string;
  artifactsSchema?: string;
  quotaHistoryTableName?: string;
  quotaHistorySchema?: string;
};

export type PostgresRedisProductionClients = {
  pg: Pool;
  redis: Redis;
};

export type PostgresRedisProductionOptions = {
  runtime?: ProductionAdapterRuntime;
  usage?: UsageRepositoryOptions;
  idempotency?: IdempotencyRepositoryOptions;
  stream?: StreamRepositoryOptions;
  persistence?: PersistenceRepositoryOptions;
};

type IdempotencyRow = {
  status: 'in_progress' | 'completed' | 'failed';
  artifact_id: string | null;
  content: string | null;
};

const defaultEndpointResolver = (input: IdempotencyCoordinatorInput): string => {
  return input.workflowType ?? 'generation';
};

const withTransaction = async <T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export class PostgresRedisUsageRepository implements RedisQuotaRepository {
  private readonly rateLimitWindowSeconds: number;
  private readonly maxRequestsPerWindow: number;
  private readonly redisKeyPrefix: string;
  private readonly usersTableName: string;

  constructor(
    private readonly pg: Pool,
    private readonly redis: Redis,
    options: UsageRepositoryOptions = {},
  ) {
    this.rateLimitWindowSeconds = options.rateLimitWindowSeconds ?? 60;
    this.maxRequestsPerWindow = options.maxRequestsPerWindow ?? 120;
    this.redisKeyPrefix = options.redisKeyPrefix ?? 'generation:usage';
    this.usersTableName = buildQualifiedTableName(
      options.usersSchema,
      options.usersTableName ?? 'users',
    );
  }

  async claimUsage(input: UsageActorInput): Promise<UsageDecision> {
    const rateKey = `${this.redisKeyPrefix}:rate:${input.userId}`;
    const currentCount = await this.redis.incr(rateKey);
    if (currentCount === 1) {
      await this.redis.expire(rateKey, this.rateLimitWindowSeconds);
    }

    if (currentCount > this.maxRequestsPerWindow) {
      return { granted: false, reason: 'rate_limited' };
    }

    const query = `
      UPDATE ${this.usersTableName}
      SET monthly_used = monthly_used + 1
      WHERE id = $1 AND monthly_used < monthly_quota
      RETURNING monthly_used, monthly_quota
    `;

    const result = await this.pg.query(query, [input.userId]);
    if (result.rowCount && result.rowCount > 0) {
      return { granted: true };
    }

    return { granted: false, reason: 'quota_exhausted' };
  }
}

export class PostgresRedisIdempotencyRepository implements RedisIdempotencyRepository {
  private readonly redisKeyPrefix: string;
  private readonly redisLockTtlSeconds: number;
  private readonly requestIdempotencyTableName: string;
  private readonly endpointResolver: (input: IdempotencyCoordinatorInput) => string;

  constructor(
    private readonly pg: Pool,
    private readonly redis: Redis,
    options: IdempotencyRepositoryOptions = {},
  ) {
    this.redisKeyPrefix = options.redisKeyPrefix ?? DEFAULT_IDEMPOTENCY_REDIS_KEY_PREFIX;
    this.redisLockTtlSeconds = options.redisLockTtlSeconds ?? 900;
    this.requestIdempotencyTableName = buildQualifiedTableName(
      options.requestIdempotencySchema,
      options.requestIdempotencyTableName ?? 'request_idempotency',
    );
    this.endpointResolver = options.endpointResolver ?? defaultEndpointResolver;
  }

  async checkAndClaim(input: IdempotencyCoordinatorInput): Promise<IdempotencyDecision> {
    const endpoint = this.endpointResolver(input);
    const existing = await this.fetchRecord(input, endpoint);
    if (existing) {
      if (existing.status === 'completed' && existing.artifact_id && existing.content !== null) {
        return {
          status: 'replay',
          artifactId: existing.artifact_id,
          content: existing.content,
        };
      }

      return {
        status: 'conflict',
        reason: 'idempotency_conflict',
      };
    }

    const lockKey = this.getLockKey(input, endpoint);
    const lockValue = `${input.requestId}:${nowDate().toISOString()}`;
    const lockResult = await this.redis.set(
      lockKey,
      lockValue,
      'EX',
      this.redisLockTtlSeconds,
      'NX',
    );

    if (lockResult !== 'OK') {
      return {
        status: 'conflict',
        reason: 'idempotency_conflict',
      };
    }

    const query = `
      INSERT INTO ${this.requestIdempotencyTableName}
        (user_id, project_id, endpoint, idempotency_key, status, artifact_id, content, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, 'in_progress', NULL, '', NOW(), NOW())
      ON CONFLICT (user_id, project_id, endpoint, idempotency_key)
      DO NOTHING
      RETURNING artifact_id
    `;

    try {
      const result = await this.pg.query(query, [
        input.userId,
        input.projectId,
        endpoint,
        input.idempotencyKey,
      ]);

      if (result.rowCount && result.rowCount > 0) {
        return { status: 'claimed' };
      }

      await this.redis.del(lockKey);
      const current = await this.fetchRecord(input, endpoint);
      if (current?.status === 'completed' && current.artifact_id && current.content !== null) {
        return {
          status: 'replay',
          artifactId: current.artifact_id,
          content: current.content,
        };
      }

      return {
        status: 'conflict',
        reason: 'idempotency_conflict',
      };
    } catch (error) {
      await this.redis.del(lockKey);
      throw error;
    }
  }

  async markCompleted(
    input: IdempotencyCoordinatorInput,
    artifactId: string,
    content: string,
  ): Promise<void> {
    const endpoint = this.endpointResolver(input);
    const query = `
      UPDATE ${this.requestIdempotencyTableName}
      SET status = 'completed', artifact_id = $5, content = $6, updated_at = NOW()
      WHERE user_id = $1
        AND project_id = $2
        AND endpoint = $3
        AND idempotency_key = $4
    `;

    await this.pg.query(query, [
      input.userId,
      input.projectId,
      endpoint,
      input.idempotencyKey,
      artifactId,
      content,
    ]);
    await this.redis.del(this.getLockKey(input, endpoint));
  }

  async markFailed(input: IdempotencyCoordinatorInput): Promise<void> {
    const endpoint = this.endpointResolver(input);
    const query = `
      UPDATE ${this.requestIdempotencyTableName}
      SET status = 'failed', updated_at = NOW()
      WHERE user_id = $1
        AND project_id = $2
        AND endpoint = $3
        AND idempotency_key = $4
    `;

    await this.pg.query(query, [
      input.userId,
      input.projectId,
      endpoint,
      input.idempotencyKey,
    ]);
    await this.redis.del(this.getLockKey(input, endpoint));
  }

  private async fetchRecord(
    input: IdempotencyCoordinatorInput,
    endpoint: string,
  ): Promise<IdempotencyRow | null> {
    const query = `
      SELECT status, artifact_id, content
      FROM ${this.requestIdempotencyTableName}
      WHERE user_id = $1
        AND project_id = $2
        AND endpoint = $3
        AND idempotency_key = $4
      LIMIT 1
    `;

    const result: QueryResult<IdempotencyRow> = await this.pg.query(query, [
      input.userId,
      input.projectId,
      endpoint,
      input.idempotencyKey,
    ]);

    return result.rows[0] ?? null;
  }

  private getLockKey(input: IdempotencyCoordinatorInput, endpoint: string): string {
    return buildIdempotencyRedisLockKey(this.redisKeyPrefix, input, endpoint);
  }
}

export class PostgresRedisStreamSessionRepository implements RedisStreamSessionRepository {
  private readonly redisKeyPrefix: string;
  private readonly sessionTtlSeconds: number;

  constructor(
    private readonly redis: Redis,
    private readonly runtime?: ProductionAdapterRuntime,
    options: StreamRepositoryOptions = {},
  ) {
    this.redisKeyPrefix = options.redisKeyPrefix ?? 'generation:stream';
    this.sessionTtlSeconds = options.sessionTtlSeconds ?? 3600;
  }

  async openSession(input: StreamTransportInput): Promise<{ sessionId: string }> {
    const sessionId = `${input.requestId}:${input.artifactId}:${randomId(this.runtime)}`;
    const sessionKey = `${this.redisKeyPrefix}:session:${sessionId}`;
    const payload = JSON.stringify({
      requestId: input.requestId,
      artifactId: input.artifactId,
      model: input.model,
      workflowType: input.workflowType,
      outputFormat: input.outputFormat,
      createdAt: nowDate(this.runtime).toISOString(),
    });

    await this.redis.set(sessionKey, payload, 'EX', this.sessionTtlSeconds);
    return { sessionId };
  }
}

export class PostgresArtifactRepository implements PostgresArtifactRepositoryPort {
  private readonly artifactsTableName: string;
  private readonly quotaHistoryTableName: string;

  constructor(
    private readonly pg: Pool,
    options: PersistenceRepositoryOptions = {},
  ) {
    this.artifactsTableName = buildQualifiedTableName(
      options.artifactsSchema,
      options.artifactsTableName ?? 'artifacts',
    );
    this.quotaHistoryTableName = buildQualifiedTableName(
      options.quotaHistorySchema,
      options.quotaHistoryTableName ?? 'quota_history',
    );
  }

  async flushProgress(input: PersistenceBatchInput, _sequence: number): Promise<void> {
    const query = `
      INSERT INTO ${this.artifactsTableName}
        (
          id,
          request_id,
          user_id,
          project_id,
          type,
          workflow_type,
          model,
          input_json,
          status,
          content,
          input_tokens,
          output_tokens,
          cost_usd,
          registry_version,
          registry_snapshot_ref,
          created_at,
          updated_at,
          streamed_at
        )
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'generating', $9, $10, $11, $12, $13, $14, NOW(), NOW(), NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        content = EXCLUDED.content,
        input_json = EXCLUDED.input_json,
        input_tokens = EXCLUDED.input_tokens,
        output_tokens = EXCLUDED.output_tokens,
        cost_usd = EXCLUDED.cost_usd,
        model = EXCLUDED.model,
        user_id = COALESCE(EXCLUDED.user_id, ${this.artifactsTableName}.user_id),
        project_id = COALESCE(EXCLUDED.project_id, ${this.artifactsTableName}.project_id),
        updated_at = NOW(),
        streamed_at = NOW(),
        registry_version = EXCLUDED.registry_version,
        registry_snapshot_ref = EXCLUDED.registry_snapshot_ref,
        status = CASE
          WHEN ${this.artifactsTableName}.status IN ('completed', 'failed') THEN ${this.artifactsTableName}.status
          ELSE 'generating'
        END
      WHERE ${this.artifactsTableName}.status NOT IN ('completed', 'failed')
    `;

    await this.pg.query(query, [
      input.artifactId,
      input.requestId,
      input.userId ?? null,
      input.projectId ?? null,
      input.artifactType,
      input.workflowType,
      input.model ?? 'unknown',
      JSON.stringify(input.inputJson ?? {}),
      input.contentBuffer,
      input.inputTokens ?? 0,
      input.outputTokens ?? 0,
      input.costUsd ?? 0,
      input.registryVersion ?? null,
      input.registrySnapshotRef ?? null,
    ]);
  }

  async finalizeSuccess(input: PersistenceBatchInput): Promise<void> {
    await withTransaction(this.pg, async (client) => {
      const query = `
        INSERT INTO ${this.artifactsTableName}
          (
            id,
            request_id,
            user_id,
            project_id,
            type,
            workflow_type,
            model,
            input_json,
            status,
            content,
            input_tokens,
            output_tokens,
            cost_usd,
            registry_version,
            registry_snapshot_ref,
            created_at,
            updated_at,
            completed_at
          )
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'completed', $9, $10, $11, $12, $13, $14, NOW(), NOW(), NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          status = 'completed',
          content = EXCLUDED.content,
          input_json = EXCLUDED.input_json,
          input_tokens = EXCLUDED.input_tokens,
          output_tokens = EXCLUDED.output_tokens,
          cost_usd = EXCLUDED.cost_usd,
          model = EXCLUDED.model,
          user_id = COALESCE(EXCLUDED.user_id, ${this.artifactsTableName}.user_id),
          project_id = COALESCE(EXCLUDED.project_id, ${this.artifactsTableName}.project_id),
          updated_at = NOW(),
          completed_at = NOW(),
          failure_reason = NULL,
          registry_version = EXCLUDED.registry_version,
          registry_snapshot_ref = EXCLUDED.registry_snapshot_ref
        WHERE ${this.artifactsTableName}.status <> 'failed'
      `;

      await client.query(query, [
        input.artifactId,
        input.requestId,
        input.userId ?? null,
        input.projectId ?? null,
        input.artifactType,
        input.workflowType,
        input.model ?? 'unknown',
        JSON.stringify(input.inputJson ?? {}),
        input.contentBuffer,
        input.inputTokens ?? 0,
        input.outputTokens ?? 0,
        input.costUsd ?? 0,
        input.registryVersion ?? null,
        input.registrySnapshotRef ?? null,
      ]);

      if (input.userId) {
        const quotaQuery = `
          INSERT INTO ${this.quotaHistoryTableName}
            (
              user_id,
              project_id,
              request_id,
              artifact_id,
              status,
              request_count,
              cost_usd,
              input_tokens,
              output_tokens,
              metadata_json,
              created_at
            )
          VALUES
            ($1, $2, $3, $4, 'success', 1, $5, $6, $7, $8::jsonb, NOW())
        `;

        await client.query(quotaQuery, [
          input.userId,
          input.projectId ?? null,
          input.requestId,
          input.artifactId,
          input.costUsd ?? 0,
          input.inputTokens ?? 0,
          input.outputTokens ?? 0,
          JSON.stringify({ workflowType: input.workflowType, model: input.model ?? 'unknown' }),
        ]);
      }
    });
  }

  async finalizeFailure(input: PersistenceBatchInput, reason: string): Promise<void> {
    await withTransaction(this.pg, async (client) => {
      const query = `
        INSERT INTO ${this.artifactsTableName}
          (
            id,
            request_id,
            user_id,
            project_id,
            type,
            workflow_type,
            model,
            input_json,
            status,
            content,
            input_tokens,
            output_tokens,
            cost_usd,
            failure_reason,
            registry_version,
            registry_snapshot_ref,
            created_at,
            updated_at
          )
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'failed', $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          status = 'failed',
          content = EXCLUDED.content,
          input_json = EXCLUDED.input_json,
          input_tokens = EXCLUDED.input_tokens,
          output_tokens = EXCLUDED.output_tokens,
          cost_usd = EXCLUDED.cost_usd,
          model = EXCLUDED.model,
          user_id = COALESCE(EXCLUDED.user_id, ${this.artifactsTableName}.user_id),
          project_id = COALESCE(EXCLUDED.project_id, ${this.artifactsTableName}.project_id),
          failure_reason = EXCLUDED.failure_reason,
          updated_at = NOW(),
          registry_version = EXCLUDED.registry_version,
          registry_snapshot_ref = EXCLUDED.registry_snapshot_ref
      `;

      await client.query(query, [
        input.artifactId,
        input.requestId,
        input.userId ?? null,
        input.projectId ?? null,
        input.artifactType,
        input.workflowType,
        input.model ?? 'unknown',
        JSON.stringify(input.inputJson ?? {}),
        input.contentBuffer,
        input.inputTokens ?? 0,
        input.outputTokens ?? 0,
        input.costUsd ?? 0,
        reason,
        input.registryVersion ?? null,
        input.registrySnapshotRef ?? null,
      ]);

      if (input.userId) {
        const status = reason === 'rate_limited' || reason === 'quota_exhausted' ? 'rate_limited' : 'error';
        const quotaQuery = `
          INSERT INTO ${this.quotaHistoryTableName}
            (
              user_id,
              project_id,
              request_id,
              artifact_id,
              status,
              request_count,
              cost_usd,
              input_tokens,
              output_tokens,
              metadata_json,
              created_at
            )
          VALUES
            ($1, $2, $3, $4, $5, 1, $6, $7, $8, $9::jsonb, NOW())
        `;

        await client.query(quotaQuery, [
          input.userId,
          input.projectId ?? null,
          input.requestId,
          input.artifactId,
          status,
          input.costUsd ?? 0,
          input.inputTokens ?? 0,
          input.outputTokens ?? 0,
          JSON.stringify({ workflowType: input.workflowType, model: input.model ?? 'unknown', reason }),
        ]);
      }
    });
  }
}

export const createPostgresRedisProductionDependencies = (
  clients: PostgresRedisProductionClients,
  options: PostgresRedisProductionOptions = {},
): PostgresRedisAdapterDependencies => {
  return {
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