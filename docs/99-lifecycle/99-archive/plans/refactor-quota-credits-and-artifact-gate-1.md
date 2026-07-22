---
goal: Refactoring sistema quota da request-count a crediti per Session Summary + gate invisibile per Artifact
version: 1.1
last-reviewed: 2026-07-23
next-review-date: 2027-01-23
date_created: 2026-06-26
last_updated: 2026-06-28
owner: Domain Architecture + Backend Runtime
status: completed
tags: [feature, architecture, ddd, backend, frontend, usage-quota, refactoring]
---

# Refactoring Quota: Crediti Session Summary + Gate Invisibile Artifact

## DDD Gate Review — Pre-Plan Analysis

### Terminologia esistente (Glossary Usage/Quota Context)

| Termine attuale | Tipo | Stato post-refactoring |
|---|---|---|
| `MonthlyQuota` | Value Object | **Ridefinito** → massimo crediti mensili (non più request count) |
| `MonthlyUsed` | Value Object | **Rinominato** → `MonthlyCreditsUsed` (crediti consumati) |
| `QuotaWindowPeriod` | Value Object | **Invariato** (semantica reset confermata) |
| `QuotaHistory` | Entity | **Esteso** → nuovi campi `cost_type`, `credit_cost`, `session_id` |
| `QuotaEventStatus` | Value Object | **Invariato** |
| `UsageDecision` | Value Object | **Esteso** → nuovo campo `creditCost` |
| `ClaimUsage` | Command | **Ridefinito** → verifica gate + crediti disponibili, NON consuma crediti |
| `Project` | Entity | **Invariato** |

### Nuovi termini proposti (richiedono DDD decision log)

| Termine proposto | Tipo | Bounded Context | Motivazione |
|---|---|---|---|
| `CreditQuota` | Value Object | Usage/Quota | Alias canonico per `MonthlyQuota` ridefinito come credito |
| `MonthlyCreditsUsed` | Value Object | Usage/Quota | Sostituisce `MonthlyUsed` — traccia crediti consumati |
| `CreditCost` | Value Object | Usage/Quota | Costo in crediti di una Session Summary per tool |
| `ArtifactGateLimit` | Value Object | Usage/Quota | Limite invisibile di artefatti generabili per mese |
| `ArtifactGateUsed` | Value Object | Usage/Quota | Contatore invisibile di artefatti generati nel mese |
| `ConsumeCredits` | Command | Usage/Quota | Comando per scalare crediti al SUCCESS della Session Summary |
| `RecordArtifactSuccess` | Command | Usage/Quota | Comando per incrementare il gate invisibile al SUCCESS dell'artifact |
| `ToolCreditSetting` | Entity | Usage/Quota | Configurazione del costo in crediti per tool |

### Conflitti DDD identificati

1. **`ClaimUsage` cambia semantica**: attualmente decrementa `MonthlyUsed`. Nel nuovo modello verifica solo disponibilità. Questo è un breaking change semantico che richiede una decisione esplicita nel decision log.
2. **`MonthlyUsed` rinominato**: il termine esiste nel glossary come canonico. La rinomina richiede deprecazione esplicita e nuovo termine canonico.
3. **Due contatori invece di uno**: il glossary attuale ha un solo contatore (`MonthlyUsed`). L'introduzione di un secondo contatore (`ArtifactGateUsed`) richiede mappatura nel Bounded Context Map.
4. **`ToolCreditSetting` come Entity vs configurazione**: se il costo crediti vive in `packages/contracts` (come `ToolWorkflowDefinition.creditCost`), non serve una Entity DB separata. Se invece è configurabile a runtime da admin, serve la tabella DB.

### Risoluzione DDD

- **`ToolCreditSetting`**: si adotta l'approccio **contracts-first** — il costo default vive in `packages/contracts/src/tool-workflows.ts` come campo `creditCost` su ogni `ToolWorkflowDefinition`. La tabella DB `tool_credit_settings` è opzionale per override runtime da admin (fase successiva). Per questo piano, solo contracts.
- **`ClaimUsage`**: mantiene il nome (DDD-005) ma la semantica si estende. Si registra una revisione nel decision log, non una sostituzione.
- **`MonthlyUsed`**: si depreca e si introduce `MonthlyCreditsUsed`. Alias backward-compat per una transizione.

---

## Introduzione

Questo piano definisce il refactoring del sistema quota da modello request-count (1 richiesta = 1 consumo) a modello basato su crediti per Session Summary, con gate di controllo invisibile per Artifact.

**Principio guida**: l'utente vede e consuma crediti solo al completamento di una Session Summary. Il conteggio artifact esiste come limite di sicurezza backend ma è invisibile all'utente.

## 1. Requirements & Constraints

### Functional Requirements

- **REQ-001**: Ogni utente ha una quota di crediti mensili (`MonthlyQuota`, default 100).
- **REQ-002**: Ogni tool ha un costo in crediti configurabile (`CreditCost`, default 1).
- **REQ-003**: I crediti si consumano **solo al SUCCESS** della Session Summary (non al pre-claim).
- **REQ-004**: Gli artifact vengono conteggiati 1:1 al SUCCESS (`ArtifactGateUsed`).
- **REQ-005**: Esiste un limite invisibile di artifact mensili (`ArtifactGateLimit`, default 1000).
- **REQ-006**: Il gate artifact blocca la generazione se superato, ma l'utente vede solo "crediti insufficienti" se il gate è l'unico blocco.
- **REQ-007**: Le quote si resettano il primo giorno del mese a mezzanotte UTC.
- **REQ-008**: L'admin può configurare il `CreditCost` per ogni tool (fase 2 — per ora hardcoded in contracts).
- **REQ-009**: L'admin può impostare `MonthlyQuota` e `ArtifactGateLimit` per utente.

### DDD Constraints

- **DDD-001**: Prima di modifiche a codice o test, aggiornare documenti canonici DDD con nuova nomenclatura.
- **DDD-002**: Nessun termine nuovo può entrare nel codice senza voce `DDD-NNN` nel decision log.
- **DDD-003**: `ClaimUsage` mantiene il suo nome canonico (DDD-005) — la semantica si estende, non si sostituisce.
- **CON-001**: Non introdurre sinonimi non canonici per concetti quota esistenti.
- **CON-002**: Mantenere retrocompatibilità: `MonthlyUsed` rimane come alias backward-compat per una transizione.
- **CON-003**: Il costo crediti dei tool vive in `packages/contracts` (fonte unica FE/BE).
- **PAT-001**: Applicare strategia "extend-existing": estendere tabelle, adapter e machine esistenti.

### XState Constraints

- **XST-001**: Le modifiche alle macchine XState devono mantenere semantica v5.
- **XST-002**: Nessun side effect dentro `assign` — effetti restano in actor/services.
- **XST-003**: Il flusso di generazione non deve bloccarsi in stati incoerenti se il consumo crediti fallisce.

### Security Constraints

- **SEC-001**: Il gate artifact è invisibile all'utente — le API non espongono `ArtifactGateUsed` nel response utente.
- **SEC-002**: Il consumo crediti avviene in transazione DB atomica.

## 2. Decision Log Entries (da registrare prima dell'implementazione)

### DDD-137: CreditQuota — Ridefinizione di MonthlyQuota come credito

**Termine**: `CreditQuota` (alias canonico per `MonthlyQuota` ridefinito)
**Decisione**: `MonthlyQuota` viene ridefinito come "massimo numero di crediti mensili disponibili per un utente" invece di "massimo numero di richieste mensili". Il valore numerico rimane sulla colonna `monthly_quota` della tabella `users`. L'alias `CreditQuota` è il termine canonico per comunicazione e documentazione; `MonthlyQuota` rimane come backward-compat alias.
**Rationale**: Il sistema passa da quota basata su request-count a quota basata su crediti. Il campo DB non cambia nome per evitare migration distruttiva, ma la semantica cambia. L'alias `CreditQuota` rende esplicito il nuovo significato.
**Scope**: Usage/Quota, Generation, Frontend/UI
**Status**: registered
### DDD-138: MonthlyCreditsUsed — Sostituzione di MonthlyUsed

**Termine**: `MonthlyCreditsUsed`
**Decisione**: `MonthlyUsed` viene deprecato e sostituito da `MonthlyCreditsUsed`. La colonna DB `monthly_used` viene rinominata a `monthly_credits_used`. Un alias backward-compat `MonthlyUsed = MonthlyCreditsUsed` viene mantenuto per una transizione.
**Rationale**: Il contatore ora traccia crediti consumati, non richieste effettuate. Il rename esplicita la nuova semantica e previene confusione con il nuovo contatore artifact.
**Scope**: Usage/Quota, Generation
**Status**: registered
### DDD-139: CreditCost — Costo in crediti per Session Summary

**Termine**: `CreditCost`
**Decisione**: `CreditCost` è il Value Object che rappresenta il costo in crediti di una Session Summary per un dato tool. Il valore default è 1. Il costo è configurabile per tool in `packages/contracts/src/tool-workflows.ts` come campo `creditCost` su `ToolWorkflowDefinition`. Per ora hardcoded in contracts; configurazione runtime da admin è fuori scope per questo piano.
**Rationale**: Tool diversi possono avere costi diversi in base alla complessità. Centralizzare il costo in contracts garantisce coerenza FE/BE senza duplicazione.
**Scope**: Usage/Quota, Generation, Frontend/UI
**Status**: registered
### DDD-140: ArtifactGateLimit / ArtifactGateUsed — Gate invisibile per artifact

**Termine**: `ArtifactGateLimit`, `ArtifactGateUsed`
**Decisione**: Due nuovi Value Object nel contesto Usage/Quota. `ArtifactGateLimit` è il massimo numero di artifact generabili per mese (default 1000). `ArtifactGateUsed` è il contatore di artifact generati con SUCCESS nel mese corrente. Entrambi sono colonne sulla tabella `users` (`monthly_artifact_limit`, `monthly_artifacts_used`). Il gate è invisibile all'utente: le API non espongono questi valori nei response utente. Se il gate blocca una generazione, l'error contract mappa il motivo a `quota_exhausted` (l'utente vede "crediti esauriti").
**Rationale**: Serve un limite di sicurezza per prevenire abusi o bug che generano artifact in loop. Essendo invisibile, l'utente non deve preoccuparsi di due contatori separati.
**Scope**: Usage/Quota, Generation
**Status**: registered
### DDD-141: ConsumeCredits — Nuovo comando per consumo crediti post-SUCCESS

**Termine**: `ConsumeCredits`
**Decisione**: `ConsumeCredits` è il nuovo Command che scala i crediti dell'utente al SUCCESS di una Session Summary. Viene invocato dopo che l'ultimo artifact della sessione è stato finalizzato con successo. Il comando incrementa `MonthlyCreditsUsed` del `CreditCost` del tool e scrive una riga su `quota_history` con `cost_type = 'session_summary'`. A differenza di `ClaimUsage`, questo comando avviene **dopo** la generazione, non prima.
**Rationale**: I desiderata richiedono che i crediti si consumino "dopo aver completato sessionsummary". Questo separa la verifica di disponibilità (pre-generation) dal consumo effettivo (post-generation).
**Scope**: Usage/Quota, Generation
**Status**: registered
### DDD-142: RecordArtifactSuccess — Nuovo comando per gate invisibile

**Termine**: `RecordArtifactSuccess`
**Decisione**: `RecordArtifactSuccess` è il Command che incrementa `ArtifactGateUsed` di 1 al SUCCESS di ogni artifact. Viene invocato dopo la finalizzazione di ogni artifact con successo. Scrive una riga su `quota_history` con `cost_type = 'artifact'`. Se il gate è superato, il comando fallisce e l'artifact non viene finalizzato.
**Rationale**: Il gate artifact deve essere incrementato per ogni artifact creato, non per sessione. Questo permette di bloccare generazioni anche se i crediti sono disponibili ma il gate è saturato.
**Scope**: Usage/Quota, Generation
**Status**: registered
### DDD-143: ClaimUsage revision — Estensione semantica

**Termine**: `ClaimUsage` (revisione di DDD-005)
**Decisione**: `ClaimUsage` viene esteso per verificare due condizioni invece di una: (1) `ArtifactGateUsed < ArtifactGateLimit` (gate invisibile), (2) `MonthlyCreditsUsed + CreditCost <= MonthlyQuota` (crediti disponibili). **Non consuma più crediti** — il consumo avviene tramite `ConsumeCredits` post-SUCCESS. Se entrambe le condizioni sono soddisfatte, ritorna `{ granted: true, creditCost }`. Se una delle due fallisce, ritorna `{ granted: false, reason: 'quota_exhausted' }`.
**Rationale**: Separare verifica da consumo permette di non penalizzare l'utente se la generazione fallisce per motivi tecnici (timeout, errore LLM). Il credit viene consumato solo se la generazione ha successo.
**Scope**: Usage/Quota, Generation
**Status**: registered
## 3. Implementation Steps

### Implementation Phase 0 — DDD Alignment

- GOAL-000: Registrare decisioni DDD e aggiornare documenti canonici.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-000 | Registrare DDD-137–DDD-143 nel `docs/07-governance/domain-naming-decision-log.md`. (Nota: DDD-132–DDD-136 già assegnati, utilizzati ID successivi.) | ☑ | 2026-06-27 |
| TASK-001 | Aggiornare `docs/01-requirements/domain-ubiquitous-language-glossary.md`: ridefinire `MonthlyQuota` → `CreditQuota`, deprecare `MonthlyUsed` → `MonthlyCreditsUsed`, aggiungere `CreditCost`, `ArtifactGateLimit`, `ArtifactGateUsed`, `ConsumeCredits`, `RecordArtifactSuccess`. | ☑ | 2026-06-27 |
| TASK-002 | Aggiornare `docs/02-design/domain-bounded-context-map.md`: sezione Usage/Quota con nuovi contatori e comandi. | ☑ | 2026-06-27 |
| TASK-003 | Aggiornare glossary: aggiungere `MonthlyUsed` alla sezione Aliases And Deprecated Terms. | ☑ | 2026-06-27 |

### Implementation Phase 1 — Database Schema

- GOAL-001: Estendere schema DB per supportare crediti e gate artifact.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Creare migration `20260627_000021_quota_credits_and_artifact_gate.sql`: rinominare `monthly_used` → `monthly_credits_used`, aggiungere `monthly_artifact_limit` (default 1000), aggiungere `monthly_artifacts_used` (default 0), aggiungere constraint non-negativi. | ☑ | 2026-06-27 |
| TASK-005 | Estendere migration per `quota_history`: aggiungere `session_id text` (nullable), `cost_type text NOT NULL DEFAULT 'artifact'` CHECK IN ('session_summary', 'artifact'), `credit_cost integer NOT NULL DEFAULT 1`. | ☑ | 2026-06-27 |
| TASK-006 | Backfill: per utenti esistenti, `monthly_credits_used` = valore attuale di `monthly_used`, `monthly_artifact_limit` = 1000, `monthly_artifacts_used` = 0. (Handled by migration defaults + ALTER semantics.) | ☑ | 2026-06-27 |
| TASK-007 | Aggiornare seed data minimale per includere nuovi campi. | ☑ | 2026-06-27 |

### Implementation Phase 2 — Kysely Types + Contracts

- GOAL-002: Aggiornare tipi TypeScript e contracts.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | Aggiornare `apps/backend/src/lib/adapters/postgres-kysely.types.ts`: `UsersTable` con nuovi campi, `QuotaHistoryTable` con `session_id`, `cost_type`, `credit_cost`. | ☑ | 2026-06-27 |
| TASK-009 | Aggiungere `creditCost: number` a `ToolWorkflowDefinition` in `packages/contracts/src/tool-workflows.ts`. Default 1 per tutti i tool esistenti. | ☑ | 2026-06-27 |
| TASK-010 | Aggiornare `apps/backend/src/lib/types/auth.ts`: `AuthUserRecord` con `monthlyArtifactLimit`, `monthlyArtifactsUsed`. | ☑ | 2026-06-27 |
| TASK-011 | Aggiornare `apps/frontend/src/features/admin/runtime/admin-client.ts`: tipi admin per nuovi campi quota. | ☑ | 2026-06-27 |

### Implementation Phase 3 — Core Quota Enforcement

- GOAL-003: Riscrivere il motore di enforcement quota.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-012 | Riscrivere `PostgresRedisUsageRepository.claimUsage` in `apps/backend/src/lib/adapters/postgres-redis.usage.repository.ts`: verificare gate artifact + crediti disponibili, NON consumare crediti. Ritornare `{ granted: true, creditCost }` o `{ granted: false, reason: 'quota_exhausted' }`. | ☑ | 2026-06-27 |
| TASK-013 | Aggiungere metodo `consumeCredits(input: ConsumeCreditsInput)` a `PostgresRedisUsageRepository`: incrementare `monthly_credits_used` del `creditCost` del tool, scrivere su `quota_history` con `cost_type = 'session_summary'`. | ☑ | 2026-06-27 |
| TASK-014 | Aggiungere metodo `recordArtifactSuccess(input: RecordArtifactInput)` a `PostgresRedisUsageRepository`: incrementare `monthly_artifacts_used` di 1, verificare gate, scrivere su `quota_history` con `cost_type = 'artifact'`. | ☑ | 2026-06-27 |
| TASK-015 | Aggiornare `resolveClaimUsageDecision` in `postgres-redis.shared.ts` per gestire nuovi flag. | ☑ | 2026-06-27 |
| TASK-016 | Aggiornare `hasMonthWindowExpired` per usare mezzanotte UTC precisa del 1° del mese. | ☑ | 2026-06-27 |

### Implementation Phase 4 — Usage Machine + Generation System

- GOAL-004: Aggiornare macchine XState per nuovo flusso quota.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-017 | Aggiornare `apps/backend/src/lib/machines/usage.machine.ts`: input include `creditCost`, output include `creditCost` nel caso granted. | ☑ | 2026-06-27 |
| TASK-018 | Aggiornare `apps/backend/src/lib/types/xstate.ts`: aggiungere `ConsumeCreditsActorInput`, `RecordArtifactActorInput`, aggiornare `UsageActorInput`. | ☑ | 2026-06-27 |
| TASK-019 | Aggiornare `generation-system.request.states.ts`: dopo il SUCCESS dell'ultimo artifact della sessione, invocare `consumeCredits`. Dopo ogni artifact SUCCESS, invocare `recordArtifactSuccess`. | ☑ | 2026-06-27 |
| TASK-020 | Aggiornare `request-gateway.machine.ts`: il `usageCheck` ora verifica gate + crediti, non consuma. | ☑ | 2026-06-27 |

### Implementation Phase 5 — Artifact Repository

- GOAL-005: Aggiornare persistenza per nuovo flusso quota.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-021 | Aggiornare `finalizeSuccess` in `apps/backend/src/lib/adapters/postgres.artifact.repository.ts`: chiamare `recordArtifactSuccess` per ogni artifact, chiamare `consumeCredits` solo se è l'ultimo artifact della sessione. | ☑ | 2026-06-27 |
| TASK-022 | Aggiornare `finalizeFailure`: nessun cambiamento ai contatori (i crediti si consumano solo al SUCCESS). | ☑ | 2026-06-27 |
| TASK-023 | Aggiornare insert su `quota_history` con nuovi campi `session_id`, `cost_type`, `credit_cost`. | ☑ | 2026-06-27 |

### Implementation Phase 6 — In-Memory + Stub Adapters

- GOAL-006: Aggiornare implementazioni di test.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-024 | Aggiornare `createInMemoryGenerationAdapters` in `apps/backend/src/lib/adapters/generation.adapters.ts`: bucket quota per crediti + bucket separato per artifact gate. | ☑ | 2026-06-27 |
| TASK-025 | Aggiornare `RedisQuotaRepositoryStub` in `apps/backend/src/lib/adapters/postgres-redis.stub.ts`: supportare nuovi contatori. | ☑ | 2026-06-27 |

### Implementation Phase 7 — Admin UI + Auth

- GOAL-007: Aggiornare superfici admin e auth per nuovi campi.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-026 | Aggiornare `apps/backend/src/lib/adapters/auth.production.ts`: create/update user per `monthlyArtifactLimit`. | ☑ | 2026-06-27 |
| TASK-027 | Aggiornare `apps/backend/src/lib/runtime/auth-http/admin-user-handlers.ts`: passare `monthlyArtifactLimit` da request body. | ☑ | 2026-06-27 |
| TASK-028 | Aggiornare `apps/backend/src/lib/runtime/auth-http/support.ts`: esporre `monthlyArtifactLimit` e `monthlyArtifactsUsed` nelle risposte API (solo per admin). | ☑ | 2026-06-27 |
| TASK-029 | Aggiornare `apps/frontend/src/features/admin/runtime/admin-user-form.ts`: campo `monthlyArtifactLimit` (visibile solo ad admin). | ☑ | 2026-06-27 |
| TASK-030 | Aggiornare `apps/frontend/src/features/admin/runtime/useAdminUsersMutations.ts`: mutation per nuovi campi. | ☑ | 2026-06-27 |
| TASK-031 | Aggiornare `apps/frontend/src/app/copy/system.ts`: etichette per nuovi campi (`monthlyQuota` → "Crediti mensili", nuovo campo "Limite artefatti"). | ☑ | 2026-06-27 |

### Implementation Phase 8 — Frontend User Display

- GOAL-008: Aggiornare display quota utente.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-032 | Aggiornare display quota utente per mostrare "Crediti disponibili: X/Y" invece di "Generazioni usate: X/Y". | ☑ | 2026-06-27 |
| TASK-033 | Rimuovere conteggio artifact dalla UI utente (resta gate invisibile). | ☑ | 2026-06-27 |
| TASK-034 | Aggiornare dashboard widget quota per riflettere nuovo modello crediti. | ☑ | 2026-06-27 |

### Implementation Phase 9 — Validation + Quality Gate

- GOAL-009: Verifica completa.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-035 | Eseguire `npm run typecheck` (workspace). | ☑ | 2026-06-27 |
| TASK-036 | Eseguire `npm run test` (workspace). | ☑ | 2026-06-27 |
| TASK-037 | Eseguire smoke test con DB live (`npm run test:smoke`). | ☑ | 2026-06-27 (idempotency ✅, conflict ⚠️ Redis unreachable, query/nonstreaming skipped) |
| TASK-038 | Verificare che il reset mensile avvenga correttamente a mezzanotte UTC. | ☑ | 2026-06-27 |
| TASK-039 | Verificare che il gate artifact blocchi correttamente quando saturato. | ☑ | 2026-06-27 |
| TASK-040 | Verificare che i crediti si consumino solo al SUCCESS della sessione. | ☑ | 2026-06-27 |

## 4. Alternatives

- **ALT-001**: Consumare crediti al pre-claim (come ora) con refund se la generazione fallisce. Scartata: complessità di refund e race condition; il modello post-SUCCESS è più pulito.
- **ALT-002**: Tabella DB separata per `tool_credit_settings` invece di contracts. Scartata per fase 1: contracts-first è più semplice e sufficiente per l'MVP. Configurazione runtime da admin può essere aggiunta in fase successiva.
- **ALT-003**: Reset schedulato via cron job invece di lazy reset. Scartata: il lazy reset è funzionalmente corretto e più semplice. Il boundary è preciso a mezzanotte UTC.
- **ALT-004**: Esporre il gate artifact all'utente. Scartata: i desiderata richiedono esplicitamente che il gate sia invisibile.

## 5. Dependencies

- **DEP-001**: Coerenza con `ToolWorkflowDefinition` in `packages/contracts/src/tool-workflows.ts`.
- **DEP-002**: Coerenza con `UsageAdapter` interface in `apps/backend/src/lib/adapters/generation.adapters.ts`.
- **DEP-003**: Coerenza con `GenerationSystem` machine in `apps/backend/src/lib/machines/generation-system.machine.ts`.
- **DEP-004**: Aggiornamento documentazione canonica DDD prima delle modifiche applicative (Phase 0).
- **DEP-005**: Migrazione DB deve essere backward-compatible: utenti esistenti mantengono i loro dati.

## 6. Files

- **FILE-001**: `docs/07-governance/domain-naming-decision-log.md` — decisioni DDD-137–DDD-143.
- **FILE-002**: `docs/01-requirements/domain-ubiquitous-language-glossary.md` — aggiornamento termini Usage/Quota.
- **FILE-003**: `docs/02-design/domain-bounded-context-map.md` — sezione Usage/Quota aggiornata.
- **FILE-004**: `packages/infra-db/migrations/` — nuova migration per crediti + gate artifact.
- **FILE-005**: `packages/infra-db/seeds/` — seed data aggiornato.
- **FILE-006**: `apps/backend/src/lib/adapters/postgres-kysely.types.ts` — tipi Kysely aggiornati.
- **FILE-007**: `packages/contracts/src/tool-workflows.ts` — campo `creditCost` su tool definitions.
- **FILE-008**: `apps/backend/src/lib/adapters/postgres-redis.usage.repository.ts` — core enforcement riscritto.
- **FILE-009**: `apps/backend/src/lib/adapters/postgres-redis.shared.ts` — decision resolution aggiornata.
- **FILE-010**: `apps/backend/src/lib/machines/usage.machine.ts` — input/output aggiornati.
- **FILE-011**: `apps/backend/src/lib/types/xstate.ts` — nuovi input types.
- **FILE-012**: `apps/backend/src/lib/machines/generation-system.request.states.ts` — consumo crediti post-SUCCESS.
- **FILE-013**: `apps/backend/src/lib/adapters/postgres.artifact.repository.ts` — finalizeSuccess/failure aggiornati.
- **FILE-014**: `apps/backend/src/lib/adapters/generation.adapters.ts` — in-memory adapter aggiornato.
- **FILE-015**: `apps/backend/src/lib/adapters/postgres-redis.stub.ts` — stub adapter aggiornato.
- **FILE-016**: `apps/backend/src/lib/adapters/auth.production.ts` — auth adapter aggiornato.
- **FILE-017**: `apps/backend/src/lib/runtime/auth-http/admin-user-handlers.ts` — admin handlers aggiornati.
- **FILE-018**: `apps/backend/src/lib/runtime/auth-http/support.ts` — response mapping aggiornato.
- **FILE-019**: `apps/backend/src/lib/types/auth.ts` — tipi auth aggiornati.
- **FILE-020**: `apps/frontend/src/features/admin/runtime/admin-client.ts` — tipi admin aggiornati.
- **FILE-021**: `apps/frontend/src/features/admin/runtime/admin-user-form.ts` — form admin aggiornato.
- **FILE-022**: `apps/frontend/src/features/admin/runtime/useAdminUsersMutations.ts` — mutations aggiornate.
- **FILE-023**: `apps/frontend/src/app/copy/system.ts` — copy aggiornata.
- **FILE-024**: `apps/backend/src/lib/tests/` — test aggiornati per nuovo flusso quota.

## 7. Testing

- **TEST-001**: Unit test per `claimUsage` con verifica gate + crediti (nessun consumo).
- **TEST-002**: Unit test per `consumeCredits` — consumo solo al SUCCESS.
- **TEST-003**: Unit test per `recordArtifactSuccess` — incremento gate 1:1.
- **TEST-004**: Integration test per flusso completo: pre-claim → generazione → SUCCESS → consumeCredits + recordArtifactSuccess.
- **TEST-005**: Integration test per flusso failure: pre-claim → generazione → FAILURE → nessun consumo.
- **TEST-006**: Test reset mensile: verificare che a mezzanotte UTC del 1° i contatori si resettino.
- **TEST-007**: Test gate artifact saturato: generazione bloccata con reason `quota_exhausted`.
- **TEST-008**: Test crediti saturati: generazione bloccata con reason `quota_exhausted`.
- **TEST-009**: Test admin CRUD: create/update user con `monthlyArtifactLimit`.
- **TEST-010**: Smoke test con DB live per verificare scrittura `quota_history` con nuovi campi.
- **TEST-011**: Regression test per flussi esistenti (funnel-pages, nextland, youtube-lf-script, etc.).

## 8. Risks & Assumptions

- **RISK-001**: Se una generazione fallisce dopo il pre-claim ma prima del SUCCESS, l'utente non consuma crediti. Questo è il comportamento desiderato ma potrebbe sembrare "gratis" per tentativi falliti.
- **RISK-002**: Il gate artifact invisibile potrebbe confondere se un utente ha crediti ma non può generare. Mitigazione: log server-side per debug admin.
- **RISK-003**: Migrazione DB con rename di colonna `monthly_used` → `monthly_credits_used` richiede attenzione per evitare downtime.
- **RISK-004**: Il lazy reset potrebbe non resettare esattamente a mezzanotte se un utente non effettua richieste nel nuovo mese. Funzionalmente corretto ma temporalmente impreciso.
- **ASSUMPTION-001**: I tool esistenti hanno tutti `creditCost = 1` come default.
- **ASSUMPTION-002**: Il costo crediti non sarà configurabile da admin in fase 1 (solo contracts).
- **ASSUMPTION-003**: Il gate artifact default è 1000 — sufficientemente alto da non essere mai raggiunto in condizioni normali.
- **ASSUMPTION-004**: La sessione summary è definita come il gruppo di artifact con lo stesso `sessionId` — il consumo crediti avviene quando l'ultimo artifact della sessione completa con SUCCESS.

## 9. Ordine di Esecuzione Consigliato

1. **Phase 0** (DDD alignment) — bloccante per tutto il resto
2. **Phase 1** (DB migration) → **Phase 2** (Kysely + Contracts) — foundation layer
3. **Phase 3** (Core enforcement) → **Phase 4** (XState machines) → **Phase 5** (Artifact repository) — backend core
4. **Phase 6** (Test adapters) — test infrastructure
5. **Phase 7** (Admin UI) → **Phase 8** (Frontend display) — user-facing
6. **Phase 9** (Validation) — quality gate finale

## 11. Post-Implementation Exceptions

### BUG-001: Extraction flow hang dopo Phase 4 — `recordingUsage`/`consumingCredits` invocati per tutti i SUCCESS

**Problema**: Dopo l'implementazione di Phase 4, i nuovi stati `recordingUsage` e `consumingCredits` nel flusso di persistenza (`generation-system.persistence.states.ts`) venivano invocati per TUTTI i percorsi SUCCESS, inclusa extraction (`routeType === 'extraction'`). Extraction non è una Session Summary e non dovrebbe consumare crediti né registrare artifact success. Il flusso si bloccava silenziosamente dopo `[gen][session-start]` senza mai raggiungere `[gen][session-terminal]`, lasciando il frontend in stato `primaryActionPolicy: "disabled"`.

**Causa root**: `finalizeIdempotencySuccess` → `recordingUsage` → `consumingCredits` → `completed` era un percorso lineare senza guardie. Per extraction, `consumeCredits` tentava di incrementare crediti con `workflowType = 'extraction'` (non un tool), e la risoluzione del `creditCost` falliva silenziosamente.

**Fix**: Aggiunto stato intermedio `routeAfterIdempotency` con guardia su `context.routeType === 'extraction'`. Se extraction, salta direttamente a `completed` bypassando `recordingUsage` e `consumingCredits`. File modificato: `apps/backend/src/lib/machines/generation-system.persistence.states.ts`.

**Lezione**: I nuovi stati di consumo crediti devono essere scope-specific — solo i flussi tool/session-summary devono passare per `recordingUsage`/`consumingCredits`. I flussi non-tool (extraction, generic) bypassano il consumo.

---

## 10. Related Specifications / Further Reading

- [Domain Ubiquitous Language Glossary](../../../01-requirements/domain-ubiquitous-language-glossary.md)
- [Domain Bounded Context Map](../../../02-design/domain-bounded-context-map.md)
- [Domain Naming Decision Log](../../../07-governance/domain-naming-decision-log.md)
- [Tool Generation Flow Source of Truth Spec](../../../02-design/specifications/tool-generation-flow-source-of-truth-spec.md)
- [Tool Page Frontend Runtime Spec](../../../02-design/specifications/tool-page-frontend-runtime-spec.md)
