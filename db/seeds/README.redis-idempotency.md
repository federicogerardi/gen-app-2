# Minimal Redis Seed For Idempotency Smoke Tests

This workspace uses the following Redis lock key shape for idempotency conflicts:

`generation:idempotency:lock:{userId}:{projectId}:{endpoint}:{idempotencyKey}`

Default seed values:

- `userId`: `seed-user-001`
- `projectId`: `seed-project-001`
- `endpoint`: `generation`
- `idempotencyKey`: `seed-idempotency-001`
- `requestId`: `seed-request-001`

Expected key created by the seed script:

`generation:idempotency:lock:seed-user-001:seed-project-001:generation:seed-idempotency-001`

Smoke test expectations:

- `claimed`: no Redis lock key exists and no matching SQL row exists in `request_idempotency`.
- `conflict`: the Redis lock key exists, so `checkAndClaim(...)` should return `idempotency_conflict`.
- `replay`: no Redis lock key is required; instead, a matching SQL row exists in `request_idempotency` with `status = 'completed'`, a non-null `artifact_id`, and persisted `content`.

Run the seed script with:

`npm run db:seed:redis:minimal`

Required environment:

- `UPSTASH_REDIS_URL`

Upstash notes:

- Use the TCP/TLS URL format (`rediss://...`) for ioredis scripts.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are REST credentials and are not used by this seed script.

Optional overrides:

- `IDEMPOTENCY_REDIS_KEY_PREFIX`
- `IDEMPOTENCY_SEED_USER_ID`
- `IDEMPOTENCY_SEED_PROJECT_ID`
- `IDEMPOTENCY_SEED_ENDPOINT`
- `IDEMPOTENCY_SEED_KEY`
- `IDEMPOTENCY_SEED_REQUEST_ID`
- `IDEMPOTENCY_SEED_TTL_SECONDS`