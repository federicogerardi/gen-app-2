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

---

## Criteri rollback e kill-switch (Tools Upload GO)

### Trigger rollback immediato

Eseguire rollback o disattivazione feature se almeno una condizione si presenta in produzione:

1. Error rate upload brief (`POST /api/tools/briefs`) >= 5% su finestra di 15 minuti.
2. Aumento `protocol_error` SSE oltre soglia baseline +2x su finestra di 15 minuti.
3. Regressione ownership (`403` inattesi su utenti owner validi) verificata su piu richieste consecutive.
4. Pipeline bloccata: extraction artifact non persistito o generation non avviabile con `extractionArtifactId` valido.

### Kill-switch frontend

- Flag: `VITE_CAP_TOOLS_UPLOAD`.
- Azione: impostare `VITE_CAP_TOOLS_UPLOAD=false` per rimuovere percorso upload/extraction dalla UI e tornare a percorso senza upload.
- Verifica post-toggle: pagina tool accessibile senza crash e senza chiamate a `POST /api/tools/briefs`.

### Toggle backend (eventuale)

- Se presente un toggle server-side dedicato (esempio `CAP_TOOLS_UPLOAD_API`), impostarlo a `false` in parallelo al kill-switch frontend.
- Se toggle backend non ancora presente, applicare rollback applicativo della route tools o blocco controllato con risposta esplicita `503` + codice errore stabile.

### Procedura operativa rollback

1. Applicare kill-switch frontend.
2. Applicare toggle backend/rollback route.
3. Verificare healthcheck API e assenza nuove richieste upload.
4. Rieseguire suite minima: `npm --prefix frontend run typecheck`, `npm --prefix frontend run test`, `npm test`.
5. Aprire incidente e allegare evidenze in checklist GO/review.