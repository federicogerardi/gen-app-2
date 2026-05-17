---
goal: Refactor e unificare la sezione admin/dashboard frontend con struttura atomica e UX consistente
version: 1.0
date_created: 2026-05-17
owner: frontend team
status: 'Planned'
tags: [refactor, frontend, admin, dashboard, ux, architecture]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Questo piano definisce le fasi per il refactoring e la ristrutturazione della sezione admin/dashboard del frontend, con l’obiettivo di ottenere una struttura unificata, atomica e una UX coerente. Il risultato sarà una dashboard centrale con accesso a tutte le funzioni amministrative (gestione modelli LLM, changelog, segnalazioni, attività recente), componenti riusabili e feedback utente consistenti.

## 1. Requirements & Constraints

- **REQ-001**: La dashboard deve essere la entry point unica per tutte le funzioni admin.
- **REQ-002**: Tutte le pagine admin devono usare componenti atomici riusabili.
- **REQ-003**: La navigazione deve essere chiara, con menu persistente e labeling coerente.
- **REQ-004**: Ogni azione deve fornire feedback visivo (toast, badge, undo).
- **REQ-005**: Accessibilità: navigazione tastiera, focus visibile, label ARIA.
- **CON-001**: Mantenere compatibilità con il design system esistente.
- **CON-002**: Non introdurre breaking changes alle API backend.
- **GUD-001**: Seguire la UX review e journey map allegati.
- **PAT-001**: Utilizzare pattern “Data Table View” per le sezioni tabellari.
- **PAT-002**: Ogni funzione deve essere isolata in una pagina/section atomica.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Analisi, design e setup struttura dashboard unificata

| Task     | Description                                                                                  | Completed | Date       |
|----------|----------------------------------------------------------------------------------------------|-----------|------------|
| TASK-001 | Analizzare codice attuale admin e mappare tutte le rotte e componenti                        |           |            |
| TASK-002 | Produrre wireframe e flow unificato (Figma, docs/ux/admin-dashboard-flow.md)                 |           |            |
| TASK-003 | Definire struttura cartelle e naming per componenti atomici                                  |           |            |
| TASK-004 | Aggiornare menu laterale persistente con accesso a tutte le funzioni                         |           |            |
| TASK-005 | Creare componenti base: AdminDashboard, AdminSidebar, AdminPageContainer                     |           |            |
| TASK-006 | Installare/integrate libreria feedback (es. react-toastify) se non presente                  |           |            |
| TASK-007 | Verificare/aggiornare design system per supporto componenti admin atomici                   |           |            |

### Implementation Phase 2

- GOAL-002: Refactoring e implementazione sezioni atomiche

| Task     | Description                                                                                  | Completed | Date       |
|----------|----------------------------------------------------------------------------------------------|-----------|------------|
| TASK-008 | Refactor pagina gestione modelli LLM in componente atomico e tabellare                       |           |            |
| TASK-009 | Refactor pagina gestione changelog in componente atomico e tabellare                         |           |            |
| TASK-010 | Refactor pagina gestione segnalazioni in componente atomico e tabellare                      |           |            |
| TASK-011 | Implementare pagina attività recente come tabella filtrabile                                 |           |            |
| TASK-012 | Integrare feedback visivo (toast, badge, undo) in tutte le azioni                            |           |            |
| TASK-013 | Validare accessibilità (tastiera, focus, ARIA, contrasto) su tutte le pagine                 |           |            |
| TASK-014 | Aggiornare test end-to-end e snapshot                                                        |           |            |
| TASK-015 | Eseguire backup/ripristino routing e permessi admin prima del refactor (verifica restore su branch separato) |           |            |
| TASK-016 | Validare criteri di completamento: tutti i test e2e admin passano, copertura accessibilità ≥ 90% |           |            |
| TASK-017 | Validare con il team design system che tutti i componenti admin siano conformi                |           |            |

## 3. Alternatives

- **ALT-001**: Mantenere struttura attuale con minimi aggiustamenti → Scartato per mancanza di coerenza e scalabilità.
- **ALT-002**: Riscrivere solo alcune sezioni senza unificazione → Scartato per rischio di drift e debito tecnico.

## 4. Dependencies

- **DEP-001**: Design system frontend (componenti base, stili)
- **DEP-002**: API backend per modelli, changelog, segnalazioni, log attività
- **DEP-003**: Libreria di toast/feedback (es. notistack, react-toastify)
- **DEP-004**: Figma per wireframe

## 5. Files

- **FILE-001**: frontend/src/features/admin/AdminDashboard.tsx (nuovo/aggiornato)
- **FILE-002**: frontend/src/features/admin/AdminSidebar.tsx (nuovo/aggiornato)
- **FILE-003**: frontend/src/features/admin/llm/LLMTable.tsx
- **FILE-004**: frontend/src/features/admin/changelog/ChangelogTable.tsx
- **FILE-005**: frontend/src/features/admin/reports/ReportsTable.tsx
- **FILE-006**: frontend/src/features/admin/activity/ActivityLogTable.tsx
- **FILE-007**: frontend/src/features/admin/__tests__/
- **FILE-008**: docs/ux/admin-dashboard-flow.md
- **FILE-009**: docs/ux/admin-dashboard-jtbd.md
- **FILE-010**: docs/ux/admin-dashboard-journey.md

## 6. Testing

- **TEST-001**: Test unitari per ogni componente atomico admin (Jest/React Testing Library)
- **TEST-002**: Test end-to-end (Cypress o Playwright) per flussi admin
- **TEST-003**: Test accessibilità (axe-core, jest-axe) su tutte le pagine admin
- **TEST-004**: Snapshot test per layout e feedback
- **TEST-005**: Validazione automatica: tutti i test e2e admin devono passare senza errori critici
- **TEST-006**: Copertura test accessibilità ≥ 90% sulle rotte admin

## 7. Risks & Assumptions

- **RISK-001**: Possibili regressioni su permessi/admin routing
- **RISK-002**: Integrazione incompleta con API legacy
- **ASSUMPTION-001**: Il design system è aggiornato e supporta i nuovi componenti
- **ASSUMPTION-002**: Le API backend sono stabili e documentate

## 8. Related Specifications / Further Reading

- [docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md]
- [docs/ux/admin-dashboard-jtbd.md]
- [docs/ux/admin-dashboard-journey.md]
- [docs/ux/admin-dashboard-flow.md]
- [docs/02-design/specifications/frontend-tool-pages-architecture-spec.md]
- [docs/01-requirements/domain-ubiquitous-language-glossary.md]
- [docs/02-design/domain-bounded-context-map.md]
- [docs/07-governance/domain-naming-decision-log.md]
