import type Redis from 'ioredis';
import { Queue, Worker, type Job, type JobsOptions } from 'bullmq';

import { createComponentLogger, LogComponent } from './log-components';

const QUEUE_NAME = 'tool-workflow';
const log = createComponentLogger(LogComponent.TOOL_WORKFLOW_JOB_QUEUE);

export type ToolWorkflowJobData = {
  toolKey: string;
  projectId: string;
  userId: string;
  extractionPayload: Record<string, unknown>;
  model: string;
  intent: 'new' | 'resume' | 'regenerate';
  idempotencyKey: string;
  jobId: string;
};

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 86400 },
  removeOnFail: { age: 604800 },
};

export const createToolWorkflowQueue = (redis: Redis): Queue<ToolWorkflowJobData> => {
  const queue = new Queue<ToolWorkflowJobData>(QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  log.info({ queueName: QUEUE_NAME }, 'tool workflow queue created');
  return queue;
};

const ACTIVE_LOCK_PREFIX = 'tool-job-active:';

export const createToolWorkflowWorker = (
  processor: (job: Job<ToolWorkflowJobData>) => Promise<void>,
  redis: Redis,
): Worker<ToolWorkflowJobData> => {
  const worker = new Worker<ToolWorkflowJobData>(QUEUE_NAME, processor, {
    connection: redis,
    concurrency: 3,
    limiter: { max: 10, duration: 60_000 },
  });

  worker.on('completed', (job) => {
    log.info({ jobId: job.id, toolKey: job.data.toolKey }, 'tool workflow job completed');
  });

  worker.on('failed', async (job, error) => {
    log.error({ jobId: job?.id, toolKey: job?.data.toolKey, err: error }, 'tool workflow job failed');

    // Release the single-flight lock on permanent failure so the user can retry.
    // The lock is set in handleSubmitJob with TTL 900s; if we don't release it here,
    // the next submit gets 409 "already active" until the TTL expires.
    if (job?.data) {
      const lockKey = `${ACTIVE_LOCK_PREFIX}${job.data.userId}:${job.data.projectId}:${job.data.toolKey}`;
      try {
        await redis.del(lockKey);
      } catch { /* best-effort */ }
    }
  });

  worker.on('error', (error) => {
    log.error({ err: error }, 'tool workflow worker error');
  });

  log.info({ concurrency: 3, rateLimitMax: 10, rateLimitWindow: '60s' }, 'tool workflow worker created');
  return worker;
};

export const gracefulShutdown = async (
  worker: Worker<ToolWorkflowJobData>,
  queue: Queue<ToolWorkflowJobData>,
): Promise<void> => {
  log.info('tool workflow graceful shutdown starting');
  await worker.close();
  await queue.close();
  log.info('tool workflow graceful shutdown complete');
};
