import type Redis from 'ioredis';
import type { Pool } from 'pg';

import type { UsageActorInput } from '../types/xstate';

import { resolveClaimUsageDecision } from './postgres-redis.shared';
import type { UsageDecision } from './generation.adapters';
import type { RedisQuotaRepository } from './postgres-redis.interfaces';
import type { UsageRepositoryOptions } from './postgres-redis.shared.types';
import { buildQualifiedTableName, nowDate, withTransaction } from './postgres-redis.sql.utils';

const toMonthStartUtc = (value: Date): Date => {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1, 0, 0, 0, 0));
};

const hasMonthWindowExpired = (windowStartedAt: Date | null, now: Date): boolean => {
  if (!windowStartedAt) {
    return true;
  }

  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth();
  const windowYear = windowStartedAt.getUTCFullYear();
  const windowMonth = windowStartedAt.getUTCMonth();
  return windowYear !== nowYear || windowMonth !== nowMonth;
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
      return resolveClaimUsageDecision({
        rateLimitExceeded: true,
        quotaAvailable: false,
        hasConflict: false,
      });
    }

    try {
      const claimResult = await withTransaction(this.pg, async (client) => {
        const now = nowDate(input.runtime);
        const normalizedWindowStart = toMonthStartUtc(now);

        const lockedUserResult = await client.query<{
          monthly_used: number;
          monthly_quota: number;
          quota_window_started_at: Date | string | null;
        }>(
          `
            SELECT monthly_used, monthly_quota, quota_window_started_at
            FROM ${this.usersTableName}
            WHERE id = $1
            FOR UPDATE
          `,
          [input.userId],
        );

        if (lockedUserResult.rowCount !== 1) {
          return {
            quotaAvailable: false,
            resetDate: undefined as Date | undefined,
          };
        }

        const lockedUser = lockedUserResult.rows[0];
        if (!lockedUser) {
          return {
            quotaAvailable: false,
          };
        }

        const quotaWindowStartedAt = lockedUser.quota_window_started_at
          ? new Date(lockedUser.quota_window_started_at)
          : null;
        const shouldResetWindow = hasMonthWindowExpired(quotaWindowStartedAt, now);

        if (shouldResetWindow) {
          await client.query(
            `
              UPDATE ${this.usersTableName}
              SET monthly_used = 0,
                  quota_window_started_at = $2,
                  updated_at = NOW()
              WHERE id = $1
            `,
            [input.userId, normalizedWindowStart.toISOString()],
          );
        }

        const incrementResult = await client.query(
          `
            UPDATE ${this.usersTableName}
            SET monthly_used = monthly_used + 1,
                updated_at = NOW()
            WHERE id = $1 AND monthly_used < monthly_quota
            RETURNING monthly_used, monthly_quota
          `,
          [input.userId],
        );

        return {
          quotaAvailable: Boolean(incrementResult.rowCount && incrementResult.rowCount > 0),
          resetDate: shouldResetWindow ? normalizedWindowStart : undefined,
        };
      });

      return resolveClaimUsageDecision({
        rateLimitExceeded: false,
        quotaAvailable: claimResult.quotaAvailable,
        hasConflict: false,
        ...(claimResult.resetDate ? { resetDate: claimResult.resetDate } : {}),
      });
    } catch {
      return {
        granted: false,
        reason: 'usage_failed',
      };
    }
  }
}
