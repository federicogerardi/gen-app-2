import type Redis from 'ioredis';
import type { Pool, PoolClient, QueryResult } from 'pg';
import { randomUUID } from 'node:crypto';

import {
  mapArtifactRowToDetail,
  mapArtifactRowToSummary,
  type ArtifactDetail,
  type ArtifactListFilters,
  type ArtifactReadProjection,
  type SessionListCursor,
  type SessionListPage,
  type SessionListEntry,
  type ArtifactSummary,
} from '../types/artifacts';
import {
  mapProjectRowToDetail,
  mapProjectRowToSummary,
  type CreateProjectInput,
  type ProjectDetail,
  type ProjectSummary,
} from '../types/projects';

import type {
  IdempotencyCoordinatorInput,
  PersistenceBatchInput,
  StreamTransportInput,
  UsageActorInput,
} from '../types/xstate';

import { createPostgresRedisGenerationAdapters } from './postgres-redis.adapters';
import {
  createSyntheticLlmStreamAdapter,
  type LlmStreamAdapter,
} from './generation.adapters';
import { createOpenRouterLlmStreamAdapterFromEnv } from './openrouter.adapter';
import {
  buildIdempotencyRedisLockKey,
  DEFAULT_IDEMPOTENCY_REDIS_KEY_PREFIX,
  resolveClaimUsageDecision,
} from './postgres-redis.shared';
import type {
  IdempotencyDecision,
  UsageDecision,
} from './generation.adapters';
import type {
  ArtifactQueryRepository,
  PostgresArtifactRepository as PostgresArtifactRepositoryPort,
  PostgresRedisAdapterDependencies,
  ProjectOwnershipRepository,
  ProjectQueryRepository,
  ProductionAdapterRuntime,
  RedisIdempotencyRepository,
  RedisQuotaRepository,
  RedisStreamSessionRepository,
} from './postgres-redis.interfaces';
import {
  normalizeStepKey,
  normalizeToolWorkflowKey,
  resolveToolStepArtifactRole,
} from '../runtime/workflow-normalizers';

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
  usersTableName?: string;
  usersSchema?: string;
  quotaHistoryTableName?: string;
  quotaHistorySchema?: string;
  projectsTableName?: string;
  projectsSchema?: string;
};

type ProjectRow = {
  id: string;
  user_id: string;
  name: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type ArtifactRow = {
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

const normalizeToolWorkflowInputJson = (
  inputJson: Record<string, unknown> | undefined,
  workflowType: string | null,
): Record<string, unknown> => {
  const base = inputJson ?? {};
  const normalizedWorkflowType = normalizeToolWorkflowKey(workflowType);
  if (
    normalizedWorkflowType !== 'funnel-pages'
    && normalizedWorkflowType !== 'nextland'
    && normalizedWorkflowType !== 'youtube-lf-script'
  ) {
    return base;
  }

  const inputStep = normalizeStepKey(base.step);
  const toolWorkflow =
    base.toolWorkflow && typeof base.toolWorkflow === 'object' && !Array.isArray(base.toolWorkflow)
      ? { ...(base.toolWorkflow as Record<string, unknown>) }
      : {};

  const dependencyArtifactIds = Array.isArray(base.stepDependencyArtifactIds)
    ? base.stepDependencyArtifactIds.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];

  const currentStep = normalizeStepKey(toolWorkflow.stepKey) ?? inputStep ?? null;
  const artifactRole = resolveToolStepArtifactRole(
    normalizedWorkflowType,
    currentStep,
    toolWorkflow.artifactRole,
  ) ?? 'step';

  return {
    ...base,
    toolWorkflow: {
      ...toolWorkflow,
      workflowType: toolWorkflow.workflowType ?? normalizedWorkflowType,
      stepKey: currentStep,
      artifactRole,
      dependencyArtifactIds,
    },
  };
};

const extractToolWorkflowColumns = (
  normalizedInputJson: Record<string, unknown>,
  sessionId: string | undefined,
): {
  sessionId: string | null;
  stepKey: string | null;
  artifactRole: 'step' | 'final' | null;
  runMode: 'new' | 'resume' | 'regenerate' | null;
} => {
  const toolWorkflow =
    normalizedInputJson.toolWorkflow
    && typeof normalizedInputJson.toolWorkflow === 'object'
    && !Array.isArray(normalizedInputJson.toolWorkflow)
      ? (normalizedInputJson.toolWorkflow as Record<string, unknown>)
      : {};

  const stepKey = typeof toolWorkflow.stepKey === 'string' && toolWorkflow.stepKey.trim().length > 0
    ? toolWorkflow.stepKey.trim()
    : null;

  const artifactRole = toolWorkflow.artifactRole === 'step' || toolWorkflow.artifactRole === 'final'
    ? toolWorkflow.artifactRole
    : null;

  const runMode = toolWorkflow.runMode === 'new' || toolWorkflow.runMode === 'resume' || toolWorkflow.runMode === 'regenerate'
    ? toolWorkflow.runMode
    : null;

  const workflowSessionId = typeof toolWorkflow.sessionId === 'string' && toolWorkflow.sessionId.trim().length > 0
    ? toolWorkflow.sessionId.trim()
    : null;

  const explicitSessionId = typeof sessionId === 'string' && sessionId.trim().length > 0
    ? sessionId.trim()
    : null;

  return {
    sessionId: explicitSessionId ?? workflowSessionId,
    stepKey,
    artifactRole,
    runMode,
  };
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
  llm?: {
    adapter?: LlmStreamAdapter;
  };
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
      return resolveClaimUsageDecision({
        rateLimitExceeded: false,
        quotaAvailable: false,
        hasConflict: true,
      });
    }
  }
}

export class PostgresProjectOwnershipRepository implements ProjectOwnershipRepository {
  private readonly projectsTableName: string;

  constructor(
    private readonly pg: Pool,
    options: PersistenceRepositoryOptions = {},
  ) {
    this.projectsTableName = buildQualifiedTableName(
      options.projectsSchema,
      options.projectsTableName ?? 'projects',
    );
  }

  async checkProjectOwnership(input: { userId: string; projectId: string }) {
    const query = `
      SELECT user_id
      FROM ${this.projectsTableName}
      WHERE id = $1
      LIMIT 1
    `;

    const result = await this.pg.query<{ user_id: string }>(query, [input.projectId]);
    const row = result.rows[0];
    if (!row) {
      return { owned: false, reason: 'project_not_found' };
    }

    if (row.user_id !== input.userId) {
      return { owned: false, reason: 'ownership_forbidden' };
    }

    return { owned: true };
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
    const normalizedInputJson = normalizeToolWorkflowInputJson(input.inputJson, input.workflowType);
    const toolWorkflowColumns = extractToolWorkflowColumns(normalizedInputJson, input.sessionId);

    const query = `
      INSERT INTO ${this.artifactsTableName}
        (
          id,
          request_id,
          user_id,
          project_id,
          type,
          workflow_type,
          session_id,
          step_key,
          artifact_role,
          run_mode,
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
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, 'generating', $13, $14, $15, $16, $17, $18, NOW(), NOW(), NOW())
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
        session_id = COALESCE(EXCLUDED.session_id, ${this.artifactsTableName}.session_id),
        step_key = COALESCE(EXCLUDED.step_key, ${this.artifactsTableName}.step_key),
        artifact_role = COALESCE(EXCLUDED.artifact_role, ${this.artifactsTableName}.artifact_role),
        run_mode = COALESCE(EXCLUDED.run_mode, ${this.artifactsTableName}.run_mode),
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
      toolWorkflowColumns.sessionId,
      toolWorkflowColumns.stepKey,
      toolWorkflowColumns.artifactRole,
      toolWorkflowColumns.runMode,
      input.model ?? 'unknown',
      JSON.stringify(normalizedInputJson),
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
      const normalizedInputJson = normalizeToolWorkflowInputJson(input.inputJson, input.workflowType);
      const toolWorkflowColumns = extractToolWorkflowColumns(normalizedInputJson, input.sessionId);

      const query = `
        INSERT INTO ${this.artifactsTableName}
          (
            id,
            request_id,
            user_id,
            project_id,
            type,
            workflow_type,
            session_id,
            step_key,
            artifact_role,
            run_mode,
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
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, 'completed', $13, $14, $15, $16, $17, $18, NOW(), NOW(), NOW())
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
          session_id = COALESCE(EXCLUDED.session_id, ${this.artifactsTableName}.session_id),
          step_key = COALESCE(EXCLUDED.step_key, ${this.artifactsTableName}.step_key),
          artifact_role = COALESCE(EXCLUDED.artifact_role, ${this.artifactsTableName}.artifact_role),
          run_mode = COALESCE(EXCLUDED.run_mode, ${this.artifactsTableName}.run_mode),
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
        toolWorkflowColumns.sessionId,
        toolWorkflowColumns.stepKey,
        toolWorkflowColumns.artifactRole,
        toolWorkflowColumns.runMode,
        input.model ?? 'unknown',
        JSON.stringify(normalizedInputJson),
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
      const normalizedInputJson = normalizeToolWorkflowInputJson(input.inputJson, input.workflowType);
      const toolWorkflowColumns = extractToolWorkflowColumns(normalizedInputJson, input.sessionId);

      const query = `
        INSERT INTO ${this.artifactsTableName}
          (
            id,
            request_id,
            user_id,
            project_id,
            type,
            workflow_type,
            session_id,
            step_key,
            artifact_role,
            run_mode,
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
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, 'failed', $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())
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
          session_id = COALESCE(EXCLUDED.session_id, ${this.artifactsTableName}.session_id),
          step_key = COALESCE(EXCLUDED.step_key, ${this.artifactsTableName}.step_key),
          artifact_role = COALESCE(EXCLUDED.artifact_role, ${this.artifactsTableName}.artifact_role),
          run_mode = COALESCE(EXCLUDED.run_mode, ${this.artifactsTableName}.run_mode),
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
        toolWorkflowColumns.sessionId,
        toolWorkflowColumns.stepKey,
        toolWorkflowColumns.artifactRole,
        toolWorkflowColumns.runMode,
        input.model ?? 'unknown',
        JSON.stringify(normalizedInputJson),
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

export class PostgresProjectQueryRepository implements ProjectQueryRepository {
  private readonly projectsTableName: string;

  constructor(
    private readonly pg: Pool,
    options: PersistenceRepositoryOptions = {},
  ) {
    this.projectsTableName = buildQualifiedTableName(
      options.projectsSchema,
      options.projectsTableName ?? 'projects',
    );
  }

  async listProjectsByUser(userId: string): Promise<ProjectSummary[]> {
    const query = `
      SELECT id, user_id, name, created_at, updated_at
      FROM ${this.projectsTableName}
      WHERE user_id = $1
      ORDER BY updated_at DESC, id DESC
    `;

    const result: QueryResult<ProjectRow> = await this.pg.query(query, [userId]);
    return result.rows.map(mapProjectRowToSummary);
  }

  async getProjectByIdForUser(userId: string, projectId: string): Promise<ProjectDetail | null> {
    const query = `
      SELECT id, user_id, name, created_at, updated_at
      FROM ${this.projectsTableName}
      WHERE user_id = $1 AND id = $2
      LIMIT 1
    `;

    const result: QueryResult<ProjectRow> = await this.pg.query(query, [userId, projectId]);
    const row = result.rows[0];
    return row ? mapProjectRowToDetail(row) : null;
  }

  async createProjectForUser(userId: string, input: CreateProjectInput): Promise<ProjectDetail> {
    const query = `
      INSERT INTO ${this.projectsTableName}
        (id, user_id, name, created_at, updated_at)
      VALUES
        ($1, $2, $3, NOW(), NOW())
      RETURNING id, user_id, name, created_at, updated_at
    `;

    const projectId = `proj_${randomUUID()}`;
    const result: QueryResult<ProjectRow> = await this.pg.query(query, [
      projectId,
      userId,
      input.name,
    ]);
    const row = result.rows[0];
    if (!row) {
      throw new Error('Failed to create project row');
    }

    return mapProjectRowToDetail(row);
  }
}

export class PostgresArtifactQueryRepository implements ArtifactQueryRepository {
  private readonly artifactsTableName: string;
  private readonly usersTableName: string;

  constructor(
    private readonly pg: Pool,
    options: PersistenceRepositoryOptions = {},
  ) {
    this.artifactsTableName = buildQualifiedTableName(
      options.artifactsSchema,
      options.artifactsTableName ?? 'artifacts',
    );
    this.usersTableName = buildQualifiedTableName(
      options.usersSchema,
      options.usersTableName ?? 'users',
    );
  }

  private buildProjectedDetailSelect(projection: ArtifactReadProjection): string {
    const includeInput = projection.includeInput === true;
    const includeContent = projection.includeContent === true;

    return [
      'id',
      'request_id',
      'user_id',
      'project_id',
      'type',
      'status',
      'model',
      'workflow_type',
      'session_id',
      'step_key',
      'artifact_role',
      'run_mode',
      includeInput ? 'input_json' : 'NULL::jsonb AS input_json',
      includeContent ? 'content' : "''::text AS content",
      'failure_reason',
      'created_at',
      'updated_at',
    ].join(',\n        ');
  }

  async listArtifacts(filters: ArtifactListFilters): Promise<ArtifactSummary[]> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.type) {
      params.push(filters.type);
      where.push(`a.type = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      where.push(`a.status = $${params.length}`);
    }

    if (filters.projectId) {
      params.push(filters.projectId);
      where.push(`a.project_id = $${params.length}`);
    }

    if (filters.from) {
      params.push(filters.from);
      where.push(`a.updated_at >= $${params.length}::timestamptz`);
    }

    if (filters.to) {
      params.push(filters.to);
      where.push(`a.updated_at <= $${params.length}::timestamptz`);
    }

    const whereClause = where.length > 0 ? where.join(' AND ') : 'TRUE';

    let paginationClause = '';
    if (typeof filters.limit === 'number') {
      params.push(filters.limit);
      paginationClause += `\n      LIMIT $${params.length}`;
    }

    if (typeof filters.offset === 'number') {
      params.push(filters.offset);
      paginationClause += `\n      OFFSET $${params.length}`;
    }

    const query = `
      SELECT
        a.id,
        a.request_id,
        a.user_id,
        u.email AS user_email,
        a.project_id,
        a.type,
        a.status,
        a.model,
        a.workflow_type,
        a.session_id,
        a.step_key,
        a.artifact_role,
        a.run_mode,
        a.created_at,
        a.updated_at
      FROM ${this.artifactsTableName} a
      LEFT JOIN ${this.usersTableName} u ON u.id = a.user_id
      WHERE ${whereClause}
      ORDER BY a.updated_at DESC, a.id DESC
      ${paginationClause}
    `;

    const result: QueryResult<ArtifactRow> = await this.pg.query(query, params);
    return result.rows.map((row): ArtifactSummary => mapArtifactRowToSummary(row));
  }

  async listArtifactsByUser(userId: string, filters: ArtifactListFilters): Promise<ArtifactSummary[]> {
    const where: string[] = ['a.user_id = $1'];
    const params: unknown[] = [userId];

    if (filters.type) {
      params.push(filters.type);
      where.push(`a.type = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      where.push(`a.status = $${params.length}`);
    }

    if (filters.projectId) {
      params.push(filters.projectId);
      where.push(`a.project_id = $${params.length}`);
    }

    if (filters.from) {
      params.push(filters.from);
      where.push(`a.updated_at >= $${params.length}::timestamptz`);
    }

    if (filters.to) {
      params.push(filters.to);
      where.push(`a.updated_at <= $${params.length}::timestamptz`);
    }

    let paginationClause = '';
    if (typeof filters.limit === 'number') {
      params.push(filters.limit);
      paginationClause += `\n      LIMIT $${params.length}`;
    }

    if (typeof filters.offset === 'number') {
      params.push(filters.offset);
      paginationClause += `\n      OFFSET $${params.length}`;
    }

    const query = `
      SELECT
        a.id,
        a.request_id,
        a.user_id,
        u.email AS user_email,
        a.project_id,
        a.type,
        a.status,
        a.model,
        a.workflow_type,
        a.session_id,
        a.step_key,
        a.artifact_role,
        a.run_mode,
        a.created_at,
        a.updated_at
      FROM ${this.artifactsTableName} a
      LEFT JOIN ${this.usersTableName} u ON u.id = a.user_id
      WHERE ${where.join(' AND ')}
      ORDER BY a.updated_at DESC, a.id DESC
      ${paginationClause}
    `;

    const result: QueryResult<ArtifactRow> = await this.pg.query(query, params);
    return result.rows.map((row): ArtifactSummary => mapArtifactRowToSummary(row));
  }

  async listRecentCompletedArtifactsForToolByUser(
    userId: string,
    input: { projectId: string; workflowType: string; limit: number },
  ): Promise<ArtifactSummary[]> {
    const limit = Number.isFinite(input.limit) && input.limit > 0
      ? Math.trunc(input.limit)
      : 0;

    if (limit <= 0) {
      return [];
    }

    const query = `
      SELECT
        a.id,
        a.request_id,
        a.user_id,
        u.email AS user_email,
        a.project_id,
        a.type,
        a.status,
        a.model,
        a.workflow_type,
        a.session_id,
        a.step_key,
        a.artifact_role,
        a.run_mode,
        a.created_at,
        a.updated_at
      FROM ${this.artifactsTableName} a
      LEFT JOIN ${this.usersTableName} u ON u.id = a.user_id
      WHERE a.user_id = $1
        AND a.project_id = $2
        AND a.status = 'completed'
        AND a.workflow_type = $3
      ORDER BY a.updated_at DESC, a.id DESC
      LIMIT $4
    `;

    const result: QueryResult<ArtifactRow> = await this.pg.query(query, [
      userId,
      input.projectId,
      input.workflowType,
      limit,
    ]);
    return result.rows.map((row): ArtifactSummary => mapArtifactRowToSummary(row));
  }

  async countArtifacts(filters: ArtifactListFilters): Promise<number> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.type) {
      params.push(filters.type);
      where.push(`type = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      where.push(`status = $${params.length}`);
    }

    if (filters.projectId) {
      params.push(filters.projectId);
      where.push(`project_id = $${params.length}`);
    }

    if (filters.from) {
      params.push(filters.from);
      where.push(`updated_at >= $${params.length}::timestamptz`);
    }

    if (filters.to) {
      params.push(filters.to);
      where.push(`updated_at <= $${params.length}::timestamptz`);
    }

    const whereClause = where.length > 0 ? where.join(' AND ') : 'TRUE';

    const query = `
      SELECT COUNT(*) as total
      FROM ${this.artifactsTableName}
      WHERE ${whereClause}
    `;

    const result: QueryResult<{ total: string }> = await this.pg.query(query, params);
    return parseInt(result.rows[0]?.total ?? '0', 10);
  }

  async countArtifactsByUser(userId: string, filters: ArtifactListFilters): Promise<number> {
    const where: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];

    if (filters.type) {
      params.push(filters.type);
      where.push(`type = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      where.push(`status = $${params.length}`);
    }

    if (filters.projectId) {
      params.push(filters.projectId);
      where.push(`project_id = $${params.length}`);
    }

    if (filters.from) {
      params.push(filters.from);
      where.push(`updated_at >= $${params.length}::timestamptz`);
    }

    if (filters.to) {
      params.push(filters.to);
      where.push(`updated_at <= $${params.length}::timestamptz`);
    }

    const query = `
      SELECT COUNT(*) as total
      FROM ${this.artifactsTableName}
      WHERE ${where.join(' AND ')}
    `;

    const result: QueryResult<{ total: string }> = await this.pg.query(query, params);
    return parseInt(result.rows[0]?.total ?? '0', 10);
  }

  async getArtifactByIdForUser(
    userId: string,
    artifactId: string,
    projection: ArtifactReadProjection = {},
  ): Promise<ArtifactDetail | null> {
    const select = this.buildProjectedDetailSelect(projection);
    const query = `
      SELECT
        ${select}
      FROM ${this.artifactsTableName}
      WHERE user_id = $1 AND id = $2
      LIMIT 1
    `;

    const result: QueryResult<ArtifactRow> = await this.pg.query(query, [userId, artifactId]);
    const row = result.rows[0];
    return row ? mapArtifactRowToDetail(row) : null;
  }

  async getArtifactsByIdsForUser(
    userId: string,
    artifactIds: string[],
    projection: ArtifactReadProjection = {},
  ): Promise<ArtifactDetail[]> {
    if (artifactIds.length === 0) {
      return [];
    }

    const select = this.buildProjectedDetailSelect(projection);
    const query = `
      SELECT
        ${select}
      FROM ${this.artifactsTableName}
      WHERE user_id = $1
        AND id = ANY($2::text[])
    `;

    const result: QueryResult<ArtifactRow> = await this.pg.query(query, [userId, artifactIds]);
    return result.rows.map((row) => mapArtifactRowToDetail(row));
  }

  async getArtifactById(
    artifactId: string,
    projection: ArtifactReadProjection = {},
  ): Promise<ArtifactDetail | null> {
    const select = this.buildProjectedDetailSelect(projection);
    const query = `
      SELECT
        ${select}
      FROM ${this.artifactsTableName}
      WHERE id = $1
      LIMIT 1
    `;

    const result: QueryResult<ArtifactRow> = await this.pg.query(query, [artifactId]);
    const row = result.rows[0];
    return row ? mapArtifactRowToDetail(row) : null;
  }

  async listArtifactDetailsBySession(
    userId: string,
    sessionId: string,
    projection: ArtifactReadProjection = {},
  ): Promise<ArtifactDetail[]> {
    const select = this.buildProjectedDetailSelect(projection);
    const query = `
      SELECT
        ${select}
      FROM ${this.artifactsTableName}
      WHERE user_id = $1 AND session_id = $2
      ORDER BY updated_at ASC, id ASC
    `;

    const result: QueryResult<ArtifactRow> = await this.pg.query(query, [userId, sessionId]);
    return result.rows.map((row) => mapArtifactRowToDetail(row));
  }

  async listSessionSummaries(
    userId: string,
    projectId: string | null,
    options: { limit?: number; cursor?: SessionListCursor | null } = {},
  ): Promise<SessionListPage> {
    const where: string[] = [
      'user_id = $1',
      "session_id IS NOT NULL",
      "session_id <> ''",
    ];
    const params: unknown[] = [userId];

    if (projectId) {
      params.push(projectId);
      where.push(`project_id = $${params.length}`);
    }

    const limit = Number.isFinite(options.limit) && (options.limit ?? 0) > 0
      ? Math.trunc(options.limit as number)
      : 500;
    const cursor = options.cursor ?? null;

    const cursorFilter = cursor
      ? `
      WHERE (
        grouped.updated_at < $${params.length + 1}::timestamptz
        OR (
          grouped.updated_at = $${params.length + 1}::timestamptz
          AND grouped.session_id < $${params.length + 2}
        )
      )`
      : '';

    if (cursor) {
      params.push(cursor.updatedAt);
      params.push(cursor.sessionId);
    }

    params.push(limit + 1);
    const limitParam = `$${params.length}`;

    type SessionRow = {
      session_id: string;
      project_id: string | null;
      workflow_type: string | null;
      artifact_count: string;
      updated_at: Date | string;
      status: 'generating' | 'failed' | 'completed';
    };

    const query = `
      WITH grouped AS (
        SELECT
          session_id,
          project_id,
          COUNT(*) AS artifact_count,
          MAX(updated_at) AS updated_at,
          CASE
            WHEN BOOL_OR(status = 'generating') THEN 'generating'
            WHEN BOOL_OR(status = 'failed') THEN 'failed'
            ELSE 'completed'
          END AS status
        FROM ${this.artifactsTableName}
        WHERE ${where.join(' AND ')}
        GROUP BY session_id, project_id
      )
      SELECT
        grouped.session_id,
        grouped.project_id,
        latest.workflow_type,
        grouped.artifact_count,
        grouped.updated_at,
        grouped.status
      FROM grouped
      LEFT JOIN LATERAL (
        SELECT a.workflow_type
        FROM ${this.artifactsTableName} a
        WHERE a.user_id = $1
          AND a.session_id = grouped.session_id
          AND a.project_id = grouped.project_id
        ORDER BY a.updated_at DESC, a.id DESC
        LIMIT 1
      ) latest ON TRUE
      ${cursorFilter}
      ORDER BY grouped.updated_at DESC, grouped.session_id DESC
      LIMIT ${limitParam}
    `;

    const result: QueryResult<SessionRow> = await this.pg.query(query, params);
    const rows = result.rows.slice(0, limit);
    const hasMore = result.rows.length > limit;
    const entries: SessionListEntry[] = rows.map((row) => ({
      sessionId: row.session_id,
      projectId: row.project_id ?? '',
      toolKey: normalizeToolWorkflowKey(row.workflow_type),
      status: row.status === 'generating' || row.status === 'failed' ? row.status : 'completed',
      artifactCount: parseInt(row.artifact_count, 10),
      updatedAt: typeof row.updated_at === 'string' ? row.updated_at : row.updated_at.toISOString(),
    }));

    const last = entries[entries.length - 1];
    return {
      entries,
      nextCursor: hasMore && last
        ? { updatedAt: last.updatedAt, sessionId: last.sessionId }
        : null,
    };
  }
}

export const createPostgresRedisProductionDependencies = (
  clients: PostgresRedisProductionClients,
  options: PostgresRedisProductionOptions = {},
): PostgresRedisAdapterDependencies => {
  const llm =
    options.llm?.adapter ?? createOpenRouterLlmStreamAdapterFromEnv() ?? createSyntheticLlmStreamAdapter();

  return {
    ownership: new PostgresProjectOwnershipRepository(clients.pg, options.persistence),
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
    llm,
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
