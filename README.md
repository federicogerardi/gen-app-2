# Gen App 2 — Repository Architecture

Content generation application organized around four **bounded contexts** (DDD), implemented with XState v5 actor trees on both backend and frontend.

> Ubiquitous Language reference: `docs/01-requirements/domain-ubiquitous-language-glossary.md`

---

## 1) Domain Model

Four bounded contexts, each with an authoritative aggregate root or key actors:

| Bounded Context | Aggregate Root / Key Actor | Responsibility |
| --- | --- | --- |
| **Generation** | `GenerationSystem` | End-to-end `Artifact` lifecycle: gateway → idempotency → quota → stream → persistence |
| **Auth** | `User` / `AuthSession` | Identity, `AuthSessionPrincipal`, OAuth, role enforcement |
| **Usage/Quota** | `QuotaHistory` / `Project` | `ClaimUsage` command, `MonthlyQuota` enforcement, audit history |
| **Frontend/UI** | `ToolPage` | Tool session orchestration: `ReadinessSnapshot`, `ExtractionContext`, `HydrationResult`, `ToolStep` flow |

### Key cross-context translations

- `AuthSessionPrincipal` — Auth → Generation, Usage/Quota, Frontend/UI
- `BackendStreamEvent` (start / chunk / terminal) — Generation → Frontend/UI protocol
- `Artifact` + `Project` — shared between Generation and Frontend/UI (read model: `GenerationArtifact`)
- `ToolWorkflow` (Generation) ↔ `SupportedTool` (Frontend/UI) — distinct, kept context-local per DDD-C-001

---

## 2) XState Actor Topology

XState v5 is the primary orchestration mechanism in both contexts. Actors map 1:1 to domain services.

### Generation Context — backend actors

Root: `GenerationSystem` (`src/lib/machines/generation-system.machine.ts`)

| Actor (machine file) | Domain Service / Command | Responsibility |
| --- | --- | --- |
| `request-gateway.machine.ts` | `RequestGateway` | Validates `GenerationRequest`: auth, input, project ownership, usage gate |
| `idempotency-coordinator.machine.ts` | `IdempotencyCoordinator` | Atomic claim of `IdempotencyKey`; decision: `claimed` / `replay` / `conflict` |
| `usage.machine.ts` | `ClaimUsage` | Checks `MonthlyQuota`, produces `UsageDecision`, decrements on grant |
| `stream-transport.machine.ts` | `StreamTransport` | Manages LLM SSE session; emits `BackendStreamEvent` (start/chunk/terminal) |
| `extraction-chain.machine.ts` | `ExtractionChain` | Structured extraction pipeline with plain-text fallback |
| `tool-workflow.machine.ts` | — | Advances `WorkflowStep` lifecycle (`idle → running → done / error`) |
| `persistence-batch.machine.ts` | `PersistenceBatch` | Incremental flush + final commit of `Artifact` to PostgreSQL |

### Frontend/UI Context — frontend actors

Root: `ToolPage` (`frontend/src/features/tools/machines/tool-page.machine.ts`)

| Actor (machine file) | Domain Service / Value Object | Responsibility |
| --- | --- | --- |
| `tool-page.machine.ts` | `ToolPage` (Aggregate Root) | Computes `ReadinessSnapshot`, triggers `StepHydration`, exposes `ToolPageViewModel` |
| `briefing-upload.machine.ts` | `BriefingUpload` | `BriefingFile` → `ExtractionContext` lifecycle; recovery from prior extraction artifacts |
| `tool-flow.machine.ts` | `ToolStep` / `ToolStepStatus` | Step sequencing for each `SupportedTool` (`idle → running → done / error`) |
| `frontend-stream.machine.ts` | — | Consumes `BackendStreamEvent`; stream lifecycle (`connecting → streaming → completed / failed / reconnecting`) |

### Integration contract

- **Generation** owns domain state and persistence authority (`GenerationSystem`)
- **Frontend/UI** owns interaction and presentation authority (`ToolPage`)
- `BackendStreamEvent` is the sole protocol crossing the two contexts
- `WorkflowRunMode` (`new` / `resume` / `regenerate`) drives both `HydrationResult` loading and `CanonicalToolUiState` derivation

---

## 3) End-to-End Flow

1. `ToolPage` evaluates `ReadinessSnapshot` (checks `ExtractionContext`, `Project`, target `ToolStep`).
2. User triggers primary action → `ToolPage` emits `GenerationRequest` (`requestId`, `toolKey`, `workflowType`, `idempotencyKey`, step-level fields).
3. `frontendStreamMachine` opens SSE connection (state: `connecting`).
4. Backend `GenerationSystem` spawns actor tree: `RequestGateway` validates → `IdempotencyCoordinator` claims `IdempotencyKey` → `ClaimUsage` enforces `MonthlyQuota`.
5. `StreamTransport` starts LLM session; `PersistenceBatch` persists `Artifact` incrementally (`ArtifactStatus: generating`).
6. `BackendStreamEvent` (start / chunk / terminal) flows to `frontendStreamMachine`; `ToolStepStatus` advances to `done` or `error`.
7. `Artifact` finalized (`ArtifactStatus: completed`), recorded in `QuotaHistory`, available in `GenerationArtifact` history.

---

## 4) Deployment Architecture

```text
Browser (React + XState — Frontend/UI context)
    -> HTTPS same-origin
Frontend Runtime (Node — frontend/server.mjs)
    -> static assets / SPA fallback
    -> HTTP proxy (Railway private network)
Backend Runtime (Node + TypeScript — Generation, Auth, Usage/Quota contexts)
    -> PostgreSQL  (Artifact, QuotaHistory, Project, User, AuthSession)
    -> Redis       (IdempotencyKey claims, real-time MonthlyQuota enforcement)
```

`frontend/server.mjs` proxies `/auth/*`, `/generation/*`, `/api/*`, `/admin/users/*` to the backend over Railway private network. The backend is not directly reachable from the browser.

---

## 5) Repository Map

| Path | Bounded Context | Contents |
| --- | --- | --- |
| `src/lib/machines/` | Generation | XState actors: `GenerationSystem` and all domain services |
| `src/lib/adapters/` | Generation, Auth, Usage/Quota | Infrastructure adapters (PostgreSQL, Redis, LLM) |
| `src/lib/runtime/` | Auth | HTTP/session runtime wiring |
| `src/lib/types/` | all | Canonical TypeScript types for all bounded context value objects |
| `frontend/src/features/tools/machines/` | Frontend/UI | `ToolPage`, `BriefingUpload`, `ToolFlow` actors |
| `frontend/src/features/generation/` | Frontend/UI ↔ Generation | `frontendStreamMachine`, `GenerationRequest` contracts, `BackendStreamEvent`, `StepHydration` |
| `frontend/src/features/generation/ui/` | Frontend/UI | `CanonicalToolUiState`, `PrimaryActionPolicy`, `SecondaryActionFlags` |
| `frontend/src/app/` | Frontend/UI | UI primitives, layout, providers |
| `db/migrations/` | all | Evolutionary SQL schema (`artifacts`, `quota_history`, `projects`, `users`, `auth_sessions`) |
| `docs/` | — | DDD references, specs, ADRs, governance, lifecycle archive |
| `plan/` | — | Active implementation plans |

---

## 6) Quick Start

Backend:

```bash
npm install
npm run db:migrate:minimal
npm run start:server
```

Frontend (local dev — Vite):

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

Frontend (production local — server.mjs with proxy):

```bash
npm --prefix frontend run build
BACKEND_INTERNAL_URL=http://localhost:3000 node frontend/server.mjs
```

---

## 7) DDD and Ubiquitous Language References

| Document | Role |
| --- | --- |
| `docs/01-requirements/domain-ubiquitous-language-glossary.md` | 39 canonical terms across 4 bounded contexts — **read first** |
| `docs/02-design/domain-bounded-context-map.md` | Context responsibilities and cross-context translation rules |
| `docs/07-governance/domain-naming-decision-log.md` | 17 approved naming decisions, deprecated aliases, DDD-NNN log |

## 8) Further Architecture References

- `docs/index-overview.md`
- `docs/02-design/specifications/xstate-system-as-is-spec.md`
- `docs/02-design/specifications/frontend-spec.md`
- `docs/02-design/specifications/deployment-architecture-guide.md`
- `docs/02-design/adr/frontend-data-access-layer-adr.md`
- `docs/02-design/tool-generation-flow.md`
