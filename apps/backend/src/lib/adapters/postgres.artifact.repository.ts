import { Kysely, sql } from 'kysely';
import type { Pool } from 'pg';

import type { PersistenceBatchInput } from '../types/xstate';

import {
  normalizeStepKey,
  normalizeToolWorkflowKey,
  resolveToolStepArtifactRole,
} from '../runtime/workflow-normalizers';

import type { PostgresArtifactRepository as PostgresArtifactRepositoryPort } from './postgres-redis.interfaces';
import type { PersistenceRepositoryOptions } from './postgres-redis.shared.types';
import { createKyselyDb } from './postgres-kysely.dialect';
import type { DB } from './postgres-kysely.types';

/**
 * Escape hatch: Kysely has no typed builder API for PostgreSQL server-side timestamp functions.
 * NOW() must be expressed via the sql template tag.
 */
const dbNow = sql<Date>`NOW()`;

/**
 * Escape hatch: same as dbNow but typed as Date | null for nullable timestamp columns
 * (streamed_at, completed_at) that accept a nullable Date type in ArtifactsTable.
 */
const dbNowNullable = sql<Date | null>`NOW()`;

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

export class PostgresArtifactRepository implements PostgresArtifactRepositoryPort {
  private readonly db: Kysely<DB>;
  private readonly artifactsSchema: string | undefined;
  private readonly quotaHistorySchema: string | undefined;

  constructor(
    pg: Pool,
    options: PersistenceRepositoryOptions = {},
  ) {
    this.db = createKyselyDb(pg);
    this.artifactsSchema = options.artifactsSchema;
    this.quotaHistorySchema = options.quotaHistorySchema;
    if (options.artifactsTableName !== undefined && options.artifactsTableName !== 'artifacts') {
      throw new Error(`Unsupported artifactsTableName: ${options.artifactsTableName}`);
    }
    if (options.quotaHistoryTableName !== undefined && options.quotaHistoryTableName !== 'quota_history') {
      throw new Error(`Unsupported quotaHistoryTableName: ${options.quotaHistoryTableName}`);
    }
  }

  private getArtifactDb(): Kysely<DB> {
    return this.artifactsSchema ? this.db.withSchema(this.artifactsSchema) : this.db;
  }

  async flushProgress(input: PersistenceBatchInput, _sequence: number): Promise<void> {
    const normalizedInputJson = normalizeToolWorkflowInputJson(input.inputJson, input.workflowType);
    const toolWorkflowColumns = extractToolWorkflowColumns(normalizedInputJson, input.sessionId);

    await this.getArtifactDb()
      .insertInto('artifacts')
      .values({
        id: input.artifactId,
        request_id: input.requestId,
        user_id: input.userId ?? null,
        project_id: input.projectId ?? null,
        type: input.artifactType,
        workflow_type: input.workflowType,
        session_id: toolWorkflowColumns.sessionId,
        step_key: toolWorkflowColumns.stepKey,
        artifact_role: toolWorkflowColumns.artifactRole,
        run_mode: toolWorkflowColumns.runMode,
        model: input.model ?? 'unknown',
        input_json: normalizedInputJson,
        status: 'generating',
        content: input.contentBuffer,
        input_tokens: input.inputTokens ?? 0,
        output_tokens: input.outputTokens ?? 0,
        cost_usd: input.costUsd ?? 0,
        registry_version: input.registryVersion ?? null,
        registry_snapshot_ref: input.registrySnapshotRef ?? null,
        created_at: dbNow,
        updated_at: dbNow,
        streamed_at: dbNowNullable,
      })
      .onConflict((oc) => oc
        .column('id')
        .doUpdateSet({
          content: input.contentBuffer,
          input_json: normalizedInputJson,
          input_tokens: input.inputTokens ?? 0,
          output_tokens: input.outputTokens ?? 0,
          cost_usd: input.costUsd ?? 0,
          model: input.model ?? 'unknown',
          // Escape hatch: COALESCE(EXCLUDED.col, existing_col) preserves the existing column
          // value when the incoming EXCLUDED row has NULL. Kysely's doUpdateSet() has no typed
          // API for COALESCE expressions mixing EXCLUDED pseudo-table references and sql.ref().
            user_id: sql`COALESCE(EXCLUDED.user_id, ${sql.ref('artifacts.user_id')})` as any,
            project_id: sql`COALESCE(EXCLUDED.project_id, ${sql.ref('artifacts.project_id')})` as any,
            session_id: sql`COALESCE(EXCLUDED.session_id, ${sql.ref('artifacts.session_id')})` as any,
            step_key: sql`COALESCE(EXCLUDED.step_key, ${sql.ref('artifacts.step_key')})` as any,
            artifact_role: sql`COALESCE(EXCLUDED.artifact_role, ${sql.ref('artifacts.artifact_role')})` as any,
            run_mode: sql`COALESCE(EXCLUDED.run_mode, ${sql.ref('artifacts.run_mode')})` as any,
          updated_at: dbNow,
          streamed_at: dbNowNullable,
          registry_version: input.registryVersion ?? null,
          registry_snapshot_ref: input.registrySnapshotRef ?? null,
          // Escape hatch: status guard — keep existing terminal status on conflict.
          // CASE expression with IN operator has no typed Kysely builder equivalent.
          status: sql<string>`CASE WHEN ${sql.ref('status')} IN ('completed', 'failed') THEN ${sql.ref('status')} ELSE 'generating' END`,
        })
        // Escape hatch: NOT IN filter on conflict clause — Kysely's .where() in onConflict
        // context does not support the NOT IN operator via the typed builder API.
        .where(sql<boolean>`${sql.ref('artifacts.status')} NOT IN ('completed', 'failed')`))
      .execute();
  }

  async finalizeSuccess(input: PersistenceBatchInput): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const normalizedInputJson = normalizeToolWorkflowInputJson(input.inputJson, input.workflowType);
      const toolWorkflowColumns = extractToolWorkflowColumns(normalizedInputJson, input.sessionId);

      const artifactDb = this.artifactsSchema ? trx.withSchema(this.artifactsSchema) : trx;

      await artifactDb
        .insertInto('artifacts')
        .values({
          id: input.artifactId,
          request_id: input.requestId,
          user_id: input.userId ?? null,
          project_id: input.projectId ?? null,
          type: input.artifactType,
          workflow_type: input.workflowType,
          session_id: toolWorkflowColumns.sessionId,
          step_key: toolWorkflowColumns.stepKey,
          artifact_role: toolWorkflowColumns.artifactRole,
          run_mode: toolWorkflowColumns.runMode,
          model: input.model ?? 'unknown',
          input_json: normalizedInputJson,
          status: 'completed',
          content: input.contentBuffer,
          input_tokens: input.inputTokens ?? 0,
          output_tokens: input.outputTokens ?? 0,
          cost_usd: input.costUsd ?? 0,
          registry_version: input.registryVersion ?? null,
          registry_snapshot_ref: input.registrySnapshotRef ?? null,
          created_at: dbNow,
          updated_at: dbNow,
          completed_at: dbNowNullable,
        })
        .onConflict((oc) => oc
          .column('id')
          .doUpdateSet({
            status: 'completed',
            content: input.contentBuffer,
            input_json: normalizedInputJson,
            input_tokens: input.inputTokens ?? 0,
            output_tokens: input.outputTokens ?? 0,
            cost_usd: input.costUsd ?? 0,
            model: input.model ?? 'unknown',
            // Escape hatch: COALESCE(EXCLUDED.col, existing_col) — see flushProgress for reason.
            user_id: sql`COALESCE(EXCLUDED.user_id, ${sql.ref('artifacts.user_id')})` as any,
            project_id: sql`COALESCE(EXCLUDED.project_id, ${sql.ref('artifacts.project_id')})` as any,
            session_id: sql`COALESCE(EXCLUDED.session_id, ${sql.ref('artifacts.session_id')})` as any,
            step_key: sql`COALESCE(EXCLUDED.step_key, ${sql.ref('artifacts.step_key')})` as any,
            artifact_role: sql`COALESCE(EXCLUDED.artifact_role, ${sql.ref('artifacts.artifact_role')})` as any,
            run_mode: sql`COALESCE(EXCLUDED.run_mode, ${sql.ref('artifacts.run_mode')})` as any,
            updated_at: dbNow,
            completed_at: dbNowNullable,
            failure_reason: null,
            registry_version: input.registryVersion ?? null,
            registry_snapshot_ref: input.registrySnapshotRef ?? null,
          })
          // Escape hatch: <> 'failed' filter — see flushProgress for reason.
          .where(sql<boolean>`${sql.ref('artifacts.status')} <> 'failed'`))
        .execute();

      if (input.userId) {
        const quotaDb = this.quotaHistorySchema ? trx.withSchema(this.quotaHistorySchema) : trx;
        await quotaDb
          .insertInto('quota_history')
          .values({
            user_id: input.userId,
            project_id: input.projectId ?? null,
            request_id: input.requestId,
            artifact_id: input.artifactId,
            session_id: toolWorkflowColumns.sessionId,
            status: 'success',
            cost_type: 'artifact',
            credit_cost: 0,
            request_count: 1,
            cost_usd: input.costUsd ?? 0,
            input_tokens: input.inputTokens ?? 0,
            output_tokens: input.outputTokens ?? 0,
            metadata_json: { workflowType: input.workflowType, model: input.model ?? 'unknown' },
            created_at: dbNow,
          })
          .execute();
      }
    });
  }

  async finalizeFailure(input: PersistenceBatchInput, reason: string): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      const normalizedInputJson = normalizeToolWorkflowInputJson(input.inputJson, input.workflowType);
      const toolWorkflowColumns = extractToolWorkflowColumns(normalizedInputJson, input.sessionId);

      const artifactDb = this.artifactsSchema ? trx.withSchema(this.artifactsSchema) : trx;

      await artifactDb
        .insertInto('artifacts')
        .values({
          id: input.artifactId,
          request_id: input.requestId,
          user_id: input.userId ?? null,
          project_id: input.projectId ?? null,
          type: input.artifactType,
          workflow_type: input.workflowType,
          session_id: toolWorkflowColumns.sessionId,
          step_key: toolWorkflowColumns.stepKey,
          artifact_role: toolWorkflowColumns.artifactRole,
          run_mode: toolWorkflowColumns.runMode,
          model: input.model ?? 'unknown',
          input_json: normalizedInputJson,
          status: 'failed',
          content: input.contentBuffer,
          input_tokens: input.inputTokens ?? 0,
          output_tokens: input.outputTokens ?? 0,
          cost_usd: input.costUsd ?? 0,
          failure_reason: reason,
          registry_version: input.registryVersion ?? null,
          registry_snapshot_ref: input.registrySnapshotRef ?? null,
          created_at: dbNow,
          updated_at: dbNow,
        })
        .onConflict((oc) => oc
          .column('id')
          .doUpdateSet({
            status: 'failed',
            content: input.contentBuffer,
            input_json: normalizedInputJson,
            input_tokens: input.inputTokens ?? 0,
            output_tokens: input.outputTokens ?? 0,
            cost_usd: input.costUsd ?? 0,
            model: input.model ?? 'unknown',
            // Escape hatch: COALESCE(EXCLUDED.col, existing_col) — see flushProgress for reason.
            user_id: sql`COALESCE(EXCLUDED.user_id, ${sql.ref('artifacts.user_id')})` as any,
            project_id: sql`COALESCE(EXCLUDED.project_id, ${sql.ref('artifacts.project_id')})` as any,
            session_id: sql`COALESCE(EXCLUDED.session_id, ${sql.ref('artifacts.session_id')})` as any,
            step_key: sql`COALESCE(EXCLUDED.step_key, ${sql.ref('artifacts.step_key')})` as any,
            artifact_role: sql`COALESCE(EXCLUDED.artifact_role, ${sql.ref('artifacts.artifact_role')})` as any,
            run_mode: sql`COALESCE(EXCLUDED.run_mode, ${sql.ref('artifacts.run_mode')})` as any,
            failure_reason: reason,
            updated_at: dbNow,
            registry_version: input.registryVersion ?? null,
            registry_snapshot_ref: input.registrySnapshotRef ?? null,
          }))
        .execute();

      if (input.userId) {
        const quotaStatus = reason === 'rate_limited' || reason === 'quota_exhausted' ? 'rate_limited' : 'error';
        const quotaDb = this.quotaHistorySchema ? trx.withSchema(this.quotaHistorySchema) : trx;
        await quotaDb
          .insertInto('quota_history')
          .values({
            user_id: input.userId,
            project_id: input.projectId ?? null,
            request_id: input.requestId,
            artifact_id: input.artifactId,
            session_id: toolWorkflowColumns.sessionId,
            status: quotaStatus,
            cost_type: 'artifact',
            credit_cost: 0,
            request_count: 1,
            cost_usd: input.costUsd ?? 0,
            input_tokens: input.inputTokens ?? 0,
            output_tokens: input.outputTokens ?? 0,
            metadata_json: { workflowType: input.workflowType, model: input.model ?? 'unknown', reason },
            created_at: dbNow,
          })
          .execute();
      }
    });
  }
}
