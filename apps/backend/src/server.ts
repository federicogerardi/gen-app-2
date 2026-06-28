import Redis from 'ioredis';
import { Pool } from 'pg';

import {
  createAuthProductionRepositories,
  PostgresArtifactQueryRepository,
  PostgresProjectQueryRepository,
  createPostgresRedisProductionGenerationAdapters,
} from './lib/adapters';
import { listEnabledModels } from './lib/adapters/llm-model.adapter';
import {
  createAuthHttpRuntime,
  createDefaultSessionCookieRuntime,
  createNodeRuntimeServer,
} from './lib/runtime';
import { LocalScreenshotStorage } from './lib/runtime/integrations/screenshot-storage';
import { LocalScreenshotArchival } from './lib/runtime/integrations/screenshot-archival';

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

  // ── Screenshot archival configuration (Geometric tool) ──────────────────
  const screenshotStoragePath = process.env.SCREENSHOT_STORAGE_PATH ?? '/data/screenshots';
  const screenshotRetentionDaysRaw = Number.parseInt(
    process.env.SCREENSHOT_RETENTION_DAYS ?? '30',
    10,
  );
  const screenshotRetentionDays =
    Number.isFinite(screenshotRetentionDaysRaw) && screenshotRetentionDaysRaw > 0
      ? screenshotRetentionDaysRaw
      : 30;

  const screenshotStorage = new LocalScreenshotStorage(screenshotStoragePath);
  const screenshotArchival = new LocalScreenshotArchival(screenshotStorage, pg, screenshotRetentionDays);
  console.log(`[DEBUG][screenshot] server init — screenshotStoragePath=${screenshotStoragePath}, retentionDays=${screenshotRetentionDays}, screenshotArchival=${screenshotArchival ? 'created' : 'NULL'}`);

  const generationAdaptersWithScreenshot = {
    ...generationAdapters,
    screenshotArchival,
  };
  console.log(`[DEBUG][screenshot] generationAdaptersWithScreenshot — screenshotArchival=${generationAdaptersWithScreenshot.screenshotArchival ? 'present' : 'NULL'}`);

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
        console.info(
          `[gen][model-cache] corr=${correlationId} refreshed enabledCount=${enabled.length} sample=${enabled
            .slice(0, 10)
            .map((m) => m.key)
            .join(',')}`,
        );
      } catch {
        // Fail closed on model catalog read errors to avoid permissive generation.
        console.warn(
          `[gen][model-cache] corr=${correlationId} refresh_failed modelKey=${modelKey} fallback=deny`,
        );
        return false;
      }
    }
    const available = modelKeyCache.has(modelKey);
    console.info(`[gen][model-cache] corr=${correlationId} check modelKey=${modelKey} available=${available}`);
    return available;
  };

  const authRepositories = createAuthProductionRepositories({ pg });
  const authRuntime = createAuthHttpRuntime({
    repositories: authRepositories,
    queryRepositories: {
      projects: new PostgresProjectQueryRepository(pg),
      artifacts: new PostgresArtifactQueryRepository(pg),
    },
    idempotency: generationAdaptersWithScreenshot.idempotency,
    orchestrateCache: generationAdaptersWithScreenshot.orchestrateCache,
    db: pg,
    sessionCookies,
    googleOAuthSuccessRedirectPath: process.env.GOOGLE_OAUTH_SUCCESS_REDIRECT_PATH ?? '/',
    screenshotStorage,
  });

  const server = createNodeRuntimeServer({
    generationAdapters: generationAdaptersWithScreenshot,
    authRuntime,
    checkModelAvailability,
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
  console.log(`Runtime server listening on http://${host}:${port}`);
  console.log(`CORS allowed origins: ${corsInfo}`);
  console.log(`Screenshot storage path: ${screenshotStoragePath}, retention: ${screenshotRetentionDays} days`);

  // ── Scheduled cleanup for expired screenshots (every 24h) ─────────────
  const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
  setInterval(() => {
    void screenshotArchival
      .cleanupExpiredScreenshots(new Date())
      .then((result) => {
        console.log(
          `[screenshot-cleanup] deletedFiles=${result.deletedFiles}, deletedRecords=${result.deletedRecords}`,
        );
      })
      .catch((err) => {
        console.error('[screenshot-cleanup] error:', err);
      });
  }, CLEANUP_INTERVAL_MS);
};

void run().catch((error) => {
  console.error(error);
  process.exit(1);
});
