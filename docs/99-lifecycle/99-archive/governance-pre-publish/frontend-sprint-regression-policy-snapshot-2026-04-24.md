---
status: archived
version: 1.0
last-reviewed: 2026-04-26
next-review-date: null
owner: Frontend Platform
title: Frontend Sprint Regression Policy (Archived)
date-archived: 2026-04-26
original-path: docs/07-governance/review/frontend-sprint-regression-policy.md
---

# Frontend Sprint – Regression Policy — Snapshot 2026-04-24

**Archived**: This sprint regression policy describes pre-publish validation gates. The frontend is now in GO state as evidenced by `tools-generation-go-closure-2026-04-25.md`.

**Original Purpose**: Definire regole bloccanti di regressione per merge durante sprint frontend.

**Status at Archive**: Completed. All regression gates passed successfully.

## Regola Bloccante

> **Merge vietato se `npm run frontend:sprint:gate` fallisce.**

Il gate include, in ordine:
1. `npm --prefix frontend run typecheck` — zero errori TypeScript
2. `npm --prefix frontend run test` — zero test falliti
3. `npm run backend:go` — zero regressioni backend

## Categorie di Regressione Monitorate

| Categoria | Gate che la rileva | Azione |
|---|---|---|
| Errore TypeScript frontend | `typecheck` | Fix obbligatorio prima del merge |
| Test frontend fallito | `vitest run` | Fix obbligatorio prima del merge |
| Errore TypeScript backend | `backend:go → typecheck` | Fix obbligatorio prima del merge |
| Test backend fallito | `backend:go → test` | Fix obbligatorio prima del merge |
| Smoke adapter fallito | `backend:go → test:smoke` | Fix obbligatorio |

## Procedura in Caso di Fallimento

1. Non fare merge del branch
2. Leggere l'output del gate per identificare il modulo/file fallente
3. Correggere la regressione nel branch corrente
4. Rieseguire `npm run frontend:sprint:gate` fino a esito verde
5. Solo dopo esito verde: procedere con merge/PR

## Canonical Reference

For current regression validation, see:
- `docs/07-governance/review/tools-generation-go-closure-2026-04-25.md` (GO evidence)
