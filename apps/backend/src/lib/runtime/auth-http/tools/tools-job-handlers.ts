import type { IncomingMessage, ServerResponse } from 'node:http';
import type Redis from 'ioredis';
import type { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';

import type { AuthRepositoryBundle, UserQueryRepositoryBundle } from '../../../adapters';
import type { ToolWorkflowJobRepository } from '../../../adapters/postgres-redis.interfaces';
import type { AuthSessionPrincipal } from '../../../types/auth';
import type { ToolWorkflowJobData } from '../../tool-workflow-job-queue';
import { isSupportedToolWorkflow } from '../../tool-workflow-registry';
import { createComponentLogger, LogComponent } from '../../log-components';
import type { AuthHttpWriteErrorFn, AuthHttpWriteSuccessFn } from '../support';

const log = createComponentLogger(LogComponent.TOOL_WORKFLOW_JOB_HANDLERS);

const ACTIVE_LOCK_PREFIX = 'tool-job-active:';
const ACTIVE_LOCK_TTL_SECONDS = 900;
const JOB_STATUS_PREFIX = 'tool-job:';
const JOB_STATUS_TTL_SECONDS = 86400;

type SubmitJobRequestBody = {
  toolKey?: unknown;
  projectId?: unknown;
  extractionPayload?: unknown;
  model?: unknown;
  intent?: unknown;
  idempotencyKey?: unknown;
};

export type CreateToolsJobHandlersDependencies = {
  queue: Queue<ToolWorkflowJobData>;
  redis: Redis;
  repositories: Pick<AuthRepositoryBundle, 'sessions'>;
  toolWorkflowJob?: ToolWorkflowJobRepository | null | undefined;
  now: () => Date;
  parseJsonBody: <T>(request: IncomingMessage) => Promise<T>;
  requireSessionPrincipal: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<AuthSessionPrincipal | null>;
  requireQueryRepositories: (response: ServerResponse) => UserQueryRepositoryBundle | null;
  writeError: AuthHttpWriteErrorFn;
  writeSuccess: AuthHttpWriteSuccessFn;
};

export type ToolsJobHandlers = {
  handleSubmitJob(request: IncomingMessage, response: ServerResponse): Promise<void>;
  handleGetJobStatus(request: IncomingMessage, response: ServerResponse, jobId: string): Promise<void>;
  handleCancelJob(request: IncomingMessage, response: ServerResponse, jobId: string): Promise<void>;
  handleListJobs(request: IncomingMessage, response: ServerResponse): Promise<void>;
};

export const createToolsJobHandlers = (
  deps: CreateToolsJobHandlersDependencies,
): ToolsJobHandlers => {
  const {
    queue,
    redis,
    repositories,
    toolWorkflowJob: jobRepo,
    now,
    parseJsonBody,
    requireSessionPrincipal,
    requireQueryRepositories,
    writeError,
    writeSuccess,
  } = deps;

  const handleSubmitJob = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for tools jobs');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const body = await parseJsonBody<SubmitJobRequestBody>(request).catch(() => null);
    if (!body) {
      writeError(response, 400, 'bad_request', 'Invalid JSON body');
      return;
    }

    const { toolKey, projectId, extractionPayload, model, intent, idempotencyKey } = body;

    if (typeof toolKey !== 'string' || !isSupportedToolWorkflow(toolKey)) {
      writeError(response, 400, 'bad_request', 'Invalid or unsupported toolKey');
      return;
    }

    if (typeof projectId !== 'string' || projectId.trim().length === 0) {
      writeError(response, 400, 'bad_request', 'projectId is required');
      return;
    }

    if (!extractionPayload || typeof extractionPayload !== 'object') {
      writeError(response, 400, 'bad_request', 'extractionPayload is required');
      return;
    }

    if (typeof model !== 'string' || model.trim().length === 0) {
      writeError(response, 400, 'bad_request', 'model is required');
      return;
    }

    const validIntents = ['new', 'resume', 'regenerate'];
    if (!validIntents.includes(intent as string)) {
      writeError(response, 400, 'bad_request', 'intent must be new, resume, or regenerate');
      return;
    }

    const queries = requireQueryRepositories(response);
    if (!queries) return;

    const project = await queries.projects.getProjectByIdForUser(principal.user.id, projectId.trim());
    if (!project) {
      writeError(response, 403, 'forbidden', 'Project not found or access denied');
      return;
    }

    const activeLockKey = `${ACTIVE_LOCK_PREFIX}${principal.user.id}:${projectId.trim()}:${toolKey}`;
    const existingLock = await redis.get(activeLockKey);
    if (existingLock) {
      // Stale lock guard: if the job that holds the lock no longer exists
      // (completed, failed, or expired), allow the new submission.
      try {
        const lockHolderJob = await queue.getJob(existingLock);
        if (!lockHolderJob || (await lockHolderJob.isCompleted()) || (await lockHolderJob.isFailed())) {
          await redis.del(activeLockKey);
          // Fall through to submit
        } else {
          writeError(response, 409, 'conflict', `A ToolWorkflowJob is already active for this scope: ${existingLock}`);
          return;
        }
      } catch {
        // If BullMQ check fails, fall back to blocking the submission
        writeError(response, 409, 'conflict', `A ToolWorkflowJob is already active for this scope: ${existingLock}`);
        return;
      }
    }

    const jobId = randomUUID();
    const effectiveIdempotencyKey = typeof idempotencyKey === 'string' && idempotencyKey.trim().length > 0
      ? idempotencyKey.trim()
      : randomUUID();

    const jobData: ToolWorkflowJobData = {
      toolKey,
      projectId: projectId.trim(),
      userId: principal.user.id,
      extractionPayload: extractionPayload as Record<string, unknown>,
      model: model.trim(),
      intent: intent as 'new' | 'resume' | 'regenerate',
      idempotencyKey: effectiveIdempotencyKey,
      jobId,
    };

    await redis.set(activeLockKey, jobId, 'EX', ACTIVE_LOCK_TTL_SECONDS);

    const statusData = {
      jobId,
      status: 'queued',
      toolKey,
      userId: principal.user.id,
      projectId: projectId.trim(),
      createdAt: new Date().toISOString(),
    };
    await redis.set(
      `${JOB_STATUS_PREFIX}${jobId}`,
      JSON.stringify(statusData),
      'EX',
      JOB_STATUS_TTL_SECONDS,
    );

    try {
      await queue.add('tool-workflow', jobData, { jobId });
    } catch (queueError) {
      log.error({ jobId, toolKey, userId: principal.user.id, err: queueError }, 'queue add failed — job submitted but not enqueued');
      await redis.del(activeLockKey);
      writeError(response, 503, 'service_unavailable', 'Job queue unavailable');
      return;
    }

    repositories.sessions.touchSession(principal.session.id, now());

    log.info({ jobId, toolKey, userId: principal.user.id, projectId: projectId.trim() }, 'tool workflow job submitted');

    writeSuccess(response, 200, {
      jobId,
      status: 'queued',
      toolKey,
      queuedAt: statusData.createdAt,
    });
  };

  const handleGetJobStatus = async (
    request: IncomingMessage,
    response: ServerResponse,
    jobId: string,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for job status');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    if (!jobId || jobId.trim().length === 0) {
      writeError(response, 400, 'bad_request', 'jobId is required');
      return;
    }

    // Try Postgres first (Phase 2 B.4)
    if (jobRepo) {
      try {
        const job = await jobRepo.findById(jobId);
        if (job) {
          if (job.userId !== principal.user.id) {
            writeError(response, 403, 'forbidden', 'Access denied');
            return;
          }
          repositories.sessions.touchSession(principal.session.id, now());
          writeSuccess(response, 200, {
            jobId: job.jobId,
            status: job.status,
            toolKey: job.toolKey,
            userId: job.userId,
            projectId: job.projectId,
            createdAt: job.createdAt.toISOString(),
            updatedAt: job.updatedAt.toISOString(),
            completedAt: job.completedAt?.toISOString() ?? null,
            totalSteps: job.totalSteps,
            completedSteps: job.completedSteps,
            progress: job.progress,
            result: job.result,
            model: job.model,
            costUsd: job.costUsd,
            inputTokens: job.inputTokens,
            outputTokens: job.outputTokens,
          });
          return;
        }
      } catch (err) {
        log.warn({ err, jobId }, 'Postgres findById failed, falling back to Redis');
      }
    }

    // Fallback: Redis (jobs created before Phase 2 deploy)
    const raw = await redis.get(`${JOB_STATUS_PREFIX}${jobId}`);
    if (!raw) {
      writeError(response, 404, 'not_found', 'Job not found or expired');
      return;
    }

    let statusData: Record<string, unknown>;
    try {
      statusData = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      writeError(response, 500, 'internal', 'Invalid job status data');
      return;
    }

    if (statusData.userId !== principal.user.id) {
      writeError(response, 403, 'forbidden', 'Access denied');
      return;
    }

    repositories.sessions.touchSession(principal.session.id, now());

    writeSuccess(response, 200, statusData);
  };

  const handleCancelJob = async (
    request: IncomingMessage,
    response: ServerResponse,
    jobId: string,
  ): Promise<void> => {
    if (request.method !== 'POST') {
      writeError(response, 405, 'method_not_allowed', 'Use POST for job cancel');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    if (!jobId || jobId.trim().length === 0) {
      writeError(response, 400, 'bad_request', 'jobId is required');
      return;
    }

    const raw = await redis.get(`${JOB_STATUS_PREFIX}${jobId}`);
    if (!raw) {
      writeError(response, 404, 'not_found', 'Job not found or expired');
      return;
    }

    let statusData: Record<string, unknown>;
    try {
      statusData = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      writeError(response, 500, 'internal', 'Invalid job status data');
      return;
    }

    if (statusData.userId !== principal.user.id) {
      writeError(response, 403, 'forbidden', 'Access denied');
      return;
    }

    await redis.set(`tool-job-cancel:${jobId}`, 'true', 'EX', 86400);

    // Immediately release the single-flight lock so the user can retry
    // without waiting for the processor to detect the cancel flag.
    try {
      const lockKey = `${ACTIVE_LOCK_PREFIX}${statusData.userId}:${statusData.projectId}:${statusData.toolKey}`;
      await redis.del(lockKey);
    } catch { /* best-effort */ }

    repositories.sessions.touchSession(principal.session.id, now());

    log.info({ jobId, userId: principal.user.id }, 'tool workflow job cancel requested');

    writeSuccess(response, 202, { jobId, status: 'cancel_requested' });
  };

  const handleListJobs = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    if (request.method !== 'GET') {
      writeError(response, 405, 'method_not_allowed', 'Use GET for job listing');
      return;
    }

    const principal = await requireSessionPrincipal(request, response);
    if (!principal) return;

    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const filterUserId = url.searchParams.get('userId') ?? principal.user.id;
    const filterToolKey = url.searchParams.get('toolKey');
    const filterStatus = url.searchParams.get('status');
    const filterProjectId = url.searchParams.get('projectId');
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 25, 1), 100);
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

    // Use Postgres when available (Phase 2 B.4)
    if (jobRepo) {
      try {
        const result = await jobRepo.listByFilter({
          ...(filterUserId ? { userId: filterUserId } : {}),
          ...(filterProjectId ? { projectId: filterProjectId } : {}),
          ...(filterToolKey ? { toolKey: filterToolKey } : {}),
          ...(filterStatus ? { status: filterStatus } : {}),
          limit,
          offset,
        });

        repositories.sessions.touchSession(principal.session.id, now());

        writeSuccess(response, 200, {
          jobs: result.jobs.map((job) => ({
            jobId: job.jobId,
            status: job.status,
            toolKey: job.toolKey,
            userId: job.userId,
            projectId: job.projectId,
            totalSteps: job.totalSteps,
            completedSteps: job.completedSteps,
            model: job.model,
            costUsd: job.costUsd,
            inputTokens: job.inputTokens,
            outputTokens: job.outputTokens,
            createdAt: job.createdAt.toISOString(),
            updatedAt: job.updatedAt.toISOString(),
            completedAt: job.completedAt?.toISOString() ?? null,
          })),
          total: result.total,
          limit,
          offset,
        });
        return;
      } catch (err) {
        log.warn({ err }, 'Postgres listByFilter failed, falling back to Redis');
      }
    }

    // Fallback: Redis SCAN (jobs created before Phase 2 deploy)
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', `${JOB_STATUS_PREFIX}*`, 'COUNT', 100);
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    const jobs: Record<string, unknown>[] = [];
    for (const key of keys) {
      const raw = await redis.get(key);
      if (!raw) continue;
      try {
        const data = JSON.parse(raw) as Record<string, unknown>;
        if (filterUserId && data.userId !== filterUserId) continue;
        if (filterToolKey && data.toolKey !== filterToolKey) continue;
        if (filterStatus && data.status !== filterStatus) continue;
        jobs.push(data);
      } catch {
        // skip invalid entries
      }
    }

    jobs.sort((a, b) => {
      const aTime = typeof a.createdAt === 'string' ? a.createdAt : '';
      const bTime = typeof b.createdAt === 'string' ? b.createdAt : '';
      return bTime.localeCompare(aTime);
    });

    repositories.sessions.touchSession(principal.session.id, now());

    writeSuccess(response, 200, { jobs, total: jobs.length });
  };

  return { handleSubmitJob, handleGetJobStatus, handleCancelJob, handleListJobs };
};
