import type Redis from 'ioredis';
import type { OrchestrateArtifactCache } from './postgres-redis.interfaces';

const DEFAULT_PREFIX = 'orchestrate:artifacts';
const DEFAULT_TTL_SECONDS = 14_400;

export class RedisOrchestrateArtifactCache implements OrchestrateArtifactCache {
  private readonly prefix: string;
  private readonly ttlSeconds: number;

  constructor(
    private readonly redis: Redis,
    options: { prefix?: string; ttlSeconds?: number } = {},
  ) {
    this.prefix = options.prefix ?? DEFAULT_PREFIX;
    this.ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  }

  private buildKey(userId: string, projectId: string, workflowType: string): string {
    return `${this.prefix}:${userId}:${projectId}:${workflowType}`;
  }

  async setStepArtifact(
    userId: string,
    projectId: string,
    workflowType: string,
    stepKey: string,
    artifactId: string,
  ): Promise<void> {
    const key = this.buildKey(userId, projectId, workflowType);
    const pipeline = this.redis.pipeline();
    pipeline.hset(key, stepKey, artifactId);
    pipeline.expire(key, this.ttlSeconds);
    await pipeline.exec();
  }

  async getCompletedArtifactsByStep(
    userId: string,
    projectId: string,
    workflowType: string,
  ): Promise<Record<string, string>> {
    const key = this.buildKey(userId, projectId, workflowType);
    const result = await this.redis.hgetall(key);
    return result ?? {};
  }
}
