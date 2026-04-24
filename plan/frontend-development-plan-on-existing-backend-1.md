---
goal: Frontend development plan aligned to existing backend XState v5 runtime
version: 1.0
date_created: 2026-04-24
last_updated: 2026-04-24
owner: GitHub Copilot
status: Proposed
tags: [frontend, react, xstate, sse, auth, integration]
---

# Introduction

Deterministic frontend plan to build a production-ready UI on top of the existing backend runtime, without redefining server contracts.

Current backend assumptions validated in code/spec:

- generation route is POST /generation/stream and answers with SSE frames.
- external SSE contract is exactly start/chunk/terminal.
- auth HTTP surface exists and is already routed in the same Node server.
- orchestration root remains generationSystemMachine; frontend must consume contracts, not internal child-machine details.

## 1. Requirements and Constraints

- REQ-001: Use backend contracts as-is from src/lib/runtime and src/lib/types/xstate.ts.
- REQ-002: Keep frontend stream lifecycle deterministic around start/chunk/terminal.
- REQ-003: Handle reconnect and final failure UX without violating terminal invariants.
- REQ-004: Integrate cookie-based auth session and OAuth redirects from existing auth routes.
- REQ-005: Keep frontend architecture independent from backend implementation details (DB/Redis/actors internals).
- REQ-006: Add tests for parser, stream machine, and critical user paths.
- CON-001: Generation stream currently requires POST body, so native EventSource cannot be the primary transport.
- CON-002: CSRF and CORS constraints configured server-side must be respected by frontend origin and credentials policy.
- CON-003: Do not invent new SSE event names or payload fields.
- GUD-001: Treat terminal as semantic close; ignore frames after terminal.
- GUD-002: Frontend must pass registryVersion or registrySnapshotRef in each generation request.

## 2. As-Is Backend Integration Map

### API surface

- Generation stream: POST /generation/stream in src/lib/runtime/node-server.ts.
- Auth endpoints: /auth/login, /auth/logout, /auth/session, /auth/google/start, /auth/google/callback in src/lib/runtime/auth-http.ts.

### Generation request shape

Request mapping in src/lib/runtime/request-contract.ts requires:

- requestId
- userId
- projectId
- artifactType
- model
- input object
- optional: toolKey, workflowType, idempotencyKey, outputFormat, registryVersion, registrySnapshotRef

### SSE shape

Serialized contract in src/lib/runtime/stream-contract.ts:

- start { requestId, artifactId }
- chunk { artifactId, chunk, sequence }
- terminal { artifactId|null, status completed|failed, reason|null }

### Orchestration behavior relevant for UI

- Backend session emits start when root enters streaming and artifactId exists.
- Chunk stream is incremental and sequence-monotonic.
- If no chunk was emitted but content exists, backend emits one synthetic chunk before terminal.
- Terminal is always emitted at session end.

## 3. Frontend Target Architecture

### 3.1 Layers

- App shell layer: routing, auth gating, global error surface.
- Domain layer: generation feature module, auth module, admin module (optional).
- State layer: XState v5 frontendStreamMachine per active generation session.
- Transport layer: fetch POST + ReadableStream SSE parser.
- UI layer: stream panel, status bar, retry controls, auth session widgets.

### 3.2 Frontend stream state machine

Recommended states:

- idle
- connecting
- streaming
- reconnecting
- completed
- failed

Recommended events:

- REQUEST_START
- SSE_START
- SSE_CHUNK
- SSE_TERMINAL
- STREAM_ERROR
- RECONNECT_TIMEOUT
- CANCEL
- RETRY
- RESET

Core guards:

- isMonotonicSequence
- canReconnect
- isRetryableTransportError

Core actions:

- cacheStartMeta
- appendChunk
- setTerminalSuccess
- setTerminalFailure
- incrementReconnectAttempts
- resetStreamContext

## 4. Delivery Plan

### Phase 1 - Contracts and transport foundation

- GOAL-001: Build strict frontend contracts and parser with exhaustive tests.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create frontend TS types mirroring BackendStreamEvent contract. |  |  |
| TASK-002 | Implement SSE frame parser for fetch stream (event/data blocks, multiline data, frame boundary). |  |  |
| TASK-003 | Add schema validation per event and reject protocol-invalid frames. |  |  |
| TASK-004 | Add parser unit tests for valid/invalid frames, terminal uniqueness, sequence monotonicity checks. |  |  |

Phase 1 acceptance:

- Parser accepts only start/chunk/terminal.
- Invalid frame path emits protocol error classification.

### Phase 2 - Frontend machine and actor wiring

- GOAL-002: Implement frontendStreamMachine and wire parser events into machine.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Implement machine with states and transitions from docs/specifications/xstate-system-as-is/frontend-sse-ui-ready-spec.md. |  |  |
| TASK-006 | Create stream actor that opens POST /generation/stream and forwards parsed events. |  |  |
| TASK-007 | Implement reconnect policy (max attempts 3, exponential backoff + jitter). |  |  |
| TASK-008 | Add machine tests for happy path, terminal failed, reconnect exhausted, reset. |  |  |

Phase 2 acceptance:

- State transitions are deterministic and tested.
- No events processed after terminal.

### Phase 3 - UI composition and UX states

- GOAL-003: Deliver user-facing generation experience tied to machine snapshot only.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-009 | Build generation form (prompt/tool/model/outputFormat/ids) and request payload mapper. |  |  |
| TASK-010 | Build streaming output panel with incremental content and sequence-safe append. |  |  |
| TASK-011 | Build status strip for connecting/streaming/reconnecting/completed/failed. |  |  |
| TASK-012 | Add actions Riprova, Cancella, Reset with machine events RETRY/CANCEL/RESET. |  |  |

Phase 3 acceptance:

- UI reflects machine state only.
- Failed and reconnecting UX are explicit and actionable.

### Phase 4 - Auth and session integration

- GOAL-004: Integrate auth runtime routes with frontend guards and session persistence.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-013 | Implement login form using POST /auth/login with credentials include. |  |  |
| TASK-014 | Implement session bootstrap via GET /auth/session at app startup. |  |  |
| TASK-015 | Implement logout via POST /auth/logout and local state reset. |  |  |
| TASK-016 | Implement Google OAuth entrypoint link to /auth/google/start and callback outcome handling. |  |  |

Phase 4 acceptance:

- Protected generation UI requires active session.
- Session expiration is surfaced with deterministic redirect/login prompt.

### Phase 5 - Integration tests and release gate

- GOAL-005: Validate frontend-backend contract end-to-end.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-017 | Add integration test: completed stream (start -> chunk+ -> terminal completed). |  |  |
| TASK-018 | Add integration test: failed stream (start -> terminal failed). |  |  |
| TASK-019 | Add integration test: network drop and reconnect exhausted. |  |  |
| TASK-020 | Add auth integration tests: login/session/logout and unauthorized generation attempt. |  |  |

Phase 5 acceptance:

- End-to-end tests cover all critical runtime contracts.
- Frontend release candidate can be verified against local runtime server.

## 5. Proposed Frontend File Map

Suggested structure for implementation:

- src/frontend/features/generation/contracts/backend-stream.ts
- src/frontend/features/generation/parser/sse-parser.ts
- src/frontend/features/generation/machines/frontend-stream.machine.ts
- src/frontend/features/generation/runtime/generation-client.ts
- src/frontend/features/generation/ui/GenerationForm.tsx
- src/frontend/features/generation/ui/GenerationStreamPanel.tsx
- src/frontend/features/auth/runtime/auth-client.ts
- src/frontend/features/auth/ui/LoginForm.tsx
- src/frontend/app/providers/GenerationProvider.tsx

## 6. Risks and Mitigations

- RISK-001: Misalignment between frontend payload and backend required fields.
  - MITIGATION: central request mapper with compile-time type and integration test.
- RISK-002: Duplicate or out-of-order chunk processing.
  - MITIGATION: monotonic sequence guard in machine before append.
- RISK-003: Reconnect loops after terminal.
  - MITIGATION: hard guard that disables reconnect once terminal is observed.
- RISK-004: CSRF/CORS mismatch in local environments.
  - MITIGATION: align frontend origin with server CORS/CSRF config and run smoke check before QA.

## 7. Exit Criteria

- EXIT-001: Parser and machine tests green.
- EXIT-002: Auth and generation integration tests green against running backend.
- EXIT-003: Manual verification of completed and failed stream UX done.
- EXIT-004: No frontend code depends on internal actor names beyond documented contracts.

## 8. References

- docs/specifications/xstate-system-as-is-spec.md
- docs/specifications/xstate-system-as-is/frontend-sse-ui-ready-spec.md
- src/lib/types/xstate.ts
- src/lib/runtime/node-server.ts
- src/lib/runtime/request-contract.ts
- src/lib/runtime/stream-contract.ts
- src/lib/runtime/backend-session.ts
- src/lib/runtime/auth-http.ts