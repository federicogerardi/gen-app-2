# Frontend Sprint – Go/No-Go Checklist

**Data**: 2026-04-24  
**Versione piano**: feature-frontend-ux-sprints-1.md v1.0  
**Esito gate CI**: ✅ Verde (74 test passed, 0 failed)

---

## Checklist E2E locale (manuale)

Flusso: login → dashboard → tool → artifacts → relaunch → admin users

| Step | Path | Azione | Esito atteso | Verificato |
|---|---|---|---|---|
| 1 | `/` | Aprire app non autenticata | Form login visibile, nessun redirect loop | ✅ |
| 2 | `/` | Inserire credenziali valide e premere Login | Redirect a `/dashboard` | ✅ |
| 3 | `/dashboard` | Verificare card Projects, Tools, Recent Artifacts | 3 card visibili, link funzionanti | ✅ |
| 4 | `/dashboard/projects` | Lista progetti | Dati live da backend con capability attive; nessun mock locale | ✅ |
| 5 | `/dashboard/projects/new` | Form nuovo progetto | Form renderizzato senza crash | ✅ |
| 6 | `/tools/funnel-pages` | Step funnel optin→quiz→vsl | Step progress UI visibile, step in sequenza | ✅ |
| 7 | `/tools/nextland` | Step landing→thank_you | Step sequence corretta | ✅ |
| 8 | `/artifacts` | Archivio artifacts | Filtri tipo/stato/progetto visibili; fallback locale se nessun artifact | ✅ |
| 9 | `/artifacts/:id` | Dettaglio artifact | Meta, content, link relaunch e torna-archivio | ✅ |
| 10 | `/artifacts/:id` | Click "Relaunch" | Nuova request generazione con metadata relaunch | ✅ |
| 11 | `/admin` (non-admin) | Navigare a /admin con ruolo `user` | Redirect a `/dashboard` | ✅ |
| 12 | `/admin` (admin) | Navigare a /admin con ruolo `admin` | Lista utenti visibile | ✅ |

---

## Gate automatico

```bash
# Eseguire prima di ogni merge:
npm --prefix frontend run typecheck && npm --prefix frontend run test
# Per gate bloccante completo (include backend no-regression):
npm run frontend:sprint:gate
```

Risultato ultima esecuzione: **74/74 tests passed** — 2026-04-24

## TASK-019 - Full Suite Execution (2026-04-25)

Comandi richiesti dal gate completo eseguiti in locale sul repository root.

| Comando | Esito | Evidenza sintetica |
|---|---|---|
| `npm test` | ✅ `0` | Node test runner: **49 passed, 0 failed** |
| `npm run test:smoke` | ✅ `0` | `Smoke OK: claimed -> completed -> replay`, `Smoke OK: lock present -> conflict`, `Smoke OK: query repositories projects/artifacts are scoped and filtered correctly` |
| `npm --prefix frontend run test` | ✅ `0` | Vitest frontend: **81 passed, 0 failed** |
| `npm --prefix frontend run typecheck` | ✅ `0` | `tsc -p tsconfig.json --noEmit` completato senza errori |

Esito gate TASK-019: **GO** (suite completa verde).

Conferma rerun 2026-04-25: riesecuzione completa effettuata con stessi esiti (`49/49` backend, smoke OK, `81/81` frontend, typecheck zero errori).

Nota operativa: durante gli smoke test appare un warning SSL di `pg-connection-string` su semantica futura di `sslmode`; non blocca la suite ma va pianificata una normalizzazione connessione (`sslmode=verify-full` oppure `uselibpqcompat=true&sslmode=require`) prima del cutover finale.

---

## Note

- Endpoint `/api/projects` e `/api/artifacts` disponibili e validati in locale con sessione autenticata.
- Endpoint `/api/models` e `/api/admin/models` non ancora disponibili → fallback locale attivo per quei moduli.
- Delete artifact disabilitato via `VITE_ARTIFACT_DELETE_ENABLED=false` (default).
- Admin models: banner "Backend endpoint pending" visibile (corretto per as-is).
- Backend `/admin/users` disponibile e testato con seed user `seed-user-001@example.local`.

---

## Cutover Capability Live (2026-04-25)

Env frontend per attivare percorso live:

```bash
VITE_CAP_PROJECTS=true
VITE_CAP_ARTIFACTS=true
VITE_CAP_TOOLS_UPLOAD=true
```

Evidenza API E2E locale (cookie sessione attivo):

| Step | Endpoint | Esito |
|---|---|---|
| 1 | `POST /auth/login` | ✅ `200` |
| 2 | `GET /api/projects` | ✅ `200` |
| 3 | `POST /api/projects` | ✅ `201` |
| 4 | `GET /api/artifacts?status=completed` | ✅ `200` |
| 5 | `POST /api/tools/briefs` | ✅ `201` |

Decisione fallback projects:

- fallback projects vuoto (nessun mock) quando capability projects e disattivata;
- con capability attiva il ramo live rimane il path primario.

Conferma utente registrata:

- capability attive abilitate in frontend;
- funzionalita list/create projects confermata operativa lato frontend.

---

## Regressione Chiusa - Tool Step Chain (2026-04-26)

Esito corrente:

- Step-by-step frontend nuovamente operativo (step 1 -> step 2 auto-chain).
- Stato regressione: chiusa.

Fix applicato:

- Corretto il calcolo degli step disponibili per escludere gli step gia completati.
- Riallineato il comportamento del next step rispetto agli artifact completati.

Evidenze di validazione:

- Test frontend mirati: `npm --prefix frontend run test -- src/features/tools/runtime/tool-form-architecture.test.ts src/features/tools/ui/ToolPageTemplate.test.tsx` -> `4 passed, 0 failed`.
- Typecheck frontend: `npm --prefix frontend run typecheck` -> nessun errore.
- Conferma operativa utente: generation step-by-step funzionante in frontend.

Owner tecnico: frontend tools runtime/template.
Priorita: chiusa.