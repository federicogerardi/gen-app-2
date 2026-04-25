---
goal: Piano GO frontend tool di generazione con upload brief, extraction persistita e completion Funnel/Nextland
version: 1.0
date_created: 2026-04-25
last_updated: 2026-04-25
owner: Federico
status: In Progress
tags: [feature, frontend, backend, tool, extraction, upload, go-live]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Questo piano definisce le attivita necessarie per portare i tool frontend di generazione allo stato GO, completando il flusso end-to-end: upload brief utente, extraction strutturata con persistenza artifact in database, uso dei dati estratti per avvio generazione, e conclusione workflow per Funnel e Nextland.

## 1. Requirements & Constraints

- **REQ-001**: Implementare upload brief utente da interfaccia tool con supporto formati `.docx`, `.txt`, `.md`.
- **REQ-002**: Introdurre endpoint backend autenticato per ingest brief e risposta con `briefingId` tracciabile.
- **REQ-003**: Implementare extraction machine reale che usa prompt di extraction fornito dal product owner.
- **REQ-004**: Salvare risultato extraction come artifact DB (`type='extraction'`) con `input_json` strutturato.
- **REQ-005**: Implementare passaggio deterministic dei dati estratti verso il flusso di generazione tool-step.
- **REQ-006**: Eseguire workflow multi-step completo per Funnel (`optin -> quiz -> vsl`) e Nextland (`landing -> thank_you`).
- **REQ-007**: Aggiornare UI tool per stati `uploading`, `extracting`, `review`, `generating`, `done`, `failed` con blocchi e retry coerenti.
- **REQ-008**: Abilitare capability runtime `toolsUpload` in configurazione deployment GO.
- **SEC-001**: Applicare autenticazione sessione e ownership check su tutte le API tools (`userId/projectId`).
- **SEC-002**: Applicare validazione MIME/estensione/size lato server con fail-closed su input non valido.
- **SEC-003**: Mantenere protezione CSRF su endpoint state-changing non esclusi.
- **SEC-004**: Non loggare contenuti completi del brief in log applicativi; loggare solo metadati/correlation id.
- **CON-001**: Non modificare il contratto SSE esistente su `/generation/stream` in modo breaking.
- **CON-002**: Riutilizzare orchestrazione esistente in `generationSystemMachine` evitando regressioni su idempotency e usage.
- **CON-003**: Mantenere compatibilita con DB schema corrente, aggiungendo migration solo quando strettamente necessaria.
- **GUD-001**: Ogni task deve includere test unit/integration o evidenza di copertura equivalente.
- **GUD-002**: Ogni endpoint nuovo deve essere documentato in docs e incluso in checklist GO/NO-GO.
- **PAT-001**: Pipeline canonica obbligatoria per tool: upload -> extraction -> review -> generation -> persistence -> completion.
- **PAT-002**: Orchestrazione step da registry/dipendenze, senza hardcode statico nel runtime tool.

## 2. Implementation Steps

### Implementation Phase 1

- **GOAL-001**: Stabilire fondazioni backend per ingest brief ed extraction persistita.
- **Completion Criteria**: Endpoint upload operativo, parser brief operativo, artifact extraction scritto e leggibile da API artifacts.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| **TASK-001** | Implementare endpoint `POST /api/tools/briefs` in [src/lib/runtime/auth-http.ts](src/lib/runtime/auth-http.ts) con auth/ownership, validazione file e risposta `{ briefingId, fileName, mimeType, size }`. | x | 2026-04-25 |
| **TASK-002** | Aggiungere supporto parsing brief in backend (nuovo modulo [src/lib/runtime/brief-parser.ts](src/lib/runtime/brief-parser.ts)) con estrazione testo normalizzato per `.txt`, `.md`, `.docx`. | x | 2026-04-25 |
| **TASK-003** | Estendere request model runtime in [src/lib/runtime/request-contract.ts](src/lib/runtime/request-contract.ts) per trasportare `briefingId`, `extractionArtifactId`, `stepDependencyArtifactIds`. | x | 2026-04-25 |
| **TASK-004** | Collegare `extractionFlow` in [src/lib/machines/generation-system.machine.ts](src/lib/machines/generation-system.machine.ts) a una invoke reale che produce payload extraction strutturato, evitando auto-accept sintetico. | x | 2026-04-25 |
| **TASK-005** | Persistenza extraction artifact in [src/lib/adapters/postgres-redis.production.ts](src/lib/adapters/postgres-redis.production.ts) valorizzando `type='extraction'`, `workflow_type='extraction'`, `input_json` con schema extraction. | x | 2026-04-25 |
| **TASK-006** | Aggiungere test runtime auth HTTP upload + extraction integration in [src/lib/tests/runtime.auth-http.test.ts](src/lib/tests/runtime.auth-http.test.ts) e [src/lib/tests/generation-system.runtime.test.ts](src/lib/tests/generation-system.runtime.test.ts). | x | 2026-04-25 |

### Implementation Phase 2

- **GOAL-002**: Integrare frontend tool setup con upload reale, extraction review e trigger generation.
- **Completion Criteria**: Da UI tool e possibile caricare brief, visualizzare extraction review, avviare generation con payload completo senza mock locali.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| **TASK-007** | Sostituire simulazione timer in [frontend/src/features/generation/ui/GenerationForm.tsx](frontend/src/features/generation/ui/GenerationForm.tsx) con chiamata API upload + extraction status polling/event. | x | 2026-04-25 |
| **TASK-008** | Introdurre client API strumenti in [frontend/src/features/tools/runtime/tools-client.ts](frontend/src/features/tools/runtime/tools-client.ts) con metodi `uploadBrief`, `runExtraction`, `getExtractionArtifact`. | x | 2026-04-25 |
| **TASK-009** | Aggiornare provider in [frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx](frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx) per memorizzare `briefingId`, `extractionArtifactId`, extraction payload sintetizzato. | x | 2026-04-25 |
| **TASK-010** | Aggiornare stato UX in [frontend/src/features/generation/ui/tool-ux-state.ts](frontend/src/features/generation/ui/tool-ux-state.ts) per transizioni reali `uploading -> extracting -> review -> generating`. | x | 2026-04-25 |
| **TASK-011** | Abilitare gating capability `toolsUpload` in [frontend/src/app/runtime/backend-capabilities.ts](frontend/src/app/runtime/backend-capabilities.ts) e wiring env docs. | x | 2026-04-25 |
| **TASK-012** | Aggiungere test frontend per upload/extraction/review in [frontend/src/features/generation/ui/GenerationForm.test.tsx](frontend/src/features/generation/ui/GenerationForm.test.tsx). | x | 2026-04-25 |

### Implementation Phase 3

- **GOAL-003**: Completare esecuzione workflow Funnel e Nextland con dipendenze step e artifact finali coerenti.
- **Completion Criteria**: Entrambi i tool completano tutti gli step con input estratti, artifact step/finale persistiti, resume/regenerate funzionanti.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| **TASK-013** | Implementare orchestrazione step registry-driven in [src/lib/machines/tool-workflow.machine.ts](src/lib/machines/tool-workflow.machine.ts) usando `steps`, `dependencyGraph`, `runMode`. | x | 2026-04-25 |
| **TASK-014** | Sostituire step sintetico in [src/lib/machines/generation-system.machine.ts](src/lib/machines/generation-system.machine.ts) con step reali Funnel/Nextland risolti da registry selector request-scoped. | x | 2026-04-25 |
| **TASK-015** | Integrare helper [frontend/src/features/tools/runtime/tool-generation-engine.ts](frontend/src/features/tools/runtime/tool-generation-engine.ts) nelle pagine [frontend/src/features/tools/funnel-pages/pages/FunnelPagesToolPage.tsx](frontend/src/features/tools/funnel-pages/pages/FunnelPagesToolPage.tsx) e [frontend/src/features/tools/nextland/pages/NextlandToolPage.tsx](frontend/src/features/tools/nextland/pages/NextlandToolPage.tsx) per invio request step-based reali. | x | 2026-04-25 |
| **TASK-016** | Implementare mapping prompt-per-step (forniti dal product owner) in nuovo modulo [src/lib/runtime/tool-prompts/index.ts](src/lib/runtime/tool-prompts/index.ts) con selezione per `toolKey` e `stepKey`. | x | 2026-04-25 |
| **TASK-017** | Aggiornare persistence/query per distinguere artifact step vs artifact finale (metadata in `input_json`) in [src/lib/adapters/postgres-redis.production.ts](src/lib/adapters/postgres-redis.production.ts). | x | 2026-04-25 |
| **TASK-018** | Aggiungere test integrazione end-to-end tool in [src/lib/tests/generation-system.runtime.test.ts](src/lib/tests/generation-system.runtime.test.ts) con scenari Funnel completo e Nextland completo. | x | 2026-04-25 |

### Implementation Phase 4

- **GOAL-004**: Eseguire hardening GO, regressione completa e checklist di rilascio.
- **Completion Criteria**: Tutti i test verdi, checklist GO firmata, metriche operative e fallback attivi.

| Task | Description | Completed | Date |
| -------- | --------------------- | --------- | ---- |
| **TASK-019** | Eseguire suite completa: `npm test`, `npm run test:smoke`, `npm --prefix frontend run test`, `npm --prefix frontend run typecheck`, documentando esiti in [docs/review/frontend-sprint-go-checklist.md](docs/review/frontend-sprint-go-checklist.md). | x | 2026-04-25 |
| **TASK-020** | Aggiungere casi regressione specifici upload/extraction/protocol mismatch SSE in [docs/specifications/xstate-system-as-is/testing-go-no-go-and-risk-spec.md](docs/specifications/xstate-system-as-is/testing-go-no-go-and-risk-spec.md). | x | 2026-04-25 |
| **TASK-021** | Aggiornare indice documentazione e runbook operativo in [docs/documentation-index-overview.md](docs/documentation-index-overview.md) e nuovo [docs/review/tools-generation-go-closure-2026-04-25.md](docs/review/tools-generation-go-closure-2026-04-25.md). | x | 2026-04-25 |
| **TASK-022** | Definire criteri rollback e kill-switch feature flags (`VITE_CAP_TOOLS_UPLOAD`, eventuale backend toggle) in [docs/review/frontend-sprint-regression-policy.md](docs/review/frontend-sprint-regression-policy.md). | x | 2026-04-25 |

## 3. Alternatives

- **ALT-001**: Usare upload diretto su object storage con signed URL invece di endpoint backend applicativo.
Motivo non scelto: aumenta complessita iniziale di security e lifecycle prima di validare il flusso prodotto.
- **ALT-002**: Mantenere extraction completamente client-side.
Motivo non scelto: non garantisce persistenza auditabile e coerenza con orchestrazione/idempotency server-side.
- **ALT-003**: Orchestrare step Funnel/Nextland solo nel frontend.
Motivo non scelto: rompe consistenza con gate backend (usage/idempotency/persistence) e riduce affidabilita resume/replay.

## 4. Dependencies

- **DEP-001**: Prompt extraction fornito dal product owner per parser strutturato.
- **DEP-002**: Prompt step-by-step Funnel e Nextland forniti dal product owner.
- **DEP-003**: Conferma schema extraction output (campi obbligatori, opzionali, fallback).
- **DEP-004**: Variabili ambiente capability (`VITE_CAP_TOOLS_UPLOAD`) e eventuali segreti parsing docx in runtime.
- **DEP-005**: Ambiente DB/Redis disponibile per test smoke e integration.

## 5. Files

- **FILE-001**: [frontend/src/features/generation/ui/GenerationForm.tsx](frontend/src/features/generation/ui/GenerationForm.tsx) - rimozione simulazioni e integrazione upload/extraction reali.
- **FILE-002**: [frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx](frontend/src/features/generation/runtime/GenerationWorkspaceProvider.tsx) - stato condiviso briefing/extraction.
- **FILE-003**: [frontend/src/features/tools/funnel-pages/pages/FunnelPagesToolPage.tsx](frontend/src/features/tools/funnel-pages/pages/FunnelPagesToolPage.tsx) - wiring workflow reale.
- **FILE-004**: [frontend/src/features/tools/nextland/pages/NextlandToolPage.tsx](frontend/src/features/tools/nextland/pages/NextlandToolPage.tsx) - wiring workflow reale.
- **FILE-005**: [frontend/src/features/tools/runtime/tool-generation-engine.ts](frontend/src/features/tools/runtime/tool-generation-engine.ts) - costruzione request step/dipendenze.
- **FILE-006**: [frontend/src/features/tools/runtime/tools-client.ts](frontend/src/features/tools/runtime/tools-client.ts) - nuovo client API tool upload/extraction.
- **FILE-007**: [frontend/src/app/runtime/backend-capabilities.ts](frontend/src/app/runtime/backend-capabilities.ts) - capability toggles.
- **FILE-008**: [src/lib/runtime/auth-http.ts](src/lib/runtime/auth-http.ts) - endpoint tools upload/extraction.
- **FILE-009**: [src/lib/runtime/node-server.ts](src/lib/runtime/node-server.ts) - eventuale mapping route/body per endpoint tool.
- **FILE-010**: [src/lib/runtime/request-contract.ts](src/lib/runtime/request-contract.ts) - estensione contratto request.
- **FILE-011**: [src/lib/machines/generation-system.machine.ts](src/lib/machines/generation-system.machine.ts) - orchestrazione extraction/tool reale.
- **FILE-012**: [src/lib/machines/tool-workflow.machine.ts](src/lib/machines/tool-workflow.machine.ts) - step execution registry-driven.
- **FILE-013**: [src/lib/adapters/postgres-redis.production.ts](src/lib/adapters/postgres-redis.production.ts) - persistenza metadata extraction/step.
- **FILE-014**: [src/lib/runtime/brief-parser.ts](src/lib/runtime/brief-parser.ts) - nuovo parser testo brief.
- **FILE-015**: [src/lib/runtime/tool-prompts/index.ts](src/lib/runtime/tool-prompts/index.ts) - nuovo mapping prompt per step.
- **FILE-016**: [src/lib/tests/generation-system.runtime.test.ts](src/lib/tests/generation-system.runtime.test.ts) - test e2e orchestrazione.
- **FILE-017**: [src/lib/tests/runtime.auth-http.test.ts](src/lib/tests/runtime.auth-http.test.ts) - test endpoint tool.
- **FILE-018**: [docs/review/frontend-sprint-go-checklist.md](docs/review/frontend-sprint-go-checklist.md) - checklist GO finale.
- **FILE-019**: [docs/documentation-index-overview.md](docs/documentation-index-overview.md) - aggiornamento indice documentazione.

## 6. Testing

- **TEST-001**: Upload brief valido `.docx/.txt/.md` restituisce 200 e `briefingId`.
- **TEST-002**: Upload brief invalido (mime/size/estensione) restituisce 400 con codice errore deterministico.
- **TEST-003**: Utente non owner su progetto riceve 403 su upload/extraction endpoint.
- **TEST-004**: Extraction produce artifact `type=extraction` persistito e leggibile da `/api/artifacts/:id`.
- **TEST-005**: Avvio generation tool usa `extractionArtifactId` e produce artifact step/finale.
- **TEST-006**: Funnel completa `optin -> quiz -> vsl` con dipendenze rispettate.
- **TEST-007**: Nextland completa `landing -> thank_you` con dipendenza rispettata.
- **TEST-008**: Resume con checkpoint senza extraction context richiede nuovo brief.
- **TEST-009**: Idempotency replay blocca riesecuzione step tool e restituisce artifact replay.
- **TEST-010**: Regressione SSE protocol: mismatch artifactId/requestId gestito come errore protocol.

## 7. Risks & Assumptions

- **RISK-001**: Parsing `.docx` puo introdurre dipendenze runtime e overhead CPU su server.
- **RISK-002**: Mapping prompt-step non versionato puo causare output incoerenti in produzione.
- **RISK-003**: Mancata separazione artifact step/finale puo degradare UX storico artifact.
- **RISK-004**: Race tra retry frontend e idempotency server se correlation key non univoca per step.
- **ASSUMPTION-001**: I prompt di extraction e generation per i due tool saranno disponibili prima della Phase 3.
- **ASSUMPTION-002**: Il contratto DB attuale (`artifacts.input_json`) e sufficiente per metadata extraction e step outputs.
- **ASSUMPTION-003**: Nessun vincolo esterno blocca aggiunta di endpoint tools in runtime auth HTTP.

## 8. Related Specifications / Further Reading

[docs/specifications/xstate-system-as-is/tool-workflow-machine-spec.md](docs/specifications/xstate-system-as-is/tool-workflow-machine-spec.md)
[docs/specifications/xstate-system-as-is/generation-system-machine-spec.md](docs/specifications/xstate-system-as-is/generation-system-machine-spec.md)
[docs/specifications/xstate-system-as-is/testing-go-no-go-and-risk-spec.md](docs/specifications/xstate-system-as-is/testing-go-no-go-and-risk-spec.md)
[docs/review/frontend-sprint-go-checklist.md](docs/review/frontend-sprint-go-checklist.md)