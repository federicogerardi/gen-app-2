---
status: draft
version: 1.0
date_created: 2026-07-11
last-reviewed: 2026-07-11
next-review-date: 2026-10-11
owner: Frontend Platform Team & Domain Architecture
title: Enterprise-Grade Tool Output Personalization Implementation Plan
type: feature-plan
tags: [plan, personalization, tools, ux, generation, variants, feedback, hitl]
goal: Implement tool output personalization, multi-variant generation, interactive steps, and RAG-lite feedback injection.
---

# Enterprise-Grade Tool Output Personalization Implementation Plan

## Introduction

Questo piano definisce i passaggi operativi per implementare la proposal approvata in `docs/02-design/proposal-tool-output-personalization.md`. L'obiettivo è superare il limite dell'output "1-to-1" deterministico introducendo personalizzazione guidata da registry, fan-out di varianti, passaggi interattivi (Human-In-The-Loop) e iniezione di contesto tramite RAG-lite.

Tutte le 15 decisioni architetturali e i parametri per-tool sono stati approvati nel processo DDD (DDD-160, 161, 162, 163, 164, 165, 166, 170, 171, 173, 174).

---

## 1. Phase 1: Foundations & Registry (P0)

**Effort:** Medium (3-4 giorni) | **Sequenza:** Serial

### Obiettivo
Sostituire la validazione Zod hardcoded e le regole di rendering condizionali con un'infrastruttura di personalizzazione *registry-driven*. 

| Task | Descrizione | File Principali | Verifica |
|---|---|---|---|
| **TASK-1.1** | Aggiungere il tipo `PersonalizationFieldDef` e il campo `personalizationFields?: readonly PersonalizationFieldDef[]` in `ToolWorkflowDefinition`. Aggiungere `personalizationOverrides?: Record<string, unknown>` in `GenerationRequestInput`. | `packages/contracts/src/tool-workflows.ts`<br>`packages/contracts/src/index.ts` | `npm run typecheck` **[BREAKING-GATE]** |
| **TASK-1.2** | Registrare i campi di personalizzazione per `angle-generator`, `meta-ads`, `geometric`, e `blog-article-generator` nel registry in base alla proposal. | `packages/contracts/src/tool-workflows.ts` | Verifica assenza di errori TS nei registry |
| **TASK-1.3** | Aggiungere copy per le label dei nuovi campi in `appCopy.ui.toolPage.personalization`, brand profile, primary action policy, status labels e interactive steps. | `apps/frontend/src/app/copy/system.ts` | Esecuzione con successo UI locale |
| **TASK-1.4** | Estendere `CanonicalToolUiState` e `PrimaryActionPolicy` con lo stato `'awaiting-approval'`. Aggiungere `pendingInputStep` e `variantCount` al `ToolPageViewModel`. Aggiornare map states e derivazioni. | `apps/frontend/src/features/generation/ui/tool-ux-state.ts`<br>`apps/frontend/src/features/tools/machines/tool-page-view-model.ts` | `npm run typecheck && npm --workspace apps/frontend run test` **[BREAKING-GATE]** |
| **TASK-1.5** | Costruire `<DynamicPersonalizationForm />` (renderizza select, slider, checkbox controllati via RHF, emette `personalizationOverrides`). Disabilitato quando `isFormLocked`. | `apps/frontend/src/features/tools/ui/DynamicPersonalizationForm.tsx` (NEW) | Test unitari componente |
| **TASK-1.6** | Integrare `DynamicPersonalizationForm` in `ToolPageTemplate`. Sostituire vecchi blocchi di codice UI specifici per i 4 tool (sostituzione Zod locale con schema generato). | `apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx` | Test su ToolPageTemplate |
| **TASK-1.7** | Estendere backend `resolveToolPrompt` per interpretare `personalizationOverrides` e appendere dinamicamente il blocco `<personalization_directives>`. | `apps/backend/src/lib/runtime/tool-prompts/index.ts` | `npm --workspace apps/backend run test -- runtime.tool-prompts` |

---

## 2. Phase 2: Project Brand Persona (P0)

**Effort:** Low (1-2 giorni) | **Sequenza:** Parallela a Phase 4

### Obiettivo
Permettere di definire Brand Voice e Tone a livello di Progetto, da iniettare implicitamente in tutti i prompt.

| Task | Descrizione | File Principali | Verifica |
|---|---|---|---|
| **TASK-2.1** | Creare DB migration per la tabella `project_brand_personas` (FK `project_id`). | `packages/infra-db/migrations/..._project_brand_personas.sql` | Migration eseguita senza errori |
| **TASK-2.2** | Creare Adapter `getBrandPersonaByProject` e `upsertBrandPersona` usando Kysely. | `apps/backend/src/lib/adapters/generation.adapters.ts` (o dedicato) | Typecheck backend |
| **TASK-2.3** | Creare HTTP routes `GET /api/projects/:projectId/brand-persona` e `PUT /api/projects/:projectId/brand-persona` (con controllo ownership). | `apps/backend/src/lib/runtime/auth-http/route-table.ts` e handlers | Unit/Integration Test |
| **TASK-2.4** | Aggiungere fetch e inject implicito nel backend (blocco `<brand_persona_context>`) nel flow della richiesta. | `apps/backend/src/lib/machines/generation-system.actors.ts` o similari | Test di end-to-end con prompt generati |
| **TASK-2.5** | Sviluppare `ProjectBrandProfilePage` in FE con SWR fetch/patch. Includere collegamento in UI (ProjectDetailPage). | `apps/frontend/src/features/projects/pages/ProjectBrandProfilePage.tsx` (NEW) | Visualizzazione su route `/dashboard/projects/:id/brand` |

---

## 3. Phase 4: Variant N-Sequential Fan-Out (P1)

**Effort:** Medium (3-4 giorni) | **Sequenza:** Parallela a Phase 2
*(Nota: Rinominato Phase 4 temporaneamente nel plan per chiarezza di esecuzione sequenziale rispetto ad implementazioni HITL)*

### Obiettivo
Consentire l'esecuzione seriale lato client di N varianti, preservando l'integrità del pool DB e dell'idempotency.

| Task | Descrizione | File Principali | Verifica |
|---|---|---|---|
| **TASK-4.1** | Aggiungere `variantCount?: number` e `variantSeed?: number` a `GenerationRequestInput` nel contratto. | `packages/contracts/src/index.ts` | `npm run typecheck` **[BREAKING-GATE]** |
| **TASK-4.2** | Modificare l'Idempotency Coordinator per accodare `:v{variantSeed}` alla key generata se fornito. | `apps/backend/src/lib/adapters/generation.adapters.ts` | Nessun conflitto inviando varianti parallele testate manualmente |
| **TASK-4.3** | Costruire custom hook FE `useVariantGeneration` per orchestrare `variantCount` loop seriale: `run 0` -> `completed` -> `run 1`... Aggiornare artifacts state. | `apps/frontend/src/features/tools/runtime/useVariantGeneration.ts` (NEW) | Test hook o manual verification flow |
| **TASK-4.4** | Aggiungere `VariantCountSelector` nel `DynamicPersonalizationForm` FE (per i tool con `variantCount` definito), indicando inline il costo (`{N} varianti = {N * creditCost} crediti`). Se crediti scarsi, disabilitare bottone. | `apps/frontend/src/features/tools/ui/DynamicPersonalizationForm.tsx` | Verifica UI aggiornamento counter crediti |
| **TASK-4.5** | Sviluppare `VariantComparisonView` con MUI Tabs. Aggiungere CTA "Scegli questa variante" ed emit `VARIANT_SELECTED`. | `apps/frontend/src/features/tools/ui/VariantComparisonView.tsx` (NEW) | Render in `ToolGenerationFlowVertical` quando `canonicalState === 'completed'` |

---

## 4. Phase 3: HITL Interactive Steps (P1)

**Effort:** High (4-5 giorni) | **Sequenza:** Serial dopo Phase 1

### Obiettivo
Aggiungere il tipo di passaggio `interactive` con API di sottomissione manuale (Pilot: `blog-article-generator`).

| Task | Descrizione | File Principali | Verifica |
|---|---|---|---|
| **TASK-3.1** | Aggiungere tipo `'interactive'` a `WorkflowStepType`. Migration DB per aggiornare constraint `workflow_step_type_check`. | `apps/backend/src/lib/types/xstate.ts`<br>`packages/infra-db/migrations/` | `npm run typecheck` + Migration applicata **[BREAKING-GATE]** |
| **TASK-3.2** | Aggiornare `toolWorkflowMachine` per far transizionare la macchina a `idle_pending_input` dopo un task `interactive`. Configurare transizione via evento `APPROVE_INTERACTIVE_STEP`. | `apps/backend/src/lib/machines/tool-workflow.machine.ts` | Test di transizione XState locale |
| **TASK-3.3** | Scrivere API `POST /api/tools/sessions/:sessionId/step/:stepKey/submit` per riprendere lo step salvando l'edited context e lanciare l'evento `APPROVE_INTERACTIVE_STEP` alla macchina XState in attesa. | `apps/backend/src/lib/runtime/auth-http/auth-http-tools-routes.ts` | Integration testing endpoint API |
| **TASK-3.4** | Registrare `blog_seo_structure` e un nuovo pre-step `hook-library` (per `meta-ads`) come type: `interactive` in registry. | `packages/contracts/src/tool-workflows.ts` | Typecheck |
| **TASK-3.5** | Gestire in FE (`tool-page.machine.ts`) il terminal event SSE `stepType: 'interactive'`. Settare `pendingInputStep` in context. Aggiungere evento `MANUAL_APPROVAL_SUBMITTED` per invocare l'API e sbloccare workflow. | `apps/frontend/src/features/tools/machines/tool-page.machine.ts` | Event processing testuale |
| **TASK-3.6** | Sviluppare `<InteractiveStepEditor />` (Markdown editor + Action CTAs) per sostituire il progress component del `ToolGenerationFlowVertical` quando in `'awaiting-approval'`. | `apps/frontend/src/features/tools/ui/InteractiveStepEditor.tsx` (NEW) | Test UI interattivo |

---

## 5. Phase 5: Feedback & RAG-lite (P2)

**Effort:** Medium (2-3 giorni) | **Sequenza:** Serial post Phase 1 & 2

### Obiettivo
Tracciare le performance per tool/progetto (👍/👎) e iniettare via RAG gli output positivi come esempi ai futuri prompt LLM.

| Task | Descrizione | File Principali | Verifica |
|---|---|---|---|
| **TASK-5.1** | DB Migration `generation_feedback` con FKs e indice composto per RAG (`idx_gen_feedback_rag`). | `packages/infra-db/migrations/..._generation_feedback.sql` | Migration applicata |
| **TASK-5.2** | Creare API `POST /api/user/profile/feedback` per registrare il record (valida ownership, upsert rating). | `apps/backend/src/lib/runtime/auth-http/route-table.ts` | Test handler HTTP |
| **TASK-5.3** | Sviluppare il componente `<MiniFeedback />` (👍 / 👎 buttons). Renderizzare in `ToolGenerationFlowVertical` se `completed`. Bloccare read-only dopo voto. | `apps/frontend/src/features/tools/ui/MiniFeedback.tsx` (NEW) | Verifica componente interattiva |
| **TASK-5.4** | Implementare query Backend RAG prima della creazione prompt: cerca ultimi 2 artefatti "positive" per tool_key+project_id, inserire nel prompt sotto tag `<examples>...</examples>`. Skip se fail. | `apps/backend/src/lib/runtime/tool-prompts/index.ts` o simile | Controllare che prompt LLM finali contengano template block |

---

## Conclusion & Governance Check

Questo piano riflette accuratamente le approvazioni DDD. 

**Ordine consigliato:**
`Phase 1` -> Paralleli (`Phase 2` + `Phase 4`) -> `Phase 3` -> `Phase 5`

**Next steps operativi:** Procedere al primo PR per **Phase 1** definendo la contrattualizzazione nei workspaces comuni (`packages/contracts`) prima di spostarsi al rendering dinamico frontend.
