import type { Pool } from 'pg';

import type { PersistenceBatchInput } from '../types/xstate';

import {
  normalizeStepKey,
  normalizeToolWorkflowKey,
  resolveToolStepArtifactRole,
} from '../runtime/workflow-normalizers';

import type { PostgresArtifactRepository as PostgresArtifactRepositoryPort } from './postgres-redis.interfaces';
import type { PersistenceRepositoryOptions } from './postgres-redis.shared.types';
import { buildQualifiedTableName, withTransaction } from './postgres-redis.sql.utils';

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
