import type Redis from 'ioredis';

import type { StreamTransportInput } from '../types/xstate';

import type { ProductionAdapterRuntime, RedisStreamSessionRepository } from './postgres-redis.interfaces';
import type { StreamRepositoryOptions } from './postgres-redis.shared.types';
import { nowDate, randomId } from './postgres-redis.sql.utils';

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
