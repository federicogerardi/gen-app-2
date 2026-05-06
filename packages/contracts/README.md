# packages/contracts

Shared FE↔BE contract types: generation requests, stream events, extraction context.

**Workspace package name**: `@gen-app-2/contracts`

## Contents (target)
- `src/index.ts` — Public API: `GenerationRequest`, `BackendStreamEvent`, shared Value Objects
- `src/parity.guard.ts` — Compile-time parity check between FE and BE shapes

## Phase 2 Status
- Workspace manifest: created Phase 1 skeleton
- Implementation: scheduled Phase 2 (TASK-006..TASK-010)

## References
- Backend source: `src/lib/runtime/request-contract.ts`, `src/lib/runtime/stream-contract.ts`
- Frontend source (pre-move): `frontend/src/features/generation/contracts/backend-stream.ts`
