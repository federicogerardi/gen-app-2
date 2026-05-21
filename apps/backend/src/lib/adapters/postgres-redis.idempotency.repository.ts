import type Redis from 'ioredis';
import type { Pool, QueryResult } from 'pg';

import type { IdempotencyCoordinatorInput } from '../types/xstate';

import { buildIdempotencyRedisLockKey, DEFAULT_IDEMPOTENCY_REDIS_KEY_PREFIX } from './postgres-redis.shared';
import type { IdempotencyDecision } from './generation.adapters';
import type { RedisIdempotencyRepository } from './postgres-redis.interfaces';
import type {
  IdempotencyRepositoryOptions,
  IdempotencyRow,
} from './postgres-redis.shared.types';
import { buildQualifiedTableName, nowDate } from './postgres-redis.sql.utils';

const defaultEndpointResolver = (input: IdempotencyCoordinatorInput): string => {
  return input.workflowType ?? 'generation';
};

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
