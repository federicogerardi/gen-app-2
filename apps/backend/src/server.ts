import Redis from 'ioredis';
import { Pool } from 'pg';

import {
  createAuthProductionRepositories,
  PostgresArtifactQueryRepository,
  PostgresProjectQueryRepository,
  createPostgresRedisProductionGenerationAdapters,
} from './lib/adapters';
import { PostgresToolWorkflowJobRepository } from './lib/adapters/postgres.tool-workflow-job.repository';
import { listEnabledModels } from './lib/adapters/llm-model.adapter';
import {
  createAuthHttpRuntime,
  createDefaultSessionCookieRuntime,
  createNodeRuntimeServer,
} from './lib/runtime';
import { createComponentLogger, LogComponent } from './lib/runtime/log-components';
import {
  getAllOverrides,
} from './lib/runtime/step-llm-model-overrides.config';
import { createStepLlmModelResolver } from './lib/runtime/step-llm-model-resolver';
import { isToolKey } from '@gen-app-2/contracts';
import {
  createToolWorkflowQueue,
  createToolWorkflowWorker,
  gracefulShutdown,
} from './lib/runtime/tool-workflow-job-queue';
import { processToolWorkflowJob } from './lib/runtime/tool-workflow-job-processor';

const log = createComponentLogger(LogComponent.SERVER);

const getRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env: ${name}`);
  }

  return value;
};

const parseOriginList = (raw: string | undefined): string[] => {
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

const parseBooleanEnv = (raw: string | undefined, fallback: boolean): boolean => {
  if (!raw) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
    return true;
  }

  if (normalized === '0' || normalized === 'false' || normalized === 'no') {
    return false;
  }

  return fallback;
};

/**
 * Validates the step LLM model override configuration at startup.
 * Checks:
 * 1. All toolKey values exist in canonical registry
 * 2. All overrideModelId values are valid LlmModelId format
 * 3. All stepKey values are non-empty strings
 *
 * Failures are logged as warnings but don't prevent startup.
 * Invalid overrides will be silently skipped during resolution.
 */
const validateStepLlmModelOverrides = (enabledModelKeys: Set<string>): void => {
  const overrides = getAllOverrides();

  if (overrides.length === 0) {
    log.info('No step LLM model overrides configured - system ready for future use');
    return;
  }

  let validationErrors = 0;

  for (const override of overrides) {
    // Validate toolKey exists in canonical registry
    if (!isToolKey(override.toolKey)) {
      log.warn({ toolKey: override.toolKey, stepKey: override.stepKey }, 'invalid toolKey in step LLM model override');
      validationErrors++;
    }

    // Validate stepKey is non-empty
    if (!override.stepKey || override.stepKey.trim().length === 0) {
      log.warn({ toolKey: override.toolKey, stepKey: override.stepKey }, 'empty stepKey in step LLM model override');
      validationErrors++;
    }

    // Validate overrideModelId format (must contain /)
    if (!override.overrideModelId || !override.overrideModelId.includes('/')) {
      log.warn({ toolKey: override.toolKey, stepKey: override.stepKey, overrideModelId: override.overrideModelId }, 'invalid overrideModelId format in step LLM model override');
      validationErrors++;
    }

    // Warn if overrideModelId is not in enabled models (soft validation)
    if (enabledModelKeys.size > 0 && !enabledModelKeys.has(override.overrideModelId)) {
      log.warn({ overrideModelId: override.overrideModelId, toolKey: override.toolKey, stepKey: override.stepKey }, 'step LLM model override not found in enabled models');
    }
  }

  if (validationErrors > 0) {
    log.warn({ overrideCount: overrides.length, errorCount: validationErrors }, 'step LLM model overrides validation errors');
  } else {
    log.info({ overrideCount: overrides.length }, 'step LLM model overrides validated successfully');
  }
};

const run = async (): Promise<void> => {
  const databaseUrl = getRequiredEnv('DATABASE_URL');
  const redisUrl = getRequiredEnv('REDIS_URL');

  const host = process.env.HOST ?? '0.0.0.0';
  const port = Number(process.env.PORT ?? '3000');

  const corsAllowedOrigins = parseOriginList(process.env.CORS_ALLOWED_ORIGINS ?? process.env.FRONTEND_ORIGIN);
  const csrfTrustedOrigins = parseOriginList(process.env.CSRF_TRUSTED_ORIGINS ?? process.env.CORS_ALLOWED_ORIGINS ?? process.env.FRONTEND_ORIGIN);

  const cookieSecure = parseBooleanEnv(process.env.AUTH_COOKIE_SECURE, process.env.NODE_ENV === 'production');
  const cookieSameSite = (process.env.AUTH_COOKIE_SAMESITE ?? 'lax').toLowerCase() as 'lax' | 'strict' | 'none';
  const cookieName = process.env.AUTH_COOKIE_NAME ?? 'genapp_session';

  const sessionCookies = createDefaultSessionCookieRuntime({
    cookieName,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    httpOnly: true,
    path: '/',
  });

  const pgPoolMax = Number.parseInt(process.env.PG_POOL_MAX ?? '20', 10);
  const pg = new Pool({
    connectionString: databaseUrl,
    max: Number.isFinite(pgPoolMax) && pgPoolMax > 0 ? pgPoolMax : 20,
  });

  const redis = new Redis(redisUrl);

  const generationAdapters = createPostgresRedisProductionGenerationAdapters({
    pg,
    redis,
  });

  // Phase 2: ToolWorkflowJob repository for Postgres persistence
  const toolWorkflowJobRepo = new PostgresToolWorkflowJobRepository(pg);

  // ToolWorkflowJob: in-process worker setup
  // BullMQ requires maxRetriesPerRequest: null on its Redis connection.
  const workerInProcess = parseBooleanEnv(process.env.TOOL_WORKFLOW_WORKER_IN_PROCESS, true);
  const bullRedis = workerInProcess
    ? new Redis(redisUrl, { maxRetriesPerRequest: null })
    : null;
  let toolWorkflowQueue = bullRedis ? createToolWorkflowQueue(bullRedis) : null;
  let toolWorkflowWorker = bullRedis
    ? createToolWorkflowWorker(
        (job) => processToolWorkflowJob(job, { adapters: generationAdapters, redis, toolWorkflowJob: toolWorkflowJobRepo }),
        bullRedis,
      )
    : null;

  // Short-lived in-memory cache for enabled model keys (TTL 60s). Mitigates RISK-002.
  let modelKeyCacheTimestamp = 0;
  let modelKeyCache: Set<string> = new Set();
  const MODEL_CACHE_TTL_MS = 60_000;

  const checkModelAvailability = async (modelKey: string, correlationId: string = '-'): Promise<boolean> => {
    const nowMs = Date.now();
    if (nowMs - modelKeyCacheTimestamp > MODEL_CACHE_TTL_MS) {
      try {
        const enabled = await listEnabledModels(pg);
        modelKeyCache = new Set(enabled.map((m) => m.key));
        modelKeyCacheTimestamp = nowMs;
        log.info({ event: 'model-cache.refreshed', enabledCount: enabled.length, sample: enabled.slice(0, 10).map((m) => m.key).join(',') }, 'model cache refreshed');
      } catch {
        // Fail closed on model catalog read errors to avoid permissive generation.
        log.warn({ event: 'model-cache.refresh_failed', modelKey, correlationId }, 'model cache refresh failed, falling back to deny');
        return false;
      }
    }
    const available = modelKeyCache.has(modelKey);
    log.info({ modelKey, available, correlationId }, 'model cache check');
    return available;
  };

  // Validate step LLM model override configuration at startup
  try {
    const enabledModels = await listEnabledModels(pg);
    const enabledModelKeys = new Set(enabledModels.map((m) => m.key));
    validateStepLlmModelOverrides(enabledModelKeys);
  } catch (error) {
    log.warn({ err: error }, 'failed to validate step LLM model overrides (non-fatal)');
  }

  const authRepositories = createAuthProductionRepositories({ pg });
  const authRuntime = createAuthHttpRuntime({
    repositories: authRepositories,
    queryRepositories: {
      projects: new PostgresProjectQueryRepository(pg),
      artifacts: new PostgresArtifactQueryRepository(pg),
    },
    idempotency: generationAdapters.idempotency,
    orchestrateCache: generationAdapters.orchestrateCache,
    db: pg,
    sessionCookies,
    googleOAuthSuccessRedirectPath: process.env.GOOGLE_OAUTH_SUCCESS_REDIRECT_PATH ?? '/',
    queue: toolWorkflowQueue ?? undefined,
    redis,
    toolWorkflowJob: toolWorkflowJobRepo,
  });

  // Create StepLlmModelResolver for per-step model override resolution (DDD-151)
  const modelResolver = createStepLlmModelResolver(
    (modelKey: string) => modelKeyCache.has(modelKey),
  );

  const server = createNodeRuntimeServer({
    generationAdapters,
    authRuntime,
    checkModelAvailability,
    modelResolver,
    debugGenerationLogs: parseBooleanEnv(process.env.GENERATION_DEBUG_LOGS, false),
    generationRoutePath: process.env.GENERATION_ROUTE_PATH ?? '/generation/stream',
    cors: {
      allowedOrigins: corsAllowedOrigins,
      allowCredentials: true,
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      maxAgeSeconds: 600,
    },
    csrf: {
      enabled: parseBooleanEnv(process.env.CSRF_ENABLED, true),
      trustedOrigins: csrfTrustedOrigins,
      protectedMethods: ['POST', 'PATCH', 'PUT', 'DELETE'],
      excludePaths: ['/auth/login', '/auth/google/start', '/auth/google/callback'],
    },
  });

  const closeAll = async (): Promise<void> => {
    if (toolWorkflowWorker && toolWorkflowQueue) {
      await gracefulShutdown(toolWorkflowWorker, toolWorkflowQueue).catch((err) => {
        log.error({ err }, 'tool workflow graceful shutdown failed');
      });
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    await Promise.all([
      pg.end(),
      redis.quit(),
      bullRedis ? bullRedis.quit() : Promise.resolve(),
    ]);
  };

  process.on('SIGINT', () => {
    void closeAll().finally(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    void closeAll().finally(() => process.exit(0));
  });

  await new Promise<void>((resolve) => {
    server.listen(port, host, () => {
      resolve();
    });
  });

  const corsInfo = corsAllowedOrigins.length > 0
    ? corsAllowedOrigins.join(', ')
    : '(none configured)';
  log.info({ host, port }, 'server listening');
  log.info({ origins: corsInfo }, 'CORS configured');
};

void run().catch((error) => {
  log.error({ err: error }, 'server startup failed');
  process.exit(1);
});
