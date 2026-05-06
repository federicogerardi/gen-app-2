import type { IdempotencyCoordinatorInput } from '../types/xstate';

export const DEFAULT_IDEMPOTENCY_REDIS_KEY_PREFIX = 'generation:idempotency';

export const buildIdempotencyRedisLockKey = (
  redisKeyPrefix: string,
  input: IdempotencyCoordinatorInput,
  endpoint: string,
): string => {
  return `${redisKeyPrefix}:lock:${input.userId}:${input.projectId}:${endpoint}:${input.idempotencyKey}`;
};