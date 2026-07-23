import Redis from 'ioredis';
import { Pool } from 'pg';
import { createPostgresRedisProductionGenerationAdapters } from './lib/adapters';
import {
  createToolWorkflowQueue,
  createToolWorkflowWorker,
  gracefulShutdown,
} from './lib/runtime/tool-workflow-job-queue';
import { processToolWorkflowJob } from './lib/runtime/tool-workflow-job-processor';
import { createComponentLogger, LogComponent } from './lib/runtime/log-components';

const log = createComponentLogger(LogComponent.TOOL_WORKFLOW_JOB_QUEUE);

const run = async (): Promise<void> => {
  const redisUrl = process.env.REDIS_URL;
  const databaseUrl = process.env.DATABASE_URL;

  if (!redisUrl || !databaseUrl) {
    throw new Error('REDIS_URL and DATABASE_URL are required');
  }

  const redis = new Redis(redisUrl);
  const pg = new Pool({ connectionString: databaseUrl });
  const adapters = createPostgresRedisProductionGenerationAdapters({ pg, redis });

  const queue = createToolWorkflowQueue(redis);
  const worker = createToolWorkflowWorker(
    (job) => processToolWorkflowJob(job, { adapters, redis }),
    redis,
  );

  const shutdown = (): void => {
    void gracefulShutdown(worker, queue).finally(() => {
      void pg.end();
      void redis.quit();
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  log.info('tool workflow worker started (standalone mode)');
};

void run().catch((error) => {
  log.error({ err: error }, 'worker startup failed');
  process.exit(1);
});
