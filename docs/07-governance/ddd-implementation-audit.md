---
status: active
version: 1.0
date_created: 2026-07-22
last-reviewed: 2026-07-22
next-review-date: 2026-10-22
owner: Domain Architecture
type: code-review
tags: [ddd, audit, bounded-context, aggregate, value-object, governance]
---

# DDD Implementation Audit

> Audit completo dell'implementazione DDD nel repository `gen-app-2`, eseguito il 2026-07-22.
>
> **Collegamento Proposta**: questo audit è stato eseguito nel contesto della [Proposal: BE-Driven Workflow Job System](../02-design/proposal-be-driven-workflow-job-system.md) (BullMQ, DDD-226/DDD-227), che introduce il nuovo Aggregate Root `ToolWorkflowJob` e rappresenta il prossimo passo evolutivo dell'architettura. I riferimenti ai concetti `ToolWorkflowJob`, `ToolWorkflowJobId`, e BullMQ nel glossario e nella BCM sono **provisional** — questo audit ne verifica la coerenza con lo stato attuale dell'implementazione.

## 1. SOMMARIO ESECUTIVO

Il progetto implementa un approccio DDD non convenzionale ma rigoroso: **le macchine a stati XState v5 fungono da Aggregate Root** e i **Value Object sono union type TypeScript con array `as const`**. Questa architettura è valida e coerente, supportata da una governance documentale eccellente (Glossario UL v2.23, Bounded Context Map v3.14, Decision Log v4.15 con 230+ entry).

**Giudizio complessivo**: ✅ Solido — 2 gap minori identificati, nessun bloccante.

**Documenti canonici di riferimento**:
- [Domain Ubiquitous Language Glossary](../01-requirements/domain-ubiquitous-language-glossary.md) (v2.23, 2026-07-20)
- [Domain Bounded Context Map](../02-design/domain-bounded-context-map.md) (v3.14, 2026-07-20)
- [Domain Naming Decision Log](domain-naming-decision-log.md) (v4.15, 2026-07-20)
- [Frontend UI Ubiquitous Language Spec](../02-design/specifications/frontend-ui-ubiquitous-language-spec.md) (v1.8, 2026-07-21)

---

## 2. VERIFICA DEI BOUNDED CONTEXT

### 2.1 Contesto Generation — Aggregate Roots: `GenerationSystem`, `ToolWorkflowJob` (provisional)

**Stato**: ✅ **Canonico e implementato**; `ToolWorkflowJob` è **provisional** (non ancora implementato, in attesa della Proposal BullMQ)

**Architettura dell'Actor Tree**:
```
generationSystemMachine (Aggregate Root, canonico)
├── requestGatewayMachine      → validazione, routing
├── idempotencyCoordinatorMachine → deduplicazione (Redis SET NX EX + PostgreSQL)
├── usageMachine                → quota enforcement pre-generazione
├── toolWorkflowMachine         → orchestratore multi-step
├── extractionChainMachine      → estrazione strutturata LLM
├── streamTransportMachine      → sessione SSE streaming
└── persistenceBatchMachine     → persistenza artefatto
```

**ToolWorkflowJob (provisional, DDD-226/DDD-227)**:
- Definito come **Satellite Aggregate Root** nella BCM
- Relazione: un `ToolWorkflowJob` **produce e possiede** una `GenerationSession`
- Cardinalità: 1:1 per `WorkflowRunMode = 'new'`, potenzialmente 1:N per `'regenerate'`
- Stati: `queued` | `running` | `completed` | `failed` | `cancelled`
- Identificato da `ToolWorkflowJobId` (Value Object, distinto da `WorkflowSessionIdentifier`)
- **Nota per la Proposal BullMQ**: la relazione `ToolWorkflowJob` → `GenerationSession` è correttamente documentata ma non ancora implementata. L'audit conferma che l'infrastruttura necessaria (BullMQ, Redis, idempotency lock) è già presente.

**Evidenza nel codice**:
- `apps/backend/src/lib/machines/generation-system.definition.ts` — macchina XState top-level
- `apps/backend/src/lib/machines/generation-system.execution.states.ts` — `toolGenerationFlow` invoca `invokeToolWorkflow`
- `apps/backend/src/lib/runtime/backend-session.ts` — `runBackendGenerationSession()`
- `apps/backend/src/lib/adapters/postgres.artifact.repository.ts` — persistenza artefatti con `session_id`, `artifact_role`, `run_mode`

### 2.2 Contesto Auth

**Stato**: ✅ **Canonico e implementato**

`AuthSessionPrincipal` è il read model condiviso corretto passato da Auth → Generation e Auth → Usage/Quota. Verificato in:
- `apps/backend/src/lib/types/auth.ts:47-50` — definizione `AuthSessionPrincipal`
- `apps/backend/src/lib/adapters/auth.production.ts:140` — `mapAuthSessionPrincipalRow()`
- `apps/backend/src/lib/runtime/auth-http/support.ts:184-202` — `parseAuthUserRole()`, `parseAuthUserStatus()`

### 2.3 Contesto Usage/Quota

**Stato**: ✅ **Canonico e implementato**

Separazione corretta Redis (rate limiting real-time) vs PostgreSQL (audit/billing). Comandi implementati:
- `ClaimUsage` (DDD-143): verifica gate + crediti senza consumare
- `ConsumeCredits` (DDD-141): addebito crediti post-SUCCESS
- `RecordArtifactSuccess` (DDD-142): incremento artifact gate post-SUCCESS

**Evidenza**: `apps/backend/src/lib/adapters/postgres-redis.usage.repository.ts`

### 2.4 Contesto Frontend/UI — Aggregate Root: `ToolPage`

**Stato**: ✅ **Canonico e implementato**

Il `toolPageMachine` è l'aggregate root frontend con stati ben definiti. Feedback channel mapping (`inline-action`, `page-state`, `global`) implementato correttamente.

**Evidenza**:
- `apps/frontend/src/features/tools/machines/tool-page.machine.ts` — macchina XState
- `apps/frontend/src/app/runtime/feedback-channel-map.ts` — `resolveFeedbackChannel()`
- `apps/frontend/src/app/providers/FeedbackMessageProvider.tsx` — global feedback runtime

### 2.5 Contesti Crawling & Extraction e Competitor Analysis

**Stato**: ⚠️ **Provisional** — documentati nella BCM, implementazione runtime parziale

Tipi `WorkflowStepType = 'crawling'` e `'scoring'` definiti in `xstate.ts:25` ma gli attori runtime (`crawlingChainMachine`, `scoringChainMachine`) sono in fase di implementazione.

---

## 3. VERIFICA DEI VALUE OBJECT

### 3.1 `packages/domain` — Primitivi cross-contesto

**Stato**: ✅ **Eccellente**

Tutti i Value Object condivisi sono definiti in `packages/domain/src/index.ts` con pattern `const ARRAY = [...] as const` + `type = (typeof ARRAY)[number]`, completo di type guards e normalizer:

| Value Object | Valori | DDD Ref | File |
|---|---|---|---|
| `ArtifactType` | `'content' \| 'seo' \| 'code' \| 'extraction' \| 'crawl' \| 'analysis'` | DDD-001 | `packages/domain/src/index.ts:25-26` |
| `ArtifactStatus` | `'generating' \| 'completed' \| 'failed'` | DDD-017 | `packages/domain/src/index.ts:33-34` |
| `OutputFormat` | `'plain' \| 'json' \| 'markdown'` | — | `packages/domain/src/index.ts:41-42` |
| `WorkflowRunMode` | `'new' \| 'resume' \| 'regenerate'` | DDD-037 | `packages/domain/src/index.ts:49-50` |
| `ArtifactRole` | `'step' \| 'final'` | DDD-033 | `packages/domain/src/index.ts:61-62` |

**Nessuna duplicazione**: Backend e Frontend importano da `@gen-app-2/domain`.

### 3.2 Value Object specifici per contesto

**Stato**: ✅ **Corretti** — Tutti hanno type guards e normalizer associati.

| VO | File | Valori |
|---|---|---|
| `ArtifactFailureReason` | `artifact.ts:35-58` | 23 cause di fallimento |
| `ToolWorkflow` | `artifact.ts:62-66` | Derivato da `@gen-app-2/contracts` + `'extraction'` |
| `WorkflowStepStatus` | `xstate.ts:24` | `'idle' \| 'running' \| 'done' \| 'error' \| 'skipped'` |
| `WorkflowStepType` | `xstate.ts:25` | `'extraction' \| 'generation' \| 'acquisition' \| 'crawling' \| 'scoring'` |
| `ApiServiceAccessMode` | `api-service.ts:1` | `'public' \| 'token' \| 'query-param'` |
| `AuthUserRole` | `auth.ts:3-4` | `'admin' \| 'member'` |
| `AuthUserStatus` | `auth.ts:6-7` | `'active' \| 'disabled' \| 'pending_password_reset'` |
| `QuotaEventStatus` | `artifact.ts:69-70` | `'success' \| 'error' \| 'rate_limited'` |

---

## 4. VERIFICA DEI CONTRATTI TRA CONTESTI

**Stato**: ✅ **Eccellente** — `packages/contracts` come single source of truth.

| Contratto | File | Verifica |
|---|---|---|
| `GenerationRequest` | `contracts/src/index.ts` | Discriminated union con varianti `Tool`, `Extraction`, `Generic` |
| `BackendStreamEvent` | `contracts/src/index.ts` | `start \| chunk \| terminal` |
| `ToolWorkflowDefinition` (11 tools) | `contracts/src/tool-workflows.ts` | Definizioni complete con step, creditCost, availability policy |
| `AssetDomainModel` | `contracts/src/asset.ts` | 13 `AssetType`, DTO, field mappings |
| `ExtractionFields` | `contracts/src/extraction-fields.ts` | 39 chiavi canoniche, mappe per-tool, legacy alias |
| `ApiServiceDto` | `contracts/src/api-service.ts` | Contratti CRUD e resolve |
| Parity guard | `contracts/src/parity.guard.ts` | Compile-time structural alignment FE↔BE |
| `ToolKey` (canonico) | `contracts/src/tool-workflows.ts` | 11 valori kebab-case, cross-context |

---

## 5. VERIFICA DELLA GOVERNANCE TERMINOLOGICA

### 5.1 Termini deprecati — rimozione verificata

| Termine Deprecato | DDD Ref | Stato nel codice |
|---|---|---|
| `ToneProfile` | DDD-216 | ❌ Rimosso completamente |
| `RequestTone` | DDD-216 | ❌ Rimosso completamente |
| `ToolPageReadinessSnapshot` | DDD-014 | ❌ Rinominato `ReadinessSnapshot` |
| `ToolPageReadinessReasonCode` | DDD-014 | ❌ Rinominato `ReadinessReasonCode` |
| `StreamUsageMetrics` | DDD-016 | ❌ Alias verso `LlmUsageMetrics`, removal target 2026-Q3 |
| `PersistedArtifactStatus` | DDD-017 | ❌ Alias verso `ArtifactStatus`, removal target 2026-Q3 |
| `ToolExtractionContext` | DDD-012 | ❌ Consolidato in `ExtractionContext` |
| `BriefingContext` | DDD-012 | ❌ Consolidato in `ExtractionContext` |
| `Screenshot` / `SerpScreenshot` | DDD-145 | ❌ Rimosso completamente (0 occorrenze in `.ts`/`.tsx`) |

### 5.2 `meta_ads` vs `meta_ads_generator`

**Stato**: ✅ **Corretto** — DDD-094 implementato correttamente.

- `ToolKey = 'meta-ads'` (kebab-case, identità canonica)
- `ToolWorkflow = 'meta_ads_generator'` (snake_case, routing interno)
- `meta_ads` legacy → gestito solo dai normalizer, mai usato come identità primaria

### 5.3 Convenzione kebab vs snake_case

**Stato**: ✅ **Rispettata** — DDD-C-005 documenta esplicitamente la divergenza come regola di traduzione.

---

## 6. GAP IDENTIFICATI

### 🔴 GAP-1: `ToolFormKey` mai implementato

| Campo | Dettaglio |
|---|---|
| **Severità** | Media |
| **Decision** | DDD-029 (2026-05-04) |
| **Descrizione** | DDD-029 stabilisce che il tipo di implementazione del form registry FE deve chiamarsi `ToolFormKey` (`keyof typeof toolFormRegistry`), distinto da `ToolKey` cross-context. Il tipo non è mai stato creato. |
| **Evidenza** | `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts:129` usa `Record<SupportedTool, ToolFormConfig>` invece di `Record<ToolFormKey, ToolFormConfig>` |
| **Impatto** | Basso — `SupportedTool` è semanticamente equivalente. Tuttavia, la mancata implementazione viola esplicitamente DDD-029. |
| **Fix** | Aggiungere `export type ToolFormKey = keyof typeof toolFormRegistry;` in `tool-form-architecture.ts` |

### 🟡 GAP-2: Stringa italiana hardcoded in `ProjectsListPage.tsx`

| Campo | Dettaglio |
|---|---|
| **Severità** | Bassa |
| **Regola** | UI Spec §13.5 — "nessuna stringa hardcoded in ARIA/text attributes" |
| **Descrizione** | `apps/frontend/src/features/projects/pages/ProjectsListPage.tsx:43` contiene fallback `?? 'Progetto'` |
| **Impatto** | Basso — il fallback non viene mai raggiunto perché `appCopy.ui.labels.project` è sempre definito |
| **Fix** | Rimuovere il fallback o spostarlo in `appCopy` come chiave esplicita |

---

## 7. OSSERVAZIONI ARCHITETTURALI

### 7.1 Pattern XState-as-Aggregate

Il progetto non usa classi OOP tradizionali (`class Entity`, `class AggregateRoot`). Le macchine a stati XState v5 fungono da aggregate root. **Questo è un pattern DDD valido** (Actor Model / Event Sourcing ibrido):

✅ **Punti di forza**:
- Macchine a stati esplicite, tipizzate e testabili per ogni aggregate
- Eventi XState tipizzati e tracciabili
- Separazione netta tra dominio (macchine) e infrastruttura (adapter)
- `assign()`, `guard()`, e `action()` incapsulano la logica di business

⚠️ **Aree di attenzione**:
- La logica di dominio è distribuita tra macchine, selector, e normalizer — non concentrata in classi entità
- Non esiste un domain event bus esplicito — gli eventi sono transizioni interne XState
- Per i contesti async (Crawling, BullMQ), sarà necessario un meccanismo di eventi inter-processo

**Approfondimento**: vedi [XState-as-Aggregate Architectural Risk Review](xstate-as-aggregate-architectural-review.md) per l'analisi dettagliata dei 6 rischi architetturali (serializzazione, event bus, logica distribuita, TypeScript inference, onboarding, debugging) e le raccomandazioni specifiche per la Proposal BullMQ.

### 7.2 Repository Pattern

✅ **Eccellente** — Interfacce typed in `postgres-redis.interfaces.ts`, implementazioni Kysely in file dedicati. Nessun ORM, nessun accesso diretto al DB dal dominio.

```
Interface (dominio)           Implementazione (infrastruttura)
─────────────────────         ───────────────────────────────
PostgresArtifactRepository → postgres.artifact.repository.ts
RedisQuotaRepository       → postgres-redis.usage.repository.ts
RedisIdempotencyRepository → postgres-redis.idempotency.repository.ts
ArtifactQueryRepository    → session-query.adapter.ts
```

### 7.3 Domain Services

I Domain Service documentati (`LlmModelCatalog`, `StreamTransport`, `ExtractionChain`, `IdempotencyCoordinator`, `ToolStepOrchestration`, `ApiServiceCatalog`, `StepLlmModelResolver`) sono implementati come XState machine o funzioni pure. Coerente con l'architettura funzionale scelta.

### 7.4 ToolWorkflowPersistenceMetadata

✅ **Correttamente embedded** nell'artifact input JSON:
- `buildToolWorkflowPersistenceMetadata()` in `generation-routing.ts:98-136`
- Memorizzato sotto chiave `toolWorkflow` nell'`input_json`
- Colonne denormalizzate (`session_id`, `step_key`, `artifact_role`, `run_mode`) per query indicizzate
- Consumato da FE `StepHydration` come read-only

---

## 8. RIEPILOGO PER AREA DDD

| Area DDD | Valutazione | Note |
|---|---|---|
| **Ubiquitous Language** | ✅ Eccellente | Glossario esaustivo, 230+ decision log, nessun drift terminologico attivo |
| **Bounded Contexts** | ✅ Solido | 6 contesti definiti nella BCM; 2 provisional (Crawling, Competitor Analysis) |
| **Aggregate Roots** | ✅ Valido | `GenerationSystem` e `ToolPage` come XState v5 machines; `ToolWorkflowJob` provisional |
| **Entities** | ✅ Adeguato | Tipo-based, non class-based. Consistente con l'architettura funzionale |
| **Value Objects** | ✅ Eccellente | `as const` arrays + union types + type guards + normalizer — zero duplicazioni |
| **Domain Events** | ⚠️ Interni | Eventi solo all'interno dell'actor tree XState, non inter-processo |
| **Repository** | ✅ Eccellente | Interfacce typed, Kysely query builder, nessun ORM |
| **Domain Services** | ✅ Coerente | Implementati come XState machines/funzioni pure |
| **Application Services** | ✅ Presenti | `GenerationRequestAssembly`, handler HTTP |
| **Anti-Corruption Layer** | ✅ Presente | Traduzione kebab↔snake_case, normalizer, extraction field aliases |
| **Contracts** | ✅ Eccellente | `packages/contracts` single source of truth, parity guard compile-time |

---

## 9. RACCOMANDAZIONI

### Azioni immediate
1. **Implementare `ToolFormKey`** (GAP-1): creare il type alias in `tool-form-architecture.ts` — 5 minuti
2. **Rimuovere `'Progetto'` hardcoded** (GAP-2): pulire il fallback in `ProjectsListPage.tsx:43` — 2 minuti

### Raccomandazioni per la Proposal BullMQ
3. **Definire eventi inter-processo per `ToolWorkflowJob`**: la Proposal introduce un'esecuzione asincrona via BullMQ — sarà necessario un meccanismo di eventi che attraversi i confini di processo (es. BullMQ events → Redis pub/sub → SSE verso FE)
4. **Documentare il pattern XState-as-Aggregate nella BCM**: aggiungere una sezione che spiega perché le macchine a stati sostituiscono le classi tradizionali
5. **Centralizzare le business rules**: alcune regole (es. `canTransitionArtifactStatus`) vivono in file di tipo; considerare un modulo `domain-rules.ts` per le regole più complesse man mano che il sistema cresce

### Debito tecnico identificato
6. **Alias backward-compat da rimuovere entro Q3 2026**: `StreamUsageMetrics` (DDD-016) e `PersistedArtifactStatus` (DDD-017)

---

## 10. COLLEGAMENTI

| Documento | Relazione |
|---|---|
| [Proposal: BE-Driven Workflow Job System](../02-design/proposal-be-driven-workflow-job-system.md) | **Proposta attiva** — introduce `ToolWorkflowJob` (DDD-226/DDD-227), verificato come coerente con lo stato attuale dell'implementazione |
| [Domain Ubiquitous Language Glossary](../01-requirements/domain-ubiquitous-language-glossary.md) | Documento canonico di riferimento |
| [Domain Bounded Context Map](../02-design/domain-bounded-context-map.md) | Documento canonico di riferimento |
| [Domain Naming Decision Log](domain-naming-decision-log.md) | Documento canonico di riferimento |
| [Architecture Weaknesses Code Review](architecture-weaknesses-code-review.md) | Review correlata — il finding MEDIUM "Generation flow completion remains partially dependent on Frontend/UI liveness signals" è direttamente affrontato dalla Proposal BullMQ |
| [Critical Vulnerabilities Progressive Review](critical-vulnerabilities-progressive-review.md) | Review correlata — Sprint 1-7 completati |