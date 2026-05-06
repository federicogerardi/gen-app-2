# Minimal Redis Seed For IdempotencyCoordinator Smoke Tests

This seed supports deterministic smoke testing of IdempotencyCoordinator behavior.

## Redis Lock Key Shape

generation:idempotency:lock:{userId}:{projectId}:{endpoint}:{idempotencyKey}

## Default Seed Values

- userId: seed-user-001
- projectId: seed-project-001
- endpoint: generation
- idempotencyKey: seed-idempotency-001
- requestId: seed-request-001

Expected key:

generation:idempotency:lock:seed-user-001:seed-project-001:generation:seed-idempotency-001

## Expected IdempotencyDecision Outcomes

- claimed: no Redis lock key and no matching request_idempotency SQL row
- conflict: lock key exists; claim attempt must return conflict outcome
- replay: completed SQL row exists with artifact reference and persisted content

## Run

```bash
npm run db:seed:redis:minimal
```

## Required Environment

- REDIS_URL

## Upstash Note

Use the TCP/TLS connection URL (rediss://...) for ioredis-compatible scripts. REST credentials are not used by this seed.

## Optional Overrides

- IDEMPOTENCY_REDIS_KEY_PREFIX
- IDEMPOTENCY_SEED_USER_ID
- IDEMPOTENCY_SEED_PROJECT_ID
- IDEMPOTENCY_SEED_ENDPOINT
- IDEMPOTENCY_SEED_KEY
- IDEMPOTENCY_SEED_REQUEST_ID
- IDEMPOTENCY_SEED_TTL_SECONDS