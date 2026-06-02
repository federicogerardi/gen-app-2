import type Redis from 'ioredis';
import { Kysely, sql } from 'kysely';
import type { Pool } from 'pg';

import type { IdempotencyCoordinatorInput } from '../types/xstate';

import { buildIdempotencyRedisLockKey, DEFAULT_IDEMPOTENCY_REDIS_KEY_PREFIX } from './postgres-redis.shared';
import type { IdempotencyDecision } from './generation.adapters';
import type { RedisIdempotencyRepository } from './postgres-redis.interfaces';
import type {
  IdempotencyRepositoryOptions,
  IdempotencyRow,
} from './postgres-redis.shared.types';
import { createKyselyDb } from './postgres-kysely.dialect';
import type { DB } from './postgres-kysely.types';

/**
 * Escape hatch: Kysely has no typed builder API for PostgreSQL server-side timestamp functions.
 * NOW() must be expressed via the sql template tag.
 */
const dbNow = sql<Date>`NOW()`;

const defaultEndpointResolver = (input: IdempotencyCoordinatorInput): string => {
  return input.workflowType ?? 'generation';
};

export class PostgresRedisIdempotencyRepository implements RedisIdempotencyRepository {
  private readonly db: Kysely<DB>;
  private readonly redisKeyPrefix: string;
  private readonly redisLockTtlSeconds: number;
  private readonly requestIdempotencySchema: string | undefined;
  private readonly endpointResolver: (input: IdempotencyCoordinatorInput) => string;

  constructor(
    pg: Pool,
    private readonly redis: Redis,
    options: IdempotencyRepositoryOptions = {},
  ) {
    this.db = createKyselyDb(pg);
    this.redisKeyPrefix = options.redisKeyPrefix ?? DEFAULT_IDEMPOTENCY_REDIS_KEY_PREFIX;
    this.redisLockTtlSeconds = options.redisLockTtlSeconds ?? 900;
    this.requestIdempotencySchema = options.requestIdempotencySchema;
    this.endpointResolver = options.endpointResolver ?? defaultEndpointResolver;
  }

  private getDb(): Kysely<DB> {
    return this.requestIdempotencySchema ? this.db.withSchema(this.requestIdempotencySchema) : this.db;
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
    const lockValue = `${input.requestId}:${new Date().toISOString()}`;
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

    try {
      const result = await this.getDb()
        .insertInto('request_idempotency')
        .values({
          user_id: input.userId,
          project_id: input.projectId,
          endpoint,
          idempotency_key: input.idempotencyKey,
          status: 'in_progress',
          artifact_id: null,
          content: '',
          created_at: dbNow,
          updated_at: dbNow,
        })
        .onConflict((oc) => oc
          .columns(['user_id', 'project_id', 'endpoint', 'idempotency_key'])
          .doNothing())
        .execute();

      // Kysely execute() without returning always returns [InsertResult] regardless of DO NOTHING.
      // Check numInsertedOrUpdatedRows to distinguish an actual insert from a conflict skip.
      if ((result[0]?.numInsertedOrUpdatedRows ?? 0n) > 0n) {
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
    await this.getDb()
      .updateTable('request_idempotency')
      .set({
        status: 'completed',
        artifact_id: artifactId,
        content,
        updated_at: dbNow,
      })
      .where('user_id', '=', input.userId)
      .where('project_id', '=', input.projectId)
      .where('endpoint', '=', endpoint)
      .where('idempotency_key', '=', input.idempotencyKey)
      .execute();
    await this.redis.del(this.getLockKey(input, endpoint));
  }

  async markFailed(input: IdempotencyCoordinatorInput): Promise<void> {
    const endpoint = this.endpointResolver(input);
    await this.getDb()
      .updateTable('request_idempotency')
      .set({
        status: 'failed',
        updated_at: dbNow,
      })
      .where('user_id', '=', input.userId)
      .where('project_id', '=', input.projectId)
      .where('endpoint', '=', endpoint)
      .where('idempotency_key', '=', input.idempotencyKey)
      .execute();
    await this.redis.del(this.getLockKey(input, endpoint));
  }

  private async fetchRecord(
    input: IdempotencyCoordinatorInput,
    endpoint: string,
  ): Promise<IdempotencyRow | null> {
    const row = await this.getDb()
      .selectFrom('request_idempotency')
      .select(['status', 'artifact_id', 'content'])
      .where('user_id', '=', input.userId)
      .where('project_id', '=', input.projectId)
      .where('endpoint', '=', endpoint)
      .where('idempotency_key', '=', input.idempotencyKey)
      .limit(1)
      .executeTakeFirst() as unknown as IdempotencyRow | undefined;

    return row ?? null;
  }

  private getLockKey(input: IdempotencyCoordinatorInput, endpoint: string): string {
    return buildIdempotencyRedisLockKey(this.redisKeyPrefix, input, endpoint);
  }
}
