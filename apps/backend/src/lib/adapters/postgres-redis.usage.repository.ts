import type Redis from 'ioredis';
import { Kysely, sql } from 'kysely';
import type { Pool } from 'pg';

import type { UsageActorInput } from '../types/xstate';

import { resolveClaimUsageDecision } from './postgres-redis.shared';
import type { ConsumeCreditsInput, RecordArtifactSuccessInput, UsageDecision } from './generation.adapters';
import type { RedisQuotaRepository } from './postgres-redis.interfaces';
import type { UsageRepositoryOptions } from './postgres-redis.shared.types';
import { createKyselyDb } from './postgres-kysely.dialect';
import type { DB } from './postgres-kysely.types';

/**
 * Escape hatch: Kysely has no typed builder API for PostgreSQL server-side timestamp functions.
 * NOW() must be expressed via the sql template tag.
 */
const dbNow = sql<Date>`NOW()`;

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

const nowDate = (runtime?: { now?: () => Date }): Date =>
  runtime?.now?.() ?? new Date();

export class PostgresRedisUsageRepository implements RedisQuotaRepository {
  private readonly db: Kysely<DB>;
  private readonly rateLimitWindowSeconds: number;
  private readonly maxRequestsPerWindow: number;
  private readonly redisKeyPrefix: string;
  private readonly usersSchema: string | undefined;

  constructor(
    pg: Pool,
    private readonly redis: Redis,
    options: UsageRepositoryOptions = {},
  ) {
    this.db = createKyselyDb(pg);
    this.rateLimitWindowSeconds = options.rateLimitWindowSeconds ?? 60;
    this.maxRequestsPerWindow = options.maxRequestsPerWindow ?? 120;
    this.redisKeyPrefix = options.redisKeyPrefix ?? 'generation:usage';
    this.usersSchema = options.usersSchema;
    if (options.usersTableName !== undefined && options.usersTableName !== 'users') {
      throw new Error(`Unsupported usersTableName: ${options.usersTableName}`);
    }
  }

  private getUsersDb(trx?: Kysely<DB>): Kysely<DB> {
    const base = trx ?? this.db;
    return this.usersSchema ? base.withSchema(this.usersSchema) : base;
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
      const claimResult = await this.db.transaction().execute(async (trx) => {
        const db = this.getUsersDb(trx);
        const now = nowDate(input.runtime);
        const normalizedWindowStart = toMonthStartUtc(now);

        const lockedUser = await db
          .selectFrom('users')
          .select(['monthly_credits_used', 'monthly_quota', 'monthly_artifact_limit', 'monthly_artifacts_used', 'quota_window_started_at'])
          .where('id', '=', input.userId)
          .forUpdate()
          .executeTakeFirst();

        if (!lockedUser) {
          return {
            quotaAvailable: false,
            resetDate: undefined as Date | undefined,
          };
        }

        const quotaWindowStartedAt = lockedUser.quota_window_started_at
          ? new Date(lockedUser.quota_window_started_at)
          : null;
        const shouldResetWindow = hasMonthWindowExpired(quotaWindowStartedAt, now);

        if (shouldResetWindow) {
          await db
            .updateTable('users')
            .set({
              monthly_credits_used: 0,
              monthly_artifacts_used: 0,
              quota_window_started_at: normalizedWindowStart,
              updated_at: dbNow,
            })
            .where('id', '=', input.userId)
            .execute();
        }

        // Check artifact gate (DDD-140)
        const currentArtifactUsed = shouldResetWindow ? 0 : lockedUser.monthly_artifacts_used;
        if (currentArtifactUsed >= lockedUser.monthly_artifact_limit) {
          return {
            quotaAvailable: false,
            resetDate: shouldResetWindow ? normalizedWindowStart : undefined,
          };
        }

        // Check credit availability (DDD-137, DDD-143)
        const currentCreditsUsed = shouldResetWindow ? 0 : lockedUser.monthly_credits_used;
        if (currentCreditsUsed >= lockedUser.monthly_quota) {
          return {
            quotaAvailable: false,
            resetDate: shouldResetWindow ? normalizedWindowStart : undefined,
          };
        }

        return {
          quotaAvailable: true,
          resetDate: shouldResetWindow ? normalizedWindowStart : undefined,
        };
      });

      return resolveClaimUsageDecision({
        rateLimitExceeded: false,
        quotaAvailable: claimResult.quotaAvailable,
        hasConflict: false,
        ...(input.creditCost !== undefined ? { creditCost: input.creditCost } : {}),
        ...(claimResult.resetDate ? { resetDate: claimResult.resetDate } : {}),
      });
    } catch {
      return {
        granted: false,
        reason: 'usage_failed',
      };
    }
  }

  async consumeCredits(input: ConsumeCreditsInput): Promise<void> {
    const now = input.runtime?.now?.() ?? new Date();
    const normalizedWindowStart = toMonthStartUtc(now);

    await this.db.transaction().execute(async (trx) => {
      const trxDb = this.getUsersDb(trx);

      // Reset window if expired
      const lockedUser = await trxDb
        .selectFrom('users')
        .select(['monthly_credits_used', 'quota_window_started_at'])
        .where('id', '=', input.userId)
        .forUpdate()
        .executeTakeFirst();

      if (!lockedUser) {
        return;
      }

      const quotaWindowStartedAt = lockedUser.quota_window_started_at
        ? new Date(lockedUser.quota_window_started_at)
        : null;
      const shouldResetWindow = hasMonthWindowExpired(quotaWindowStartedAt, now);

      if (shouldResetWindow) {
        await trxDb
          .updateTable('users')
          .set({
            monthly_credits_used: 0,
            monthly_artifacts_used: 0,
            quota_window_started_at: normalizedWindowStart,
            updated_at: dbNow,
          })
          .where('id', '=', input.userId)
          .execute();
      }

      // Increment credits used
      await trxDb
        .updateTable('users')
        .set({
          monthly_credits_used: sql`monthly_credits_used + ${input.creditCost}`,
          updated_at: dbNow,
        })
        .where('id', '=', input.userId)
        .execute();

      // Write quota history
      const quotaDb = trxDb;
      await quotaDb
        .insertInto('quota_history')
        .values({
          user_id: input.userId,
          project_id: input.projectId ?? null,
          request_id: input.requestId ?? null,
          session_id: input.sessionId ?? null,
          status: 'success',
          cost_type: 'session_summary',
          credit_cost: input.creditCost,
          request_count: 1,
          cost_usd: 0,
          input_tokens: 0,
          output_tokens: 0,
          metadata_json: {
            workflowType: input.workflowType ?? null,
            model: input.model ?? null,
          },
          created_at: dbNow,
        })
        .execute();
    });
  }

  async recordArtifactSuccess(input: RecordArtifactSuccessInput): Promise<void> {
    const now = input.runtime?.now?.() ?? new Date();
    const normalizedWindowStart = toMonthStartUtc(now);

    await this.db.transaction().execute(async (trx) => {
      const trxDb = this.getUsersDb(trx);

      // Reset window if expired
      const lockedUser = await trxDb
        .selectFrom('users')
        .select(['monthly_artifacts_used', 'monthly_artifact_limit', 'quota_window_started_at'])
        .where('id', '=', input.userId)
        .forUpdate()
        .executeTakeFirst();

      if (!lockedUser) {
        return;
      }

      const quotaWindowStartedAt = lockedUser.quota_window_started_at
        ? new Date(lockedUser.quota_window_started_at)
        : null;
      const shouldResetWindow = hasMonthWindowExpired(quotaWindowStartedAt, now);

      if (shouldResetWindow) {
        await trxDb
          .updateTable('users')
          .set({
            monthly_credits_used: 0,
            monthly_artifacts_used: 0,
            quota_window_started_at: normalizedWindowStart,
            updated_at: dbNow,
          })
          .where('id', '=', input.userId)
          .execute();
      }

      // Check artifact gate before incrementing
      const currentUsed = shouldResetWindow ? 0 : lockedUser.monthly_artifacts_used;
      if (currentUsed >= lockedUser.monthly_artifact_limit) {
        throw new Error('artifact_gate_exceeded');
      }

      // Increment artifacts used
      await trxDb
        .updateTable('users')
        .set({
          monthly_artifacts_used: sql`monthly_artifacts_used + 1`,
          updated_at: dbNow,
        })
        .where('id', '=', input.userId)
        .execute();

      // Write quota history
      await trxDb
        .insertInto('quota_history')
        .values({
          user_id: input.userId,
          project_id: input.projectId ?? null,
          request_id: input.requestId ?? null,
          artifact_id: input.artifactId ?? null,
          session_id: input.sessionId ?? null,
          status: 'success',
          cost_type: 'artifact',
          credit_cost: 0,
          request_count: 1,
          cost_usd: 0,
          input_tokens: 0,
          output_tokens: 0,
          metadata_json: {},
          created_at: dbNow,
        })
        .execute();
    });
  }
}
