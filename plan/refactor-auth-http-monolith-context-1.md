---
goal: Contesto implementativo verificato per il piano di scomposizione auth-http
version: 1.0
date_created: 2026-05-19
last_updated: 2026-05-19
owner: Backend Architecture
status: 'Ready'
tags: [refactor, architecture, backend, context]
source_plan: plan/refactor-auth-http-monolith-1.md
---

# Introduction

Questo documento traduce il piano `refactor-auth-http-monolith-1.md` in un contesto implementativo verificato sul codice attuale. Non ripete il piano: registra solo le evidenze utili per eseguirlo con il minor numero di letture aggiuntive possibile.

Obiettivo operativo: ridurre il rischio di drift durante l'implementazione chiarendo in anticipo quali assunzioni del piano sono già confermate, quali vanno corrette, quali moduli controllano davvero il comportamento runtime, e quali comandi/test sono eseguibili nel repository corrente.

---

## 1. Verified Deltas From The Plan

### 1.1 Dead imports in `runtime.ts` are confirmed

- `normalizeToolWorkflowKey` è importata in `apps/backend/src/lib/runtime/auth-http/runtime.ts` ma non viene mai chiamata.
- I simboli `canPublishUserReportIssue`, `normalizeProductChangelogStatus`, `normalizeUserReportCategory`, `normalizeUserReportStatus` risultano presenti solo nella riga di import di `runtime.ts`.
- `publishGitHubIssue` e `PublishGitHubIssueError` risultano presenti solo nella riga di import di `runtime.ts`.
- Conclusione: il cleanup Phase 1 su `runtime.ts` è confermato e a basso rischio.

### 1.2 `support.ts` already owns the request body types

- `apps/backend/src/lib/runtime/auth-http/support.ts` esporta già `AdminCreateUserRequestBody`, `AdminUpdateUserRequestBody`, `AdminCreateChangelogRequestBody`, `AdminUpdateUserReportRequestBody`, `AdminPublishUserReportIssueRequestBody` e `CreateUserReportRequestBody`.
- `admin-handlers.ts` ridefinisce localmente quei tipi: il task di deduplicazione è diretto e non richiede nuove decisioni DDD.
- `support.ts` non esporta ancora i tipi funzione per `writeError` e `writeSuccess`: qui va fatta l'estensione condivisa prevista dal piano.

### 1.3 Backend validation command in the plan needs adjustment

- Nel workspace root esiste `npm run build`, ma nel package `apps/backend` non esiste uno script `build`.
- Il comando eseguibile per la validazione locale backend è `npm --workspace apps/backend run typecheck`.
- Se si vuole mantenere il wording "build" a livello piano, il comando corretto di repo è `npm run build`, che però valida anche il frontend.

### 1.4 `AdminHandlers` contains dead public duplicates

- `runtime.ts` dispatcha `/api/models`, `/api/changelog` e `/api/user-reports` verso `publicHandlers`, non verso `adminHandlers`.
- In `admin-handlers.ts` esistono comunque `handleModelsList`, `handleCreateUserReport` e `handleListPublishedChangelog`.
- La ricerca workspace mostra solo definizione + export locale per queste tre funzioni nel file admin, più le omologhe realmente usate in `public-handlers.ts`.
- Conclusione: prima dello split conviene trattarle come dead code candidate, non come parte obbligatoria del contratto runtime.

### 1.5 Some dependency assumptions in the plan are too narrow

- I handler LLM admin toccano sempre la sessione (`repositories.sessions.touchSession`) e quindi richiedono anche `repositories.sessions` e `now`.
- `admin-feedback-center-handlers` richiede anche `parseRequestUrl` per i filtri `status/category` di `handleAdminListUserReports`.
- `admin-user-handlers` non usa `parseOptionalNonEmptyString`.
- `tools-brief-handlers` richiede anche `parseRequestUrl`, `requireQueryRepositories`, `repositories.sessions` e `now`.
- `tools-hydrate-handlers` richiede `parseJsonBody`, `requireQueryRepositories`, `repositories.sessions` e `now`; non usa `parseRequestUrl`.
- `tools-orchestrate-handlers` richiede `requireQueryRepositories`, `repositories.sessions` e `now` oltre a `idempotency` e `parseJsonBody`.
- `tools-session-handlers` richiede `repositories.sessions`, `now`, `parseRequestUrl`, `requireQueryRepositories`, `writeError` e `writeSuccess`.

---

## 2. Owning Runtime Surfaces

### 2.1 `runtime.ts`

- Crea i guard shared `requireAdminPrincipal`, `requireSessionPrincipal`, `requireQueryRepositories`, `requireDb`.
- Compone `authHandlers`, `projectsHandlers`, `publicHandlers`, `toolsHandlers`, `adminHandlers`.
- Controlla tutto il route dispatch order, inclusi i due vincoli già commentati nel file:
  - `/api/tools/sessions/:sessionId/download` deve restare prima di `/api/tools/sessions/:sessionId`
  - `/api/artifacts/:artifactId/download` deve restare prima di `/api/artifacts/:artifactId`

### 2.2 `support.ts`

- È già il punto autorevole per parsing JSON/body, normalizzazione stringhe, conversioni auth role/status e response writers.
- È il posto corretto per centralizzare `AuthHttpWriteErrorFn` e `AuthHttpWriteSuccessFn`.

### 2.3 `public-handlers.ts`

- È già l'owner runtime dei public endpoints per `LlmModelCatalog` read (`/api/models`) e FeedbackCenter public surface (`/api/changelog`, `/api/user-reports`).
- Le tre funzioni omologhe presenti in `admin-handlers.ts` non fanno parte del path runtime attuale.

### 2.4 `admin-handlers.ts`

- Contiene tre gruppi distinti mischiati nello stesso file:
  - LlmModelCatalog admin CRUD
  - FeedbackCenter admin endpoints
  - User CRUD admin endpoints
- Contiene anche tre duplicati non dispatchati dal runtime: `handleModelsList`, `handleCreateUserReport`, `handleListPublishedChangelog`.

### 2.5 `tools-handlers.ts`

- Contiene quattro responsabilità separabili in modo naturale:
  - brief upload
  - hydration
  - orchestration
  - GenerationSession read/download
- Include il duplicato locale `normalizeSupportedToolKey`, che va sostituito con il normalizzatore canonico `normalizeToolWorkflowKey` da `workflow-normalizers.ts`.
- Contiene helper puri di hydration già pronti per estrazione senza dipendenze HTTP.

---

## 3. Extractable Module Map

## 3.1 Admin split

| Target file | Handlers to move | Confirmed minimal dependencies | Notes |
| --- | --- | --- | --- |
| `admin-llm-model-handlers.ts` | `handleAdminModelsList`, `handleAdminModelsCreate`, `handleAdminModelsUpdate`, `handleAdminModelsDelete` | `requireAdminPrincipal`, `requireDb`, `parseJsonBody`, `repositories.sessions`, `now`, `writeError`, `writeSuccess` | `handleModelsList` is a dead-code candidate and should not be promoted by default into the new module. |
| `admin-feedback-center-handlers.ts` | `handleAdminCreateChangelog`, `handleAdminListChangelog`, `handleAdminArchiveChangelog`, `handleAdminListUserReports`, `handleAdminUpdateUserReport`, `handleAdminPublishUserReportIssue` | `requireAdminPrincipal`, `requireDb`, `parseJsonBody`, `parseOptionalNonEmptyString`, `parseRequestUrl`, `repositories.sessions`, `now`, `githubApiConfig`, `writeError`, `writeSuccess` | `handleCreateUserReport` and `handleListPublishedChangelog` are currently dead duplicates of public handlers. |
| `admin-user-handlers.ts` | `handleAdminListUsers`, `handleAdminCreateUser`, `handleAdminGetUser`, `handleAdminUpdateUser`, `handleAdminDeleteUser` | `repositories.users`, `repositories.sessions`, `passwordHashing`, `requireAdminPrincipal`, `parseJsonBody`, `parseRequestUrl`, `parseAuthUserRole`, `parseAuthUserStatus`, `userToResponseData`, `now`, `writeError`, `writeSuccess` | No `parseOptionalNonEmptyString` usage in this slice. |
| `admin-handlers.ts` | thin composer only | union of child deps | Keep public export surface stable during split. |

## 3.2 Tools split

| Target file | Handlers to move | Confirmed minimal dependencies | Notes |
| --- | --- | --- | --- |
| `tools-brief-handlers.ts` | `handleToolsBriefUpload` | `parseJsonBody`, `parseRequestUrl`, `requireSessionPrincipal`, `requireQueryRepositories`, `repositories.sessions`, `now`, `writeError`, `writeSuccess` | Replace local `normalizeSupportedToolKey` with `normalizeToolWorkflowKey`. Keep `normalizeMimeType` private here unless reused. |
| `tools-hydration-parser.ts` | `isRecord`, `normalizeExtractionPayload`, `parseJsonCandidate`, `parseExtractionContent`, `parsedFormatFromInput` | none beyond local pure helpers | This file is the DDD-038 extraction/hydration parser surface. |
| `tools-hydrate-handlers.ts` | `handleToolsHydrate` | `parseJsonBody`, `requireSessionPrincipal`, `requireQueryRepositories`, `repositories.sessions`, `now`, `writeError`, `writeSuccess` | No `parseRequestUrl` usage in current implementation. |
| `tools-orchestrate-handlers.ts` | `handleToolsOrchestrate` | `parseJsonBody`, `requireSessionPrincipal`, `requireQueryRepositories`, `repositories.sessions`, `idempotency`, `now`, `writeError`, `writeSuccess` | Keeps ToolStepOrchestration boundary aligned with DDD-031. |
| `tools-session-handlers.ts` | `handleToolsSessionsList`, `handleToolsSessionArtifacts`, `handleToolsSessionStepArtifact`, `handleToolsSessionDownload` | `parseRequestUrl`, `requireSessionPrincipal`, `requireQueryRepositories`, `repositories.sessions`, `now`, `writeError`, `writeSuccess` | Download path writes raw response; list/detail paths still use `writeSuccess`. |
| `tools-handlers.ts` | thin composer only | union of child deps | After split, this file should stop owning domain logic. |

---

## 4. Route Table Extraction Baseline

`runtime.ts` currently owns 29 path checks/pattern matches. For Phase 4, the stable extraction baseline is:

1. `/auth/login`
2. `/auth/logout`
3. `/auth/session`
4. `/auth/google/start`
5. `/auth/google/callback`
6. `/admin/users`
7. `/admin/users/:id`
8. `/api/admin/models`
9. `/api/admin/models/:id`
10. `/api/models`
11. `/api/changelog`
12. `/api/user-reports`
13. `/api/admin/changelog`
14. `/api/admin/user-reports`
15. `/api/admin/user-reports/:id/publish-issue`
16. `/api/admin/user-reports/:id`
17. `/api/admin/product-changelogs/:id/archive`
18. `/api/projects`
19. `/api/projects/:id`
20. `/api/artifacts`
21. `/api/tools/briefs`
22. `/api/tools/hydrate`
23. `/api/tools/orchestrate`
24. `/api/tools/sessions`
25. `/api/tools/sessions/:sessionId/step/:stepKey`
26. `/api/tools/sessions/:sessionId/download`
27. `/api/tools/sessions/:sessionId`
28. `/api/artifacts/:artifactId/download`
29. `/api/artifacts/:artifactId`

Implementation note: route-table extraction should preserve current method handling semantics. Some entries are single-method handler calls, others intentionally delegate method branching to the handler body.

---

## 5. Existing Test Coverage To Reuse

### 5.1 Primary integration suite

- `apps/backend/src/lib/tests/runtime.auth-http.test.ts` is the main regression net for admin endpoints, tools briefs/hydrate, session projections and general auth-http behavior.
- `apps/backend/src/lib/tests/runtime.tools-orchestrate.test.ts` is the focused regression net for `/api/tools/orchestrate` and should be rerun after any extraction of orchestration logic.
- `apps/backend/src/lib/tests/generation-session.e2e.test.ts` covers session detail/step flows on the read side.

### 5.2 Useful command set

- Fastest backend compile gate: `npm --workspace apps/backend run typecheck`
- Focused auth-http integration gate: `npm --workspace apps/backend run test:integration`
- Full backend suite: `npm --workspace apps/backend run test`

### 5.3 Missing tests implied by the plan

- There is no dedicated unit test file yet for the future `tools-hydration-parser.ts` helpers.
- There is no dedicated unit test file yet for the future `route-table.ts` dispatcher.
- Both are good additions exactly in the phases declared by the plan, because they validate extracted pure logic without reusing the entire runtime harness.

---

## 6. Recommended Implementation Sequence

1. Phase 1 first, but execute it against the verified scope above:
   - remove confirmed dead imports from `runtime.ts`
   - move `WriteError`/`WriteSuccess` callback types into `support.ts`
   - import shared body types into `admin-handlers.ts`
   - validate with `npm --workspace apps/backend run typecheck`
2. Before Phase 2 extraction, shrink `AdminHandlers` to the handlers actually used by `runtime.ts` unless a hidden external consumer is found.
3. Split `admin-handlers.ts` using the verified dependency slices in Section 3.1 rather than the narrower assumptions in the plan.
4. Split `tools-handlers.ts` using the verified dependency slices in Section 3.2; extract the hydration parser before moving `handleToolsHydrate`.
5. Only after both composers are stable, replace the route if/else chain with a declarative route table preserving the current route order.

---

## 7. Decision Guardrails During Implementation

- Preserve canonical DDD terms already approved for this boundary: `LlmModel`, `LlmModelCatalog`, `ProductChangelog`, `UserReport`, `ToolStepOrchestration`, `GenerationSession`, `FeedbackCenter`.
- Do not reintroduce any local tool-key normalizer in child modules; import `normalizeToolWorkflowKey` only.
- Keep `requireAdminPrincipal` and `requireSessionPrincipal` in `runtime.ts` as the shared guard authority unless a test-backed refactor explicitly proves equivalence.
- Treat dead duplicated handlers as deletion candidates, not mandatory extraction scope. Promoting dead code into new modules would increase surface area without preserving runtime behavior.

---

## 8. Ready-To-Use Execution Checklist

- Phase 1 anchor files:
  - `apps/backend/src/lib/runtime/auth-http/runtime.ts`
  - `apps/backend/src/lib/runtime/auth-http/support.ts`
  - `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts`
- Phase 2 anchor file:
  - `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts`
- Phase 3 anchor file:
  - `apps/backend/src/lib/runtime/auth-http/tools-handlers.ts`
- Phase 4 anchor file:
  - `apps/backend/src/lib/runtime/auth-http/runtime.ts`

If implementation starts from these anchors and follows the dependency slices above, no broad repo remapping should be necessary.