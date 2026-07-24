import { Kysely, sql } from 'kysely';
import type { Pool } from 'pg';

import type {
  ToolWorkflowJobRepository,
  ToolWorkflowJobCreateInput,
  ToolWorkflowJobProgressInput,
  ToolWorkflowJobCompleteInput,
  ToolWorkflowJobFailedInput,
  ToolWorkflowJobDetail,
  ToolWorkflowJobListFilters,
  ToolWorkflowJobListResult,
} from './postgres-redis.interfaces';
import { createKyselyDb } from './postgres-kysely.dialect';
import type { DB } from './postgres-kysely.types';

const dbNow = sql<Date>`NOW()`;

export class PostgresToolWorkflowJobRepository implements ToolWorkflowJobRepository {
  private readonly db: Kysely<DB>;

  constructor(pg: Pool) {
    this.db = createKyselyDb(pg);
  }

  async create(input: ToolWorkflowJobCreateInput): Promise<void> {
    await this.db
      .insertInto('tool_jobs')
      .values({
        job_id: input.jobId,
        user_id: input.userId,
        project_id: input.projectId,
        tool_key: input.toolKey,
        workflow_type: input.workflowType,
        status: 'queued',
        total_steps: input.totalSteps,
        completed_steps: 0,
        progress: {},
        result: null,
        model: input.model ?? null,
        cost_usd: 0,
        input_tokens: 0,
        output_tokens: 0,
        created_at: dbNow,
        updated_at: dbNow,
      })
      .execute();
  }

  async updateStatus(jobId: string, status: string): Promise<void> {
    await this.db
      .updateTable('tool_jobs')
      .set({ status, updated_at: dbNow })
      .where('job_id', '=', jobId)
      .execute();
  }

  async updateProgress(jobId: string, input: ToolWorkflowJobProgressInput): Promise<void> {
    await this.db
      .updateTable('tool_jobs')
      .set({
        completed_steps: input.completedSteps,
        progress: input.progress,
        updated_at: dbNow,
      })
      .where('job_id', '=', jobId)
      .execute();
  }

  async markCompleted(jobId: string, input: ToolWorkflowJobCompleteInput): Promise<void> {
    await this.db
      .updateTable('tool_jobs')
      .set({
        status: 'completed',
        session_id: input.sessionId,
        result: { sessionId: input.sessionId, artifactIds: input.artifactIds },
        cost_usd: input.costUsd ?? 0,
        input_tokens: input.inputTokens ?? 0,
        output_tokens: input.outputTokens ?? 0,
        updated_at: dbNow,
        completed_at: dbNow,
      })
      .where('job_id', '=', jobId)
      .execute();
  }

  async markFailed(jobId: string, input: ToolWorkflowJobFailedInput): Promise<void> {
    await this.db
      .updateTable('tool_jobs')
      .set({
        status: 'failed',
        result: { errorMessage: input.errorMessage },
        updated_at: dbNow,
        completed_at: dbNow,
      })
      .where('job_id', '=', jobId)
      .execute();
  }

  async markCancelled(jobId: string): Promise<void> {
    await this.db
      .updateTable('tool_jobs')
      .set({
        status: 'cancelled',
        updated_at: dbNow,
        completed_at: dbNow,
      })
      .where('job_id', '=', jobId)
      .execute();
  }

  async findById(jobId: string): Promise<ToolWorkflowJobDetail | null> {
    const row = await this.db
      .selectFrom('tool_jobs')
      .selectAll()
      .where('job_id', '=', jobId)
      .executeTakeFirst();

    if (!row) return null;

    return {
      jobId: row.job_id,
      userId: row.user_id,
      projectId: row.project_id,
      toolKey: row.tool_key,
      workflowType: row.workflow_type,
      sessionId: row.session_id,
      status: row.status,
      totalSteps: row.total_steps,
      completedSteps: row.completed_steps,
      progress: (row.progress ?? {}) as Record<string, unknown>,
      result: row.result as Record<string, unknown> | null,
      model: row.model,
      costUsd: Number(row.cost_usd),
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
      completedAt: row.completed_at
        ? (row.completed_at instanceof Date ? row.completed_at : new Date(row.completed_at))
        : null,
    };
  }

  async listByFilter(filters: ToolWorkflowJobListFilters): Promise<ToolWorkflowJobListResult> {
    let query = this.db.selectFrom('tool_jobs');
    let countQuery = this.db.selectFrom('tool_jobs');

    if (filters.userId) {
      query = query.where('user_id', '=', filters.userId);
      countQuery = countQuery.where('user_id', '=', filters.userId);
    }
    if (filters.projectId) {
      query = query.where('project_id', '=', filters.projectId);
      countQuery = countQuery.where('project_id', '=', filters.projectId);
    }
    if (filters.toolKey) {
      query = query.where('tool_key', '=', filters.toolKey);
      countQuery = countQuery.where('tool_key', '=', filters.toolKey);
    }
    if (filters.status) {
      query = query.where('status', '=', filters.status);
      countQuery = countQuery.where('status', '=', filters.status);
    }

    const limit = filters.limit ?? 25;
    const offset = filters.offset ?? 0;

    const [rows, countRow] = await Promise.all([
      query
        .selectAll()
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute(),
      countQuery
        .select((eb) => eb.fn.countAll().as('total'))
        .executeTakeFirst(),
    ]);

    const jobs = rows.map((row) => ({
      jobId: row.job_id,
      userId: row.user_id,
      projectId: row.project_id,
      toolKey: row.tool_key,
      workflowType: row.workflow_type,
      sessionId: row.session_id,
      status: row.status,
      totalSteps: row.total_steps,
      completedSteps: row.completed_steps,
      model: row.model,
      costUsd: Number(row.cost_usd),
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
      completedAt: row.completed_at
        ? (row.completed_at instanceof Date ? row.completed_at : new Date(row.completed_at))
        : null,
    }));

    return {
      jobs,
      total: Number(countRow?.total ?? 0),
    };
  }
}
