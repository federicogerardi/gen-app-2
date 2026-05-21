---
goal: Close the Medium finding on quota-claim conflict observability loss with deterministic error propagation
version: 1.0
date_created: 2026-05-21
last_updated: 2026-05-21
date_completed: 2026-05-21
owner: Architecture Review
status: Completed
tags: [process, backend, quota, observability, reliability]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-green)

This plan captures objective evidence for the finding "Quota claim conflict path swallows infrastructure error details" and defines the remediation baseline before implementation.

## 1. Finding Scope

- Target finding source: `docs/07-governance/architecture-weaknesses-code-review-2026-05-21.md` (Medium severity section).
- Runtime scope: `PostgresRedisUsageRepository.claimUsage` and downstream error mapping in usage/rejection contracts.
- Goal: preserve `ClaimUsage` behavior while restoring infrastructure-failure observability and deterministic error semantics.

## 2. Evidence Collected (Pre-Refactor)

- EVID-001: Quota claim adapter swallows exception details in a generic catch branch.
  - `claimUsage` entrypoint: [apps/backend/src/lib/adapters/postgres-redis.production.ts](../apps/backend/src/lib/adapters/postgres-redis.production.ts#L306)
  - Generic catch branch: [apps/backend/src/lib/adapters/postgres-redis.production.ts](../apps/backend/src/lib/adapters/postgres-redis.production.ts#L395)
  - Catch maps all failures to `hasConflict: true`: [apps/backend/src/lib/adapters/postgres-redis.production.ts](../apps/backend/src/lib/adapters/postgres-redis.production.ts#L396), [apps/backend/src/lib/adapters/postgres-redis.production.ts](../apps/backend/src/lib/adapters/postgres-redis.production.ts#L399)

- EVID-002: Adapter conflict collapses to a single synthetic reason (`usage_conflict`) without preserving root cause.
  - Conflict mapping in resolver: [apps/backend/src/lib/adapters/postgres-redis.shared.ts](../apps/backend/src/lib/adapters/postgres-redis.shared.ts#L27), [apps/backend/src/lib/adapters/postgres-redis.shared.ts](../apps/backend/src/lib/adapters/postgres-redis.shared.ts#L28)

- EVID-003: Usage machine fallback behavior further compresses error semantics to rate-limit defaults on actor errors.
  - On actor error -> rate-limited rejection action: [apps/backend/src/lib/machines/usage.machine.ts](../apps/backend/src/lib/machines/usage.machine.ts#L88), [apps/backend/src/lib/machines/usage.machine.ts](../apps/backend/src/lib/machines/usage.machine.ts#L90)
  - Default rejection reason fallback: [apps/backend/src/lib/machines/usage.machine.ts](../apps/backend/src/lib/machines/usage.machine.ts#L83), [apps/backend/src/lib/machines/usage.machine.ts](../apps/backend/src/lib/machines/usage.machine.ts#L120)

- EVID-004: Backend error contract does not explicitly model `usage_conflict`; unknown reasons fall through to generic generation failure.
  - Explicit mappings include `idempotency_conflict`, `rate_limited`, `quota_exhausted`: [apps/backend/src/lib/runtime/error-contract.ts](../apps/backend/src/lib/runtime/error-contract.ts#L33), [apps/backend/src/lib/runtime/error-contract.ts](../apps/backend/src/lib/runtime/error-contract.ts#L41)
  - Generic fallback branch: [apps/backend/src/lib/runtime/error-contract.ts](../apps/backend/src/lib/runtime/error-contract.ts#L66)

## 3. Observed Risk Statement

- Infrastructure exceptions in quota claim (for example transactional or DB failures) are reduced to a coarse conflict path, and downstream layers may render them as rate-limit or generic generation failure semantics.
- This causes loss of diagnostic specificity and slows root-cause analysis under production incidents.

## 4. Initial Remediation Direction

- Introduce explicit infrastructure-failure classification in `claimUsage` catch path (without leaking sensitive internals).
- Preserve canonical domain commands and terms (`ClaimUsage`, `UsageDecision`, `ReadinessSnapshot`) while extending error observability.
- Add focused tests that assert infrastructure error propagation is distinguishable from quota/rate-limit conflict outcomes.

## 5. Validation Gates (Completed)

- TEST-001: `claimUsage` infra error path returns deterministic, non-conflict-specific reason code.
  - Completed by catch-path remediation in [apps/backend/src/lib/adapters/postgres-redis.production.ts](../apps/backend/src/lib/adapters/postgres-redis.production.ts#L398).
  - Guarded by regression test [apps/backend/src/lib/tests/postgres-redis.usage-repository.test.ts](../apps/backend/src/lib/tests/postgres-redis.usage-repository.test.ts#L8).
- TEST-002: `usageMachine` preserves explicit infra failure reason and does not coerce to rate-limit fallback.
  - Completed by explicit `usage_failed` default/fallback behavior in [apps/backend/src/lib/machines/usage.machine.ts](../apps/backend/src/lib/machines/usage.machine.ts#L53), [apps/backend/src/lib/machines/usage.machine.ts](../apps/backend/src/lib/machines/usage.machine.ts#L83), and [apps/backend/src/lib/machines/usage.machine.ts](../apps/backend/src/lib/machines/usage.machine.ts#L120).
  - Guarded by regression test [apps/backend/src/lib/tests/usage.machine.test.ts](../apps/backend/src/lib/tests/usage.machine.test.ts#L104).
- TEST-003: Runtime error contract maps infra usage failure without ambiguity against `rate_limited`/`quota_exhausted`.
  - Completed by dedicated mapping in [apps/backend/src/lib/runtime/error-contract.ts](../apps/backend/src/lib/runtime/error-contract.ts#L49).
  - Guarded by contract test [apps/backend/src/lib/tests/runtime.contracts.test.ts](../apps/backend/src/lib/tests/runtime.contracts.test.ts#L69).
- TEST-004: Backend test commands pass after remediation.
  - `npm --workspace apps/backend run test -- src/lib/tests/postgres-redis.usage-repository.test.ts src/lib/tests/usage.machine.test.ts src/lib/tests/runtime.contracts.test.ts` (exit code 0).
  - `npm --workspace apps/backend run test` (exit code 0).

## 6. Implementation Summary (2026-05-21)

- Closure outcome: the finding "Quota claim conflict path swallows infrastructure error details" is remediated and ready to be marked CLOSED in governance review.
- Code deltas:
  - Replaced generic conflict coercion in quota claim catch path with explicit infra-failure reason `usage_failed` in [apps/backend/src/lib/adapters/postgres-redis.production.ts](../apps/backend/src/lib/adapters/postgres-redis.production.ts#L398).
  - Updated usage actor fallback semantics to preserve infra-failure observability in [apps/backend/src/lib/machines/usage.machine.ts](../apps/backend/src/lib/machines/usage.machine.ts#L53), [apps/backend/src/lib/machines/usage.machine.ts](../apps/backend/src/lib/machines/usage.machine.ts#L90), and [apps/backend/src/lib/machines/usage.machine.ts](../apps/backend/src/lib/machines/usage.machine.ts#L120).
  - Added dedicated runtime error mapping (`usage_failed` -> retryable `generation_failed`) in [apps/backend/src/lib/runtime/error-contract.ts](../apps/backend/src/lib/runtime/error-contract.ts#L49).
- Regression tests added/updated:
  - [apps/backend/src/lib/tests/postgres-redis.usage-repository.test.ts](../apps/backend/src/lib/tests/postgres-redis.usage-repository.test.ts#L8)
  - [apps/backend/src/lib/tests/usage.machine.test.ts](../apps/backend/src/lib/tests/usage.machine.test.ts#L104)
  - [apps/backend/src/lib/tests/runtime.contracts.test.ts](../apps/backend/src/lib/tests/runtime.contracts.test.ts#L69)
