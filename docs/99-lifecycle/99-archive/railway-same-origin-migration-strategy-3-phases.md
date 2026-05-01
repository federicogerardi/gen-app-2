---
status: archived
version: 1.0
last-reviewed: 2026-05-01
next-review-date: N/A
owner: Platform/DevOps
---

> **ARCHIVED 2026-05-01** — Superseded da [feature-railway-same-origin-unified-1](../../plan/feature-railway-same-origin-unified-1.md), piano unificato che integra questa strategia con il piano implementativo infrastrutturale.

# Railway Same-Origin Migration Strategy (3 Phases)

Data: 2026-04-28
Stato: archived
Owner: Platform/DevOps
Scope: migrazione graduale da architettura cross-origin (frontend/backend su host diversi) a same-origin per stabilizzare sessioni mobile e semplificare CORS/CSRF.

## Obiettivo

Esporre frontend e backend sotto un unico host pubblico, mantenendo:

- disponibilita continua durante la transizione;
- rollback rapido in caso di regressioni;
- compatibilita con auth cookie-based e SSE.

Target logico:

```text
https://app.<domain>/          -> frontend
https://app.<domain>/api/...   -> backend
https://app.<domain>/auth/...  -> backend
https://app.<domain>/generation/... -> backend
```

## Prerequisiti

1. Frontend e backend deployati e healthy su Railway.
2. Domini custom disponibili (DNS gestibile).
3. Healthcheck attivi su entrambi i servizi.
4. Variabili backend cross-origin attuali documentate (baseline pre-migrazione).

## Fase 1 - Foundation (Dual Host, Zero-Risk)

Goal: preparare la piattaforma e i domini senza cambiare ancora il routing utente principale.

Attivita:

1. Configurare custom domain per backend (es. `api.<domain>`).
2. Configurare custom domain per frontend (es. `app.<domain>`).
3. Aggiornare env backend per includere il nuovo frontend domain in `CORS_ALLOWED_ORIGINS` e `CSRF_TRUSTED_ORIGINS` (separati da virgola con eventuali origin legacy).
4. Verificare login/logout/session refresh su desktop e mobile con i nuovi domini.

Criteri di uscita:

1. `GET /health` frontend e backend rispondono 200 sui nuovi domini.
2. Nessun incremento di 401/403 anomali nelle route auth/api.

Rollback:

1. Ripristinare origin legacy in env backend.
2. Reindirizzare traffico utente al dominio frontend precedente.

## Fase 2 - Same-Origin Cutover (Controlled)

Goal: esporre frontend e backend sotto unico host pubblico.

Attivita:

1. Introdurre layer di routing (reverse proxy o edge routing) che pubblichi:
   - `/` e static asset verso frontend;
   - `/api`, `/auth`, `/generation`, `/admin` verso backend.
2. Impostare frontend `VITE_API_BASE_URL` a stringa vuota (`""`) o path relativo, per usare stesso origin.
3. Aggiornare backend:
   - `FRONTEND_ORIGIN=https://app.<domain>`
   - `CORS_ALLOWED_ORIGINS=https://app.<domain>`
   - `CSRF_TRUSTED_ORIGINS=https://app.<domain>`
   - `AUTH_COOKIE_SECURE=true`
   - `AUTH_COOKIE_SAMESITE=lax` (same-origin target)
4. Validare OAuth callback sul dominio backend/same-origin designato.

Criteri di uscita:

1. Login persistente su mobile dopo refresh (no logout involontario).
2. Nessun errore CORS lato browser.
3. SSE `/generation/stream` funzionante senza regressioni.

Rollback:

1. Ripristinare routing cross-origin (frontend e backend host separati).
2. Ripristinare `AUTH_COOKIE_SAMESITE=none` se ritorno a cross-origin.

## Fase 3 - Hardening & Cleanup

Goal: consolidare lo stato same-origin e rimuovere configurazione legacy.

Attivita:

1. Rimuovere origin legacy da CORS/CSRF env backend.
2. Ridurre superficie CORS ai soli host necessari.
3. Aggiornare runbook e dashboard alert su:
   - 401/403 auth;
   - healthcheck frontend/backend;
   - errori SSE.
4. Aggiornare documentazione tecnica e operativa (deploy, troubleshooting, incident response).

Criteri di uscita:

1. 7 giorni di osservazione senza incidenti auth/sessione mobile.
2. Nessun uso residuo dei domini legacy nei client attivi.

Rollback:

1. Non richiesto se finestra di osservazione completata; in caso di regressione severa, riattivare snapshot routing fase 2.

## Risk Register (Sintetico)

1. OAuth redirect mismatch dopo cutover.
2. Regole path routing incomplete (es. `/auth/*` o `/generation/*` non inoltrate).
3. Cache edge/stale config durante switch DNS.
4. Cookie policy non allineata tra same-origin e fallback cross-origin.

## Checklist GO/NO-GO

GO solo se:

1. Healthcheck verdi su entrambi i servizi.
2. Login persistente validato su mobile reale.
3. SSE e CRUD principali validati end-to-end.
4. Piano rollback verificato e documentato.

NO-GO se:

1. 401/403 in aumento dopo cutover.
2. OAuth callback fallisce su dominio target.
3. Route backend non raggiungibili dal dominio unificato.
