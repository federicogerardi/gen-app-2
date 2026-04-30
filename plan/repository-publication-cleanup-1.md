---
goal: Repository Publication Cleanup Plan
version: 1.0
date_created: 2026-04-30
last_updated: 2026-04-30
owner: GitHub Copilot
status: Planned
tags: [cleanup, repository, publication, production, devops, ci]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Piano di cleanup del codespace e del repository per pubblicazione di una versione focalizzata sul runtime di produzione, senza elementi obsoleti o non rilevanti.

## 1. Objectives

- OBJ-001: Rimuovere dal repository ogni artefatto non necessario al deploy e al mantenimento in produzione.
- OBJ-002: Separare chiaramente file runtime-critical da file solo locali/dev.
- OBJ-003: Ridurre rumore documentale e tecnico prima della pubblicazione.
- OBJ-004: Garantire che build, test e avvio restino invariati dopo cleanup.

## 2. Scope

In scope:

- root repository (`src/`, `frontend/`, `db/`, `docs/`, `plan/`, file di configurazione deploy)
- tooling locale/codespace in root (file e cartelle hidden non runtime)
- policy `.gitignore` e checklist CI pre-publish

Out of scope:

- refactor funzionali backend/frontend
- modifica comportamenti XState o contratti API
- riscrittura completa della documentazione tecnica

## 3. Classification Rules (Keep / Remove / Review)

### 3.1 Keep (required for production or operations)

- codice runtime backend/frontend
- SQL migrations e seed minimi necessari
- file deploy (`Dockerfile`, `railway.toml`, package manifest)
- documentazione architetturale e runbook attivi

### 3.2 Remove (local artifacts or obsolete)

- cache/build output locale (`node_modules`, `dist`, `build`, `coverage`, `.tmp`)
- tracing locale non operativo (`.copilot-tracking/`)
- file editor/temporary (`*.tmp`, `*.swp`, log locali)
- env locali non pubblicabili (`.env.local`, `frontend/.env.local`)

### 3.3 Review before removing

- `.agents/`
- `.claude/`
- `.copilot-repo-memory.md`
- `skills-lock.json`
- archivio storico massivo in `docs/99-lifecycle/99-archive/`

Regola: rimuovere solo se il contenuto non e usato da CI/CD, onboarding contributor o governance documentale attiva.

## 4. Current Repository Signals (snapshot)

Segnali rilevati nel codespace:

- presenti directory locali/tooling: `.agents/`, `.claude/`, `.copilot-tracking/`, `.tmp/`, `node_modules/`
- presente env locale: `.env.local`
- `.gitignore` gia copre gran parte di build/cache/env locali

Rischio principale: pubblicare accidentalmente metadati agent/local tooling non necessari al prodotto.

## 5. Implementation Plan

### Phase 1 - Baseline and Safety

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-001 | Creare branch dedicato `chore/repo-publication-cleanup`. |  |  |
| TASK-002 | Eseguire inventario file tracciati/non tracciati e classificarli Keep/Remove/Review. |  |  |
| TASK-003 | Congelare baseline con tag locale o commit checkpoint prima delle rimozioni. |  |  |

Completion criteria:

- esiste baseline verificabile
- inventario completo con decisione per ogni elemento Review

### Phase 2 - Remove Non-Relevant Artifacts

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-004 | Eliminare artefatti locali non necessari al repository pubblicato (`.tmp/`, tracking locale, cache). |  |  |
| TASK-005 | Verificare che eventuali file da `.agents/`, `.claude/`, `.copilot-repo-memory.md` non siano richiesti dal flusso di team; in caso negativo rimuoverli. |  |  |
| TASK-006 | Pulire riferimenti in README/docs a tooling locale rimosso. |  |  |

Completion criteria:

- nessun elemento Remove residuo
- nessun link rotto verso file eliminati

### Phase 3 - Docs Rationalization for Publication

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-007 | Mantenere `docs/index-overview.md` come indice unico per contenuti attivi. |  |  |
| TASK-008 | Valutare se comprimere o estrarre in release separata parte di `docs/99-lifecycle/99-archive/` se e solo storico non operativo. |  |  |
| TASK-009 | Verificare coerenza owner/status/date nei documenti attivi critici. |  |  |

Completion criteria:

- docs operative facilmente navigabili
- storico separato o chiaramente etichettato

### Phase 4 - CI and Publication Gates

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-010 | Eseguire gate backend: `npm run typecheck`, `npm run test`, `npm run test:smoke`. |  |  |
| TASK-011 | Eseguire gate frontend: `npm --prefix frontend run typecheck`, `npm --prefix frontend run test`, `npm --prefix frontend run build`. |  |  |
| TASK-012 | Verificare avvio locale minimo: backend `npm run start:server`, frontend `npm --prefix frontend run dev`. |  |  |
| TASK-013 | Validare che `.env.example` sia sufficiente e non includa segreti. |  |  |

Completion criteria:

- tutti i gate verdi
- nessun segreto o artefatto locale nel diff finale

### Phase 5 - Final Publication Checklist

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-014 | Rieseguire `git status` con working tree pulito eccetto i file del cleanup. |  |  |
| TASK-015 | Revisionare diff finale con focus su file rimossi e motivazione. |  |  |
| TASK-016 | Pubblicare PR con titolo e body standardizzato (scope cleanup + rischio nullo funzionale). |  |  |
| TASK-017 | Merge solo dopo approvazione e passaggio check CI richiesti. |  |  |

Completion criteria:

- PR approvata
- repository pubblicabile senza elementi obsoleti/non rilevanti

## 6. Execution Commands (non destructive)

```bash
# inventory
git status --short
git ls-files

# locate potential local artifacts
find . -maxdepth 2 \( -name ".tmp" -o -name ".copilot-tracking" -o -name ".agents" -o -name ".claude" -o -name "node_modules" \)

# quality gates
npm run typecheck
npm run test
set -a && . ./.env.local && set +a && npm run test:smoke
npm --prefix frontend run typecheck
npm --prefix frontend run test
npm --prefix frontend run build
```

## 7. Risks and Mitigations

- RISK-001: Rimozione di file apparentemente locali ma utili al team.
  - MIT-001: applicare classificazione Review con approvazione esplicita prima della delete.
- RISK-002: Link rotti in docs dopo cleanup.
  - MIT-002: validazione link in `docs/index-overview.md` e smoke reading delle sezioni principali.
- RISK-003: Regressioni involontarie post cleanup.
  - MIT-003: run completo dei gate backend/frontend prima del merge.

## 8. Deliverables

- DEL-001: PR `chore/repo-publication-cleanup`
- DEL-002: repository senza artefatti locali/obsoleti
- DEL-003: checklist finale compilata con evidenza test
