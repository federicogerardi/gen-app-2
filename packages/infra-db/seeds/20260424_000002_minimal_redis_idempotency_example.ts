import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('Missing Redis URL. Set REDIS_URL');
}

const keyPrefix = process.env.IDEMPOTENCY_REDIS_KEY_PREFIX ?? 'generation:idempotency';
const userId = process.env.IDEMPOTENCY_SEED_USER_ID ?? 'seed-user-001';
const projectId = process.env.IDEMPOTENCY_SEED_PROJECT_ID ?? 'seed-project-001';
const endpoint = process.env.IDEMPOTENCY_SEED_ENDPOINT ?? 'generation';
const idempotencyKey = process.env.IDEMPOTENCY_SEED_KEY ?? 'seed-idempotency-001';
const requestId = process.env.IDEMPOTENCY_SEED_REQUEST_ID ?? 'seed-request-001';
const ttlSeconds = Number(process.env.IDEMPOTENCY_SEED_TTL_SECONDS ?? '900');

const lockKey = `${keyPrefix}:lock:${userId}:${projectId}:${endpoint}:${idempotencyKey}`;
const lockValue = `${requestId}:seed`;

const run = async () => {
  const redis = new Redis(redisUrl);
  try {
    await redis.set(lockKey, lockValue, 'EX', ttlSeconds);
    console.log('Seeded Redis idempotency lock key:');
    console.log(lockKey);
    console.log(`TTL seconds: ${ttlSeconds}`);
  } finally {
    await redis.quit();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
