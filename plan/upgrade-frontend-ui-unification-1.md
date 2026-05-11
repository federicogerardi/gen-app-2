---
goal: Unificazione e semplificazione della GUI tramite adozione di librerie per design system, temi e validazione form
version: 2.0
date_created: 2026-05-09
status: 'Completed'
tags: [upgrade, frontend, ui, design-system, theming, validation]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

Questo piano mira a unificare e semplificare la GUI dell’applicazione frontend adottando librerie mature per design system/UI kit (MUI), gestione centralizzata dei temi (ThemeProvider MUI), e validazione/form (React Hook Form + Zod). L’obiettivo è eliminare componenti custom ridondanti, garantire coerenza visiva e velocizzare lo sviluppo.


## 1. Requirements & Constraints

- **REQ-001**: Tutti i nuovi componenti devono utilizzare il design system scelto (MUI).
- **REQ-002**: La gestione dei temi (colori, font, spaziature) deve essere centralizzata e supportare dark mode.
- **REQ-003**: Tutti i form devono essere gestiti tramite React Hook Form e validati con Zod.
- **REQ-004**: Tutti i test di regressione e snapshot devono essere eseguiti in CI su ogni PR.
- **REQ-005**: Tutti i nuovi componenti devono rispettare le linee guida WCAG 2.1 AA per l’accessibilità.
- **REQ-006**: Le Tool Workspace Page devono essere trattate come form orchestrati a stati: l’azione primaria avvia una `GenerationRequest` e non un submit CRUD tradizionale.
- **CON-001**: Refactoring progressivo, senza breaking change per gli utenti.
- **CON-002**: Mantenere compatibilità con Vite e TypeScript.
- **GUD-001**: Seguire le regole di naming e composizione definite in docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md.
- **GUD-002**: Per le pagine tool usare i termini canonici DDD/UL: `ToolPage`, `ToolPageViewModel`, `ReadinessSnapshot`, `PrimaryActionPolicy`, `ToolStep`, `HydrationResult`, `GenerationRequest`.
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
| TASK-006 | Migra almeno un form esistente a React Hook Form + validazione Zod                           | ✅        | 2026-05-11 |
| TASK-017 | Unifica theming engine: rimuovi custom ThemeProvider, adotta MUI v9 cssVariables + colorSchemes + useColorScheme | ✅        | 2026-05-11 |
| TASK-018 | Classifica formalmente le Tool Workspace Page come form orchestrati (state-driven) e non submit form CRUD | ✅        | 2026-05-11 |


### Implementation Phase 3

- GOAL-003: Estensione e consolidamento.

| Task     | Description                                                                                  | Completed | Date       |
|----------|----------------------------------------------------------------------------------------------|-----------|------------|
| TASK-007 | Estendi la migrazione a tutte le pagine e componenti principali                              | 🔄        | 2026-05-11 |
| TASK-008 | Implementa dark mode e verifica la coerenza visiva globale                                   | ✅        | 2026-05-11 |
| TASK-009 | Aggiorna la documentazione e i test per riflettere la nuova architettura                     | ✅        | 2026-05-11 |
| TASK-019 | Migra AdminUsersPage a RHF + Zod + MUI mantenendo il comportamento di dominio invariato       | ✅        | 2026-05-11 |
| TASK-020 | Migra CTA legacy in ArtifactDetailPage e ToolStepCard a MUI mantenendo semantica UI/DDD      | ✅        | 2026-05-11 |
| TASK-021 | Migra LoginForm auth a RHF + Zod + MUI mantenendo semantica autenticazione invariata          | ✅        | 2026-05-11 |
| TASK-022 | Migra CTA di GenerationForm a MUI mantenendo invariata l’orchestrazione runtime                 | ✅        | 2026-05-11 |
| TASK-023 | Migra CTA/controlli nei componenti Generation panel a MUI senza cambiare semantica stream/state | ✅        | 2026-05-11 |
| TASK-024 | Sweep finale pagine: rimozione residui controlli non-MUI fuori dal perimetro tabellare          | ✅        | 2026-05-11 |
| TASK-014 | Aggiorna la documentazione onboarding per i nuovi pattern UI e form                          | ✅        | 2026-05-11 |
| TASK-015 | Prepara esempi minimi di utilizzo dei nuovi componenti in una sezione “cookbook”             | ✅        | 2026-05-11 |
| TASK-016 | Esegui audit accessibilità con strumenti automatici (axe, Lighthouse)                        | ✅        | 2026-05-11 |

### 2.1 DDD/UL Focused Migration Strategy

Obiettivo: evitare drift tra “form UI” e “orchestrazione dominio”.

Track A — Standard Data Form (CRUD)

- ambito: pagine amministrative e anagrafiche (es. progetti, utenti admin)
- stack target: RHF + Zod + MUI
- semantica: submit diretto a endpoint CRUD
- stato as-is: `NewProjectPage` e create form di `AdminModelsPage` migrati

Track B — Tool Workspace Page (orchestrated form)

- ambito: `ToolPageTemplate` e pagine tool (`funnel-pages`, `nextland`, `youtube-lf-script`)
- semantica canonica: la CTA primaria è policy-driven (`PrimaryActionPolicy`) e avvia `GenerationRequest` sulla base di `ReadinessSnapshot`, non un semplice submit form
- regola operativa: RHF/Zod possono validare i campi di setup (`projectId`, `model`, `tone`, `briefingFile`) ma non devono sostituire l’orchestrazione di `tool-page.machine` / `useToolPage`
- dipendenze dominio: rispettare `HydrationResult` completeness gate e coerenza `ToolStep` ↔ `WorkflowStep`
- output atteso: migrazione UI library-first con comportamento state-machine invariato

### Implementation Phase 4

- GOAL-004: Rollout graduale e monitoraggio qualità.

| Task     | Description                                                                                  | Completed | Date       |
|----------|----------------------------------------------------------------------------------------------|-----------|------------|
| TASK-010 | Attiva feature flag per rollout progressivo dei nuovi componenti                             | ✅        | 2026-05-11 |
| TASK-011 | Monitora errori e feedback utenti tramite Sentry/LogRocket                                   | ✅        | 2026-05-11 |
| TASK-012 | Prepara piano di rollback rapido in caso di regressioni critiche                             | ✅        | 2026-05-11 |
| TASK-013 | Aggiorna pipeline CI per includere test visuali e validazione form                           | ✅        | 2026-05-11 |

## 3. Alternatives

- **ALT-001**: Utilizzo di Chakra UI o Ant Design invece di MUI (scartato per minore aderenza alle specifiche attuali e minore diffusione nella codebase React enterprise).
- **ALT-002**: Gestione temi con Styled Components standalone (scartato per minore integrazione con MUI e duplicazione di logica).

## 4. Dependencies

- **DEP-001**: @mui/material, @emotion/react, @emotion/styled
- **DEP-002**: react-hook-form, zod, @hookform/resolvers
- **DEP-003**: Vite, React 18+, TypeScript

## 5. Files

- **FILE-001**: apps/frontend/src/main.tsx — entry point (solo `<App />`)
- **FILE-002**: apps/frontend/src/theme/theme.ts — definizione tema MUI v9 (cssVariables + colorSchemes)
- **FILE-003**: apps/frontend/src/components/ — wrapper MUI condivisi (AppButton, AppCard, AppInput, AppModal)
- **FILE-004**: apps/frontend/src/features/ — refactoring pagine/feature
- **FILE-005**: apps/frontend/README.md — documentazione aggiornata
- **FILE-006**: apps/frontend/src/App.tsx — MUI ThemeProvider + defaultMode="system"
- **FILE-007**: apps/frontend/src/app/ui/ThemeToggleButton.tsx — useColorScheme MUI
- **FILE-008**: apps/frontend/src/features/projects/pages/NewProjectPage.tsx — RHF + Zod + MUI TextField
- **FILE-009**: apps/frontend/src/features/admin/pages/AdminModelsPage.tsx — create form RHF + Zod + MUI
- **FILE-010**: apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx — orchestrated form baseline (state-machine driven)
- **FILE-011**: apps/frontend/src/features/tools/runtime/useToolPage.ts — orchestrazione dominio ToolPage
- **FILE-012**: apps/frontend/src/features/admin/pages/AdminUsersPage.tsx — create/edit form RHF + Zod + MUI
- **FILE-013**: apps/frontend/src/features/artifacts/pages/ArtifactDetailPage.tsx — CTA migrate a MUI Button
- **FILE-014**: apps/frontend/src/features/tools/ui/ToolStepCard.tsx — action button migrate a MUI Button
- **FILE-015**: apps/frontend/src/features/auth/ui/LoginForm.tsx — login form RHF + Zod + MUI
- **FILE-016**: apps/frontend/src/features/generation/ui/GenerationForm.tsx — CTA migrate a MUI Button
- **FILE-017**: apps/frontend/src/features/generation/ui/GenerationStreamPanel.tsx — CTA migrate a MUI Button
- **FILE-018**: apps/frontend/src/features/generation/ui/ArtifactHistoryPanel.tsx — CTA migrate a MUI Button
- **FILE-019**: apps/frontend/src/features/generation/ui/SessionArtifactTabs.tsx — tab/scroll controls migrate a MUI Button/IconButton
- **FILE-020**: apps/frontend/src/features/sessionsummary/pages/SessionSummaryDetailPage.tsx — CTA primaria migrate a MUI Button
- **FILE-021**: apps/frontend/src/features/tools/ui/ToolPageTemplate.tsx — Setup Panel migrate a MUI TextField/MenuItem/Button mantenendo orchestrazione state-machine
- **FILE-022**: apps/frontend/src/app/runtime/ui-rollout.ts — feature flag rollout mode (`VITE_UI_ROLLOUT_MODE`)
- **FILE-023**: apps/frontend/src/app/runtime/monitoring.ts — baseline monitoraggio runtime (`VITE_MONITORING_PROVIDER`)
- **FILE-024**: apps/frontend/src/features/auth/ui/LoginForm.test.tsx — regressione validazione form RHF + Zod
- **FILE-025**: apps/frontend/src/features/tools/ui/ToolActionButtons.snapshot.test.tsx — snapshot test CTA Tool Workspace
- **FILE-026**: apps/frontend/lighthouserc.json — soglie Lighthouse per audit accessibilità automatico
- **FILE-027**: .github/workflows/main-pr-gate.yml — gate CI esteso (form/visual/a11y)

Nota operativa TASK-024:

- i controlli nativi rimasti in `AdminUsersPage` e `AdminModelsPage` sono confinati alle azioni di riga dentro `<td>` e sono mantenuti intenzionalmente secondo il canonical table standard (`inlineLink + artifactTableActionLink`, no MUI Button in tabella).


## 6. Testing

- **TEST-001**: Verifica visuale e snapshot dei componenti migrati
- **TEST-002**: Test di validazione form (React Hook Form + Zod)
- **TEST-003**: Test di regressione su pagine refattorizzate
- **TEST-004**: Audit accessibilità automatizzato (axe, Lighthouse)
- **TEST-005**: Verifica esecuzione test in CI su ogni PR

Comandi operativi consolidati:

- `npm --workspace apps/frontend run test:visual`
- `npm --workspace apps/frontend run test:forms`
- `npm --workspace apps/frontend run audit:a11y`


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
