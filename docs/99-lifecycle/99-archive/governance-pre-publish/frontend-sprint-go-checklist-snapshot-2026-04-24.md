---
status: archived
version: 1.0
last-reviewed: 2026-04-26
next-review-date: null
owner: Frontend Platform
title: Frontend Sprint Go/No-Go Checklist (Archived)
date-archived: 2026-04-26
original-path: docs/07-governance/review/frontend-sprint-go-checklist.md
---

# Frontend Sprint – Go/No-Go Checklist — Snapshot 2026-04-24

**Archived**: This sprint checklist describes pre-publish validation phases. The frontend is now in GO state as evidenced by `tools-generation-go-closure-2026-04-25.md`.

**Original Purpose**: Validazione E2E locale e gate automatico per sprint frontend.

**Status at Archive**: Completed. All checklist items verified green (74 test passed, 0 failed).

## Checklist Summary

| Step | Path | Azione | Esito atteso | Verificato |
|---|---|---|---|---|
| 1 | `/` | Aprire app non autenticata | Form login visibile, nessun redirect loop | ✅ |
| 2 | `/` | Inserire credenziali valide e premere Login | Redirect a `/dashboard` | ✅ |
| 3 | `/dashboard` | Verificare card Projects, Tools, Recent Artifacts | 3 card visibili, link funzionanti | ✅ |
| 4 | `/dashboard/projects` | Lista progetti | Dati live da backend con capability attive | ✅ |
| 5 | `/dashboard/projects/new` | Form nuovo progetto | Form renderizzato senza crash | ✅ |
| 6 | `/tools/funnel-pages` | Step funnel optin→quiz→vsl | Step progress UI visibile, step in sequenza | ✅ |
| 7 | `/tools/nextland` | Step landing→thank_you | Step sequence corretta | ✅ |
| 8 | `/artifacts` | Archivio artifacts | Filtri tipo/stato/progetto visibili | ✅ |
| 9 | `/artifacts/:id` | Dettaglio artifact | Meta, content, link relaunch | ✅ |
| 10 | `/artifacts/:id` | Click "Relaunch" | Nuova request generazione con metadata relaunch | ✅ |
| 11 | `/admin` (non-admin) | Navigare a /admin con ruolo `user` | Redirect a `/dashboard` | ✅ |
| 12 | `/admin` (admin) | Navigare a /admin con ruolo `admin` | Lista utenti visibile | ✅ |

## Gate Automatico

```bash
npm --prefix frontend run typecheck && npm --prefix frontend run test
npm run frontend:sprint:gate
```

**Risultato ultima esecuzione**: 74/74 tests passed — 2026-04-24

## Canonical Reference

For current frontend validation, see:
- `docs/07-governance/review/tools-generation-go-closure-2026-04-25.md` (GO evidence)
