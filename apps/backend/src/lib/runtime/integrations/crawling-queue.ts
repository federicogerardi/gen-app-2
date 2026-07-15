/**
 * BullMQ queue for Geometric crawling jobs.
 * Used internally by the crawling adapter — not directly by XState.
 */

import { Queue, Worker, Job } from 'bullmq';
import { createComponentLogger, LogComponent } from '../log-components';

let queue: Queue | null = null;
let worker: Worker | null = null;

const QUEUE_NAME = 'geometric-crawling';

const getRedisConnection = () => {
  const host = process.env.REDIS_HOST ?? 'localhost';
  const port = parseInt(process.env.REDIS_PORT ?? '6379', 10);
  return { host, port };
};

export const getCrawlingQueue = (): Queue => {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: getRedisConnection() });
  }
  return queue;
};

export const startCrawlingWorker = (
  processor: (job: Job) => Promise<unknown>,
  concurrency: number = 3,
): Worker => {
  if (worker) {
    return worker;
  }

  worker = new Worker(
    QUEUE_NAME,
    processor,
    {
      connection: getRedisConnection(),
      concurrency,
      limiter: {
        max: 10,
        duration: 60000, // 10 jobs per minute max
      },
    },
  );

  worker.on('failed', (job, err) => {
    const log = createComponentLogger(LogComponent.CRAWLING_QUEUE);
    log.error({ jobId: job?.id ?? 'unknown', error: err.message }, 'crawling job failed');
  });

  worker.on('completed', (job) => {
    const log = createComponentLogger(LogComponent.CRAWLING_QUEUE);
    log.info({ jobId: job?.id ?? 'unknown' }, 'crawling job completed');
  });

  return worker;
};

export const addCrawlingJob = async (
  data: { query: string; language: string; country: string; isPaa: boolean },
  options?: { attempts?: number; backoff?: number },
): Promise<string> => {
  const q = getCrawlingQueue();
  const job = await q.add('crawl-serp', data, {
    attempts: options?.attempts ?? 3,
    backoff: {
      type: 'exponential',
      delay: options?.backoff ?? 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  });
  return job.id!;
};

export const waitForJob = async (jobId: string, timeoutMs: number = 120000): Promise<unknown> => {
  const q = getCrawlingQueue();
  const job = await q.getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const updatedJob = await q.getJob(jobId);
    if (updatedJob?.finishedOn) {
      return updatedJob.returnvalue;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
};
