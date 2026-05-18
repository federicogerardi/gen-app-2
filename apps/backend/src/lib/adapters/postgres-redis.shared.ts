import type { IdempotencyCoordinatorInput } from '../types/xstate';

export const DEFAULT_IDEMPOTENCY_REDIS_KEY_PREFIX = 'generation:idempotency';

export const buildIdempotencyRedisLockKey = (
  redisKeyPrefix: string,
  input: IdempotencyCoordinatorInput,
  endpoint: string,
): string => {
  return `${redisKeyPrefix}:lock:${input.userId}:${input.projectId}:${endpoint}:${input.idempotencyKey}`;
};

type ResolveClaimUsageDecisionInput = {
  rateLimitExceeded: boolean;
  quotaAvailable: boolean;
  hasConflict: boolean;
  resetDate?: Date;
};

export const resolveClaimUsageDecision = (
  input: ResolveClaimUsageDecisionInput,
): { granted: boolean; reason?: string; resetDate?: Date } => {
  if (input.rateLimitExceeded) {
    return { granted: false, reason: 'rate_limited' };
  }

  if (input.hasConflict) {
    return { granted: false, reason: 'usage_conflict' };
  }

  if (!input.quotaAvailable) {
    return input.resetDate
      ? { granted: false, reason: 'quota_exhausted', resetDate: input.resetDate }
      : { granted: false, reason: 'quota_exhausted' };
  }

  return input.resetDate
    ? { granted: true, resetDate: input.resetDate }
    : { granted: true };
};