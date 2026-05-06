# apps/backend

Backend runtime for three bounded contexts:

- Generation
- Auth
- Usage/Quota

Package: @gen-app-2/backend

## Domain Role

The backend is the authority for domain execution and persistence.

- It executes GenerationRequest through GenerationSystem.
- It validates access using AuthSessionPrincipal.
- It enforces quota with ClaimUsage.
- It streams BackendStreamEvent to Frontend/UI.
- It persists Artifact lifecycle and QuotaHistory.

## Core XState Actors

- generation-system.machine.ts: aggregate orchestration root
- request-gateway.machine.ts: request validation and pre-authorization checks
- idempotency-coordinator.machine.ts: IdempotencyKey claim and replay/conflict decisions
- usage.machine.ts: ClaimUsage execution
- tool-workflow.machine.ts: WorkflowStep progression
- extraction-chain.machine.ts: ExtractionContext production path
- stream-transport.machine.ts: live stream transport
- persistence-batch.machine.ts: Artifact incremental and final persistence

## Runtime Entry

- src/server.ts

## Contract Boundary

Frontend/UI must consume backend contracts as canonical:

- GenerationRequest
- BackendStreamEvent
- OutputFormat
- ArtifactType

Shared definitions are maintained in packages/contracts with compile-time parity checks.

If an event is unnamed, it never happened.

<!-- bomberto-egg-02 cipher:rot13 forefn -->

## Local Development

1. Install dependencies from repository root.
2. Run minimal DB migrations.
3. Start backend server.

Example:

```bash
npm install
npm --workspace apps/backend run db:migrate:minimal
npm --workspace apps/backend run start:server
```

## DDD References

Read first for naming and boundary decisions:

1. ../../docs/01-requirements/domain-ubiquitous-language-glossary.md
2. ../../docs/02-design/domain-bounded-context-map.md
3. ../../docs/07-governance/domain-naming-decision-log.md
