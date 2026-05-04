---
goal: BCM Tool Cluster Consistency Patch — 4 Inconsistencies + 2 UL Coverage Gaps (2026-05-04 Audit)
version: 1.0
date_created: 2026-05-04
last_updated: 2026-05-04
owner: Domain Architecture
status: pending
tags: [ddd, ubiquitous-language, bcm, documentation, tool, toolkey, refactor-target]
---

# Introduction

![Status: Pending](https://img.shields.io/badge/status-Pending-yellow)

Piano di patching documentale derivato dall'audit di coerenza BCM/UL del cluster **Tool** eseguito il 2026-05-04.

L'audit ha identificato:
- **4 inconsistenze** nel Bounded Context Map (`docs/02-design/domain-bounded-context-map.md`) rispetto al glossario aggiornato (v1.7) e alle decisioni DDD-029, DDD-030, DDD-031
- **2 gap di coverage funzionale** nell'Ubiquitous Language: un flow senza termine canonico (`ToolStepOrchestration` assente dal BCM) e un flow completamente non nominato (request assembly FE → `GenerationRequest`)

Tutte le modifiche sono **documentation-only** — nessuna modifica a codice sorgente.

---

## 1. Requirements & Constraints

- **REQ-001**: Portare il BCM in stato consistente con il glossario v1.7 (termini `ToolKey` cross-context, `ToolFormKey`, `ToolStepOrchestration`, `meta_ads` deprecated).
- **REQ-002**: Nessuna modifica a codice sorgente — scope esclusivo `docs/` e `.github/instructions/`.
- **REQ-003**: I termini introdotti nel BCM devono già avere entry nel decision log. Non aggiungere nuovi termini non ancora registrati.
- **REQ-004**: Prima di ogni patch BCM verificare il termine target nel glossario v1.7 e nel decision log v1.8.
- **CON-001**: Le fasi 1–3 (inconsistenze) sono indipendenti e applicabili in parallelo. La fase 4 (gap coverage request assembly) richiede un DDD-032 nel decision log prima di aggiungere il termine al glossario.
- **GUD-001**: Applicare un riferimento DDD-NNN esplicito per ogni termine modificato nella riga BCM.
- **GUD-002**: Non riscrivere intere sezioni BCM — patch mirate alle righe impattate.

---

## 2. Implementation Steps

### Phase 1 — BCM Shared Concepts: patch riga `ToolWorkflow / ToolKey`

**Priority: 🔴 ALTA**

- GOAL-001: Allineare la riga Shared Concepts `ToolWorkflow / ToolKey` a DDD-029 e DDD-030.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | In `docs/02-design/domain-bounded-context-map.md`, nella tabella Shared Concepts And Translation Rules, aggiornare la riga `ToolWorkflow / ToolKey`: (1) rimuovere "`meta_ads` exists only in `ToolWorkflow` (no FE `SupportedTool` counterpart)" — sostituire con nota deprecazione DDD-030; (2) aggiornare il framing da "Two orthogonal identifiers" a framing che riflette `ToolKey` come cross-context canonical (DDD-029); (3) cambiare "See DDD-025" → "See DDD-029". | ☐ | — |
| TASK-002 | Verificare che il testo aggiornato sia coerente con la riga `Tool` nella stessa tabella (nessuna contraddizione). | ☐ | — |
| TASK-003 | Bumpa versione BCM → 1.6. | ☐ | — |

**Contenuto target** per la cella Translation Rule della riga `ToolWorkflow / ToolKey`:

> `ToolKey` is the cross-context canonical identifier for Tool identity (DDD-029). At the Generation ↔ Frontend/UI boundary: `SupportedTool` (Frontend, kebab-case) is passed as the `toolKey` field in `GenerationRequest` — no value transformation required. `ToolWorkflow` (Generation, snake_case, DB-compatible) is derived independently for artifact routing and is not the same concept as `ToolKey`. `meta_ads` is deprecated and must be removed from `ToolWorkflow` value sets (DDD-030). Convention divergence between kebab and snake_case: DDD-C-005 (open). See DDD-029, DDD-030.

---

### Phase 2 — BCM Shared Concepts: patch riga `Tool`

**Priority: 🟡 MEDIA**

- GOAL-002: Correggere il framing della riga `Tool` che attribuisce `ToolKey` solo a Generation.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | In `docs/02-design/domain-bounded-context-map.md`, nella tabella Shared Concepts And Translation Rules, riga `Tool`: cambiare "Generation routes via `ToolWorkflow` and **orchestrates steps via `ToolKey`**" → "Generation routes via `ToolWorkflow`; `ToolKey` is the cross-context canonical identifier expressed in both layers — `SupportedTool` (Frontend) and `toolKey` field in `GenerationRequest` (Generation)". | ☐ | — |
| TASK-005 | Verificare che il riferimento a `WorkflowStepType` nella stessa riga sia ancora accurato dopo la modifica. | ☐ | — |

---

### Phase 3 — BCM Frontend/UI: patch organizing concept + Integration Constraints

**Priority: 🟡 MEDIA**

- GOAL-003: Allineare il testo "organizing concept" del Frontend/UI context alla terminologia DDD-029.
- GOAL-004: Aggiungere `ToolStepOrchestration` (DDD-031) alla sezione Integration Constraints.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | In `docs/02-design/domain-bounded-context-map.md`, sezione Frontend/UI Context, campo "Organizing concept": cambiare "`SupportedTool` is the Frontend-context identifier for a `Tool` (DDD-026)" → "`SupportedTool` is the Frontend-layer projection of `ToolKey` (DDD-029, cross-context canonical). Frontend owns the interaction layer of a Tool: input intake, step selection, readiness check, and artifact display. `ToolFormKey` (`keyof typeof toolFormRegistry`) is the FE form registry implementation type — not a domain term." | ☐ | — |
| TASK-007 | In `docs/02-design/domain-bounded-context-map.md`, tabella Integration Constraints, aggiungere riga: Constraint = `ToolStepOrchestration` target pattern; Contexts = Generation ↔ Frontend/UI; Rule = Step dependency resolution at dispatch time must route through `resolveStepDependencyIds` (BE) via `/api/tools/orchestrate` endpoint. FE `orchestrateToolStep` (`tools-client.ts:339`) is the intended adapter — currently zero runtime callers (DDD-C-007). FE `getStepDependencies` is the current production implementation but is flagged as architecture drift. Resolution: see DDD-031 (provisional term `ToolStepOrchestration`); Decision = DDD-031, DDD-C-007. | ☐ | — |

---

### Phase 4 — UL Gap: request assembly FE → GenerationRequest (nuovo termine)

**Priority: 🟡 MEDIA — richiede decisione DDD prima di patch**

- GOAL-005: Colmare il gap UL per il flow di costruzione del `GenerationRequest` da stato FE (`HydrationResult + ExtractionContext + ToolStep`).

**Contesto**: La logica di composizione di un `GenerationRequest` da stato FE è implementata in ~216 righe di `tools-client.ts:113-329` ma non ha un termine UL canonico. In ottica BE-first, questo blocco è un candidato a diventare un'operazione BE o almeno ad avere un nome domain.

**Candidati terminologici** da valutare prima dell'implementazione:

| Candidato | Tipo | Rationale | Contesto preferito |
|-----------|------|-----------|-------------------|
| `GenerationRequestAssembly` | Command/Process | Nomina esplicitamente il processo di composizione del request | Frontend/UI → Generation |
| `ToolDispatchContext` | Value Object | L'oggetto aggregato che il FE raccoglie prima del dispatch (HydrationResult + ExtractionContext + ToolStep) | Frontend/UI |
| `RequestComposer` | Domain Service (FE, provisional) | Il componente FE responsabile dell'assemblaggio del request | Frontend/UI |

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | Aprire discussione con utente sul termine candidato preferito tra i tre sopra. | ☐ | — |
| TASK-009 | Una volta scelto il termine, creare entry DDD-032 nel decision log (`docs/07-governance/domain-naming-decision-log.md`) con decisione, rationale, scope. | ☐ | — |
| TASK-010 | Aggiungere il termine al glossario (`docs/01-requirements/domain-ubiquitous-language-glossary.md`) nella sezione del bounded context appropriato (Frontend/UI o Cross-Context). | ☐ | — |
| TASK-011 | Aggiungere una riga alla tabella Shared Concepts And Translation Rules nel BCM che descriva il flow FE → BE per il request assembly. | ☐ | — |

---

## 3. Acceptance Gates

| Gate | Check | Phase |
|------|-------|-------|
| GATE-001 | BCM riga `ToolWorkflow / ToolKey` non menziona `meta_ads` come valore attivo; punta a DDD-029 e DDD-030. | Phase 1 |
| GATE-002 | BCM riga `Tool` non attribuisce `ToolKey` come esclusivo di Generation. | Phase 2 |
| GATE-003 | BCM Frontend/UI organizing concept riflette `SupportedTool` come proiezione di `ToolKey`. | Phase 3 |
| GATE-004 | BCM Integration Constraints contiene riga `ToolStepOrchestration` con riferimento DDD-031. | Phase 3 |
| GATE-005 | DDD-032 registrato prima di qualsiasi patch glossario/BCM per il termine request assembly. | Phase 4 |
| GATE-006 | Nessuna contraddizione interna nel BCM tra le righe `Tool`, `ToolWorkflow / ToolKey`, e la sezione Frontend/UI. | tutte |

---

## 4. Audit Evidence

Origine: analisi BCM/UL coherence cluster Tool — 2026-05-04.

**Inconsistenze rilevate:**

| ID | Gravità | Posizione BCM | Problema | Decisione correlata |
|----|---------|--------------|---------|-------------------|
| I-001 | 🔴 ALTA | Shared Concepts riga `ToolWorkflow / ToolKey` | Menziona `meta_ads` come attivo; framing "orthogonal"; punta a DDD-025 stale | DDD-029, DDD-030 |
| I-002 | 🟡 MEDIA | Shared Concepts riga `Tool` | `ToolKey` attribuito solo a Generation | DDD-029 |
| I-003 | 🟡 MEDIA | Frontend/UI organizing concept | `SupportedTool` come "identifier for Tool" anziché "projection of ToolKey" | DDD-029 |
| I-004 | 🟡 MEDIA | Integration Constraints (assenza) | `ToolStepOrchestration` non nominato | DDD-031 |

**Gap coverage flow:**

| ID | Flow | Stato |
|----|------|-------|
| G-001 | Step dependency resolution dispatch | Termine `ToolStepOrchestration` provisional in glossario ma assente da BCM Integration Constraints |
| G-002 | Request assembly FE → `GenerationRequest` | Nessun termine UL; 216 righe non nominate (`tools-client.ts:113-329`) |
