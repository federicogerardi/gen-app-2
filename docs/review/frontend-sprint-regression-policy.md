# Frontend Sprint – Regression Policy

**Versione**: 1.0 — 2026-04-24

---

## Regola bloccante

> **Merge vietato se `npm run frontend:sprint:gate` fallisce.**

Il gate include, in ordine:
1. `npm --prefix frontend run typecheck` — zero errori TypeScript
2. `npm --prefix frontend run test` — zero test falliti
3. `npm run backend:go` — zero regressioni backend (migrations + seeds + typecheck + tests + smoke)

---

## Categorie di regressione

| Categoria | Gate che la rileva | Azione |
|---|---|---|
| Errore TypeScript frontend | `typecheck` | Fix obbligatorio prima del merge |
| Test frontend fallito | `vitest run` | Fix obbligatorio prima del merge |
| Errore TypeScript backend | `backend:go → typecheck` | Fix obbligatorio prima del merge |
| Test backend fallito | `backend:go → test` | Fix obbligatorio prima del merge |
| Smoke adapter fallito | `backend:go → test:smoke` | Fix obbligatorio; verificare `.env.local` |

---

## Procedura in caso di fallimento

1. **Non fare merge** del branch.
2. Leggere l'output del gate per identificare il modulo/file fallente.
3. Correggere la regressione nel branch corrente.
4. Rieseguire `npm run frontend:sprint:gate` fino a esito verde.
5. Solo dopo esito verde: procedere con merge/PR.

---

## Note operative

- `.env.local` richiesto per `backend:go` (smoke adapter usa credenziali DB/Redis locali). Usare `set -a && . ./.env.local && set +a` prima del gate in CI locale.
- Il gate CI (`.github/workflows/frontend-sprint-gate.yml`) esegue solo i passi 1–2 (typecheck + test frontend) in ambienti CI senza DB/Redis.
- Aggiungere job backend:go in CI separato con servizi docker quando disponibili.
