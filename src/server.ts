import Redis from 'ioredis';
import { Pool } from 'pg';

import {
  createAuthProductionRepositories,
  PostgresArtifactQueryRepository,
  PostgresProjectQueryRepository,
  createPostgresRedisProductionGenerationAdapters,
} from './lib/adapters';
import {
  createAuthHttpRuntime,
  createDefaultSessionCookieRuntime,
  createNodeRuntimeServer,
} from './lib/runtime';

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
  const redisUrl = getRequiredEnv('UPSTASH_REDIS_URL');

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

  const pg = new Pool({
    connectionString: databaseUrl,
  });

  const redis = new Redis(redisUrl);

  const generationAdapters = createPostgresRedisProductionGenerationAdapters({
    pg,
    redis,
  });

  const authRepositories = createAuthProductionRepositories({ pg });
  const authRuntime = createAuthHttpRuntime({
    repositories: authRepositories,
    queryRepositories: {
      projects: new PostgresProjectQueryRepository(pg),
      artifacts: new PostgresArtifactQueryRepository(pg),
    },
    sessionCookies,
    googleOAuthSuccessRedirectPath: process.env.GOOGLE_OAUTH_SUCCESS_REDIRECT_PATH ?? '/',
  });

  const server = createNodeRuntimeServer({
    generationAdapters,
    authRuntime,
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
};

void run().catch((error) => {
  console.error(error);
  process.exit(1);
});
