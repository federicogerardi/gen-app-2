---
goal: Repository Publication Cleanup Plan
version: 1.2
date_created: 2026-04-30
last_updated: 2026-05-05
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
- file editor/temporary (`*.tmp`, `*.swp`, log locali)

### 3.3 Review before removing

- `.agents/`
- `.claude/`
- `.copilot-repo-memory.md`
- `skills-lock.json`
- archivio storico massivo in `docs/99-lifecycle/99-archive/`

Regola: rimuovere solo se il contenuto non e usato da CI/CD, onboarding contributor o governance documentale attiva.

## 4. Current Repository Signals (snapshot)

Segnali rilevati nel codespace:

- **Tracciati da git (richiedono decisione esplicita):** nessuno tra `.agents/`, `.claude/`, `.copilot-repo-memory.md`, `skills-lock.json` (rimossi il 2026-05-05)
- **Non tracciati / già gitignored:** `.copilot-tracking/` (coperto da `.gitignore`), `node_modules/`, `.env.local` (coperto da pattern `.env.*`)
- **Status `.claude/`:** verificare se presente e se tracciato
- `.gitignore` copre ora anche `.agents/`, `.claude/`, `.copilot-repo-memory.md`, `skills-lock.json`
- CI frontend: `.github/workflows/main-pr-gate.yml` con `typecheck + test + build` e actions SHA-pinned
- CI backend presente: `.github/workflows/backend-gate.yml`

Execution update 2026-05-05:

- `.agents/`, `.claude/`, `.copilot-repo-memory.md`, `skills-lock.json` rimossi dal repository
- `.gitignore` aggiornato per prevenire re-tracking
- workflow frontend rinominato e hardenizzato: `.github/workflows/main-pr-gate.yml` con build step e actions SHA-pinned
- nuovo workflow backend creato: `.github/workflows/backend-gate.yml`
- gate backend e frontend eseguiti con esito verde
- smoke test bloccato per env mancante: `UPSTASH_REDIS_URL`

Rischio principale: `.agents/` e `skills-lock.json` sono **tracciati** e verranno pubblicati salvo decisione esplicita di rimozione + aggiornamento `.gitignore`.

## 5. Implementation Plan

### Phase 1 - Baseline and Safety

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-001 | Creare branch dedicato `chore/repo-publication-cleanup`. | x | 2026-05-05 |
| TASK-002 | Eseguire inventario file tracciati/non tracciati e classificarli Keep/Remove/Review. | x | 2026-05-05 |
| TASK-003 | Congelare baseline con tag git nominato `pre-cleanup-baseline` prima delle rimozioni: `git tag pre-cleanup-baseline`. |  |  |

Completion criteria:

- esiste baseline verificabile
- inventario completo con decisione per ogni elemento Review

### Phase 2 - Remove Non-Relevant Artifacts

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-004 | Eliminare artefatti locali non necessari al repository pubblicato (`.tmp/`, tracking locale, cache non tracciati). |  |  |
| TASK-005 | Decidere per `.agents/` e `skills-lock.json`: se non richiesti da CI/CD o onboarding contributor, rimuoverli dal repository e aggiungere le rispettive voci a `.gitignore`. Criterio: nessun workflow in `.github/` ne referenzia il contenuto → rimuovere. | x | 2026-05-05 |
| TASK-005b | Se `.agents/` e/o `skills-lock.json` vengono rimossi: aggiornare `.gitignore` aggiungendo le voci `.agents/` e `skills-lock.json` per prevenire il re-tracking. | x | 2026-05-05 |
| TASK-006 | Pulire riferimenti in README/docs a tooling locale rimosso. |  |  |

Completion criteria:

- nessun elemento Remove residuo
- nessun link rotto verso file eliminati

### Phase 3 - Docs Rationalization for Publication

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-007 | Verificare che tutti i link in `docs/index-overview.md` siano raggiungibili: aprire ogni entry della sezione Active Registry e Archive Registry e confermare che il file esista nel path indicato. |  |  |
| TASK-008 | Valutare se comprimere o estrarre in release separata parte di `docs/99-lifecycle/99-archive/` se è solo storico non operativo. |  |  |
| TASK-009 | Verificare coerenza owner/status/date nei documenti attivi critici elencati in `docs/index-overview.md` sezione Critical Documents Status. |  |  |

Completion criteria:

- docs operative facilmente navigabili
- storico separato o chiaramente etichettato

### Phase 4 - CI Hardening

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-010 | Aggiungere step `npm run build` al workflow `.github/workflows/main-pr-gate.yml` (attualmente mancante). | x | 2026-05-05 |
| TASK-011 | Pinnare le azioni GitHub Actions nel workflow frontend a SHA specifici: `actions/checkout` e `actions/setup-node` (mitigazione supply chain). | x | 2026-05-05 |
| TASK-012 | Creare workflow CI backend `.github/workflows/backend-gate.yml` con step: `npm ci`, `npm run typecheck`, `npm run test` su push/PR a `main` e path `src/**`. | x | 2026-05-05 |

Completion criteria:

- workflow frontend include build e usa SHA-pinned actions
- workflow backend esiste e copre typecheck + test
- nessuna action non-pinned nei workflow pubblicati

### Phase 5 - Quality Gates Pre-Publish

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-013 | Eseguire gate CI automatizzabile backend: `npm run typecheck`, `npm run test`. | x | 2026-05-05 |
| TASK-014 | Eseguire gate CI automatizzabile frontend: `npm --prefix frontend run typecheck`, `npm --prefix frontend run test`, `npm --prefix frontend run build`. | x | 2026-05-05 |
| TASK-015 | Eseguire smoke manuale con env locali (non eseguibile in CI senza segreti): `set -a && . ./.env.local && set +a && npm run test:smoke`. |  |  |
| TASK-016 | Verificare avvio locale minimo: backend `npm run start:server`, frontend `npm --prefix frontend run dev`. |  |  |
| TASK-017 | Validare che `.env.example` sia sufficiente e non includa segreti: `grep -v '^#' .env.example | grep -v '^$'` e revisione manuale di ogni valore. | x | 2026-05-05 |

Completion criteria:

- gate CI (TASK-013, TASK-014) verdi senza env segreti
- smoke manuale (TASK-015) verde con `.env.local` caricato
- nessun segreto o artefatto locale nel diff finale

### Phase 6 - Final Publication Checklist

| Task | Description | Completed | Date |
| --- | --- | --- | --- |
| TASK-018 | Rieseguire `git status` con working tree pulito eccetto i file del cleanup. |  |  |
| TASK-019 | Revisionare diff finale con focus su file rimossi e motivazione. |  |  |
| TASK-020 | Pubblicare PR con titolo e body standardizzato (scope cleanup + rischio nullo funzionale). |  |  |
| TASK-021 | Merge solo dopo approvazione e passaggio check CI richiesti (main-pr-gate + backend-gate). |  |  |

Completion criteria:

- PR approvata
- tutti i workflow CI verdi sul branch
- repository pubblicabile senza elementi obsoleti/non rilevanti

## 6. Execution Commands (non destructive)

```bash
# inventory file tracciati
git status --short
git ls-files

# verifica artefatti tracked da decidere
git ls-files | grep -E '^\.(agents|claude|copilot)'
git ls-files skills-lock.json

# locate potential untracked artifacts
find . -maxdepth 2 \( -name ".tmp" -o -name ".copilot-tracking" -o -name "node_modules" \) 2>/dev/null

# tag baseline prima delle rimozioni
git tag pre-cleanup-baseline

# gate CI automatizzabili (senza segreti)
npm run typecheck
npm run test
npm --prefix frontend run typecheck
npm --prefix frontend run test
npm --prefix frontend run build

# smoke manuale (richiede .env.local)
set -a && . ./.env.local && set +a && npm run test:smoke

# verifica .env.example non contiene segreti
grep -v '^#' .env.example | grep -v '^$'
```

## 7. Risks and Mitigations

- RISK-001: Rimozione di `.agents/` o `skills-lock.json` che risultano necessari a workflow CI/CD o onboarding.
  - MIT-001: TASK-005 include criterio esplicito (nessuna referenza in `.github/`) prima della rimozione.
- RISK-002: `.agents/` o `skills-lock.json` rimossi ma non gitignored → re-tracking accidentale.
  - MIT-002: TASK-005b aggiorna `.gitignore` contestualmente alla rimozione.
- RISK-003: Link rotti in docs dopo cleanup.
  - MIT-003: TASK-007 valida ogni link dell'indice prima del merge.
- RISK-004: Regressioni involontarie post cleanup.
  - MIT-004: run completo dei gate CI automatizzabili + smoke manuale (TASK-013÷015) prima del merge.
- RISK-005: Workflow CI con azioni non SHA-pinned esposti a supply chain attack post-pubblicazione.
  - MIT-005: TASK-011 pinna tutte le azioni a SHA verificato.
- RISK-006: Smoke test (`test:smoke`) inserito in pipeline CI senza segreti → exit 1 in CI.
  - MIT-006: smoke è classificato come gate manuale (TASK-015), non come step CI automatico.

## 8. Deliverables

- DEL-001: PR `chore/repo-publication-cleanup`
- DEL-002: repository senza artefatti locali/obsoleti
- DEL-003: checklist finale compilata con evidenza test
- DEL-004: `.github/workflows/main-pr-gate.yml` aggiornato con build step e SHA-pinned actions
- DEL-005: `.github/workflows/backend-gate.yml` nuovo workflow CI backend
- DEL-006: `.gitignore` aggiornato se `.agents/` e/o `skills-lock.json` rimossi
