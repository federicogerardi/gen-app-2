---
goal: Unificazione e semplificazione della GUI tramite adozione di librerie per design system, temi e validazione form
version: 1.0
date_created: 2026-05-09
status: 'Planned'
tags: [upgrade, frontend, ui, design-system, theming, validation]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Questo piano mira a unificare e semplificare la GUI dell’applicazione frontend adottando librerie mature per design system/UI kit (MUI), gestione centralizzata dei temi (ThemeProvider MUI), e validazione/form (React Hook Form + Zod). L’obiettivo è eliminare componenti custom ridondanti, garantire coerenza visiva e velocizzare lo sviluppo.


## 1. Requirements & Constraints

- **REQ-001**: Tutti i nuovi componenti devono utilizzare il design system scelto (MUI).
- **REQ-002**: La gestione dei temi (colori, font, spaziature) deve essere centralizzata e supportare dark mode.
- **REQ-003**: Tutti i form devono essere gestiti tramite React Hook Form e validati con Zod.
- **REQ-004**: Tutti i test di regressione e snapshot devono essere eseguiti in CI su ogni PR.
- **REQ-005**: Tutti i nuovi componenti devono rispettare le linee guida WCAG 2.1 AA per l’accessibilità.
- **CON-001**: Refactoring progressivo, senza breaking change per gli utenti.
- **CON-002**: Mantenere compatibilità con Vite e TypeScript.
- **GUD-001**: Seguire le regole di naming e composizione definite in docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md.
- **PAT-001**: Utilizzare wrapper per componenti custom solo se necessario per esigenze di dominio.
- **PAT-002**: Adottare la strategia “strangler fig” per sostituire gradualmente i componenti legacy senza big bang.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Integrare e configurare le librerie di base (MUI, ThemeProvider, React Hook Form, Zod).

| Task     | Description                                                                                  | Completed | Date       |
|----------|----------------------------------------------------------------------------------------------|-----------|------------|
| TASK-001 | Installa le dipendenze: @mui/material, @emotion/react, @emotion/styled, react-hook-form, zod, @hookform/resolvers | ✅        | 2026-05-09 |
| TASK-002 | Crea il file di tema centrale (es. frontend/src/theme/theme.ts) e configura ThemeProvider in main.tsx | ✅        | 2026-05-09 |
| TASK-003 | Aggiorna la documentazione interna per le nuove convenzioni di composizione e naming         | ✅        | 2026-05-09 |

### Implementation Phase 2

- GOAL-002: Refactoring progressivo dei componenti e delle pagine principali.

| Task     | Description                                                                                  | Completed | Date       |
|----------|----------------------------------------------------------------------------------------------|-----------|------------|
| TASK-004 | Sostituisci i componenti custom di base (Button, Card, Modal, Input) con quelli MUI          | ✅        | 2026-05-09 |
| TASK-005 | Refattora almeno una pagina chiave per usare layout, componenti e tema centralizzati         | ✅        | 2026-05-09 |
| TASK-006 | Migra almeno un form esistente a React Hook Form + validazione Zod                           |           |            |


### Implementation Phase 3

- GOAL-003: Estensione e consolidamento.

| Task     | Description                                                                                  | Completed | Date       |
|----------|----------------------------------------------------------------------------------------------|-----------|------------|
| TASK-007 | Estendi la migrazione a tutte le pagine e componenti principali                              |           |            |
| TASK-008 | Implementa dark mode e verifica la coerenza visiva globale                                   |           |            |
| TASK-009 | Aggiorna la documentazione e i test per riflettere la nuova architettura                     |           |            |
| TASK-014 | Aggiorna la documentazione onboarding per i nuovi pattern UI e form                          |           |            |
| TASK-015 | Prepara esempi minimi di utilizzo dei nuovi componenti in una sezione “cookbook”             |           |            |
| TASK-016 | Esegui audit accessibilità con strumenti automatici (axe, Lighthouse)                        |           |            |

### Implementation Phase 4

- GOAL-004: Rollout graduale e monitoraggio qualità.

| Task     | Description                                                                                  | Completed | Date       |
|----------|----------------------------------------------------------------------------------------------|-----------|------------|
| TASK-010 | Attiva feature flag per rollout progressivo dei nuovi componenti                             |           |            |
| TASK-011 | Monitora errori e feedback utenti tramite Sentry/LogRocket                                   |           |            |
| TASK-012 | Prepara piano di rollback rapido in caso di regressioni critiche                             |           |            |
| TASK-013 | Aggiorna pipeline CI per includere test visuali e validazione form                           |           |            |

## 3. Alternatives

- **ALT-001**: Utilizzo di Chakra UI o Ant Design invece di MUI (scartato per minore aderenza alle specifiche attuali e minore diffusione nella codebase React enterprise).
- **ALT-002**: Gestione temi con Styled Components standalone (scartato per minore integrazione con MUI e duplicazione di logica).

## 4. Dependencies

- **DEP-001**: @mui/material, @emotion/react, @emotion/styled
- **DEP-002**: react-hook-form, zod, @hookform/resolvers
- **DEP-003**: Vite, React 18+, TypeScript

## 5. Files

- **FILE-001**: frontend/src/main.tsx — setup ThemeProvider
- **FILE-002**: frontend/src/theme/theme.ts — definizione tema centrale
- **FILE-003**: frontend/src/components/ — nuovi componenti condivisi
- **FILE-004**: frontend/src/features/ — refactoring pagine/feature
- **FILE-005**: frontend/README.md — documentazione aggiornata


## 6. Testing

- **TEST-001**: Verifica visuale e snapshot dei componenti migrati
- **TEST-002**: Test di validazione form (React Hook Form + Zod)
- **TEST-003**: Test di regressione su pagine refattorizzate
- **TEST-004**: Audit accessibilità automatizzato (axe, Lighthouse)
- **TEST-005**: Verifica esecuzione test in CI su ogni PR


## 7. Risks & Assumptions

- **RISK-001**: Possibili regressioni visive durante la migrazione progressiva
- **RISK-002**: Incompatibilità con componenti legacy o custom troppo specifici
- **RISK-003**: Possibili problemi di accessibilità non rilevati nei componenti custom
- **RISK-004**: Rallentamento del team durante la fase di refactoring progressivo
- **ASSUMPTION-001**: Tutte le dipendenze sono compatibili con la versione attuale di React/Vite
- **ASSUMPTION-002**: Il team ha familiarità con i nuovi strumenti introdotti

## 8. Related Specifications / Further Reading

- [docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md]
- [MUI Documentation](https://mui.com/)
- [React Hook Form Documentation](https://react-hook-form.com/)
- [Zod Documentation](https://zod.dev/)
