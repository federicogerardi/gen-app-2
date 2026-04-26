# GUI Scope As-Is Replication Spec

Versione: 1.0  
Status: Active  
Data: 2026-04-24

## 1. Obiettivo

Definire il perimetro GUI as-is come insieme di moduli funzionali e strutturali riproducibili in un ambiente differente, mantenendo le stesse logiche di:

- navigazione
- generazione multi-step
- uso e rilancio tool
- consultazione storico artefatti
- gestione amministrativa

Questo documento e pensato come specifica operativa standalone: puo essere usato come base per ricostruire una GUI equivalente anche fuori da Next.js, preservando comportamento e contratti utente.

## 2. Scope

In scope:

- shell autenticata, navbar e struttura pagine
- mappa route GUI e semantica sezioni
- workflow tool (setup, upload, extraction, generate, resume, regenerate)
- storico artefatti e dettaglio con azioni di relaunch
- area admin (utenti, quote, modelli, activity)
- contratti minimi di stato UI e dipendenze API

Out of scope:

- look and feel pixel-perfect
- dipendenze framework-specifiche non funzionali
- dettagli interni provider LLM (coperti da ADR/specifiche backend)

## 3. Principi di Replica

I seguenti vincoli sono non negoziabili per l'equivalenza funzionale:

1. Navigazione projects-first: progetto come contenitore primario, storico artefatti come vista trasversale secondaria.
2. Tool workflow guidato: setup -> briefing -> extraction -> generation step-based con stato visibile.
3. Generazione robusta: retry automatico su errori retryable e messaggistica stato in UI.
4. Resume/regenerate: possibilita di recuperare checkpoint da artifact gia presenti.
5. Guardrail utente: azioni primarie disabilitate finche prerequisiti minimi non sono soddisfatti.
6. Ownership implicita in UX: tutte le viste e azioni operate nel perimetro dell'utente autenticato.

## 4. Mappa Informativa GUI (As-Is)

## 4.1 Route Primarie

| Route | Ruolo UX | Tipo modulo |
| --- | --- | --- |
| `/` | Accesso (Google sign-in) | Public entry |
| `/dashboard` | Hub operativo project-first | Workspace overview |
| `/dashboard/projects` | Lista progetti utente | Workspace index |
| `/dashboard/projects/new` | Creazione progetto | Creation flow |
| `/dashboard/projects/:id` | Dettaglio progetto + artifact contestuali | Context workspace |
| `/tools/funnel-pages` | Tool workflow 3 step (optin/quiz/vsl) | Guided generation |
| `/tools/nextland` | Tool workflow 2 step (landing/thank_you) | Guided generation |
| `/artifacts` | Storico personale trasversale | Archive/audit view |
| `/artifacts/:id` | Dettaglio artifact + relaunch actions | Artifact inspection |
| `/admin` | Superficie amministrativa (solo role admin) | Admin control plane |

## 4.2 Navigazione Globale

Ordine as-is navbar:

1. Dashboard
2. Progetti
3. Tools (menu con HotLeadFunnel, NextLand)
4. Storico
5. Admin (solo se ruolo admin)

Elementi strutturali fissi:

- badge runtime (ambiente + versione)
- email utente autenticato
- azione di sign-out
- variante desktop + variante mobile con menu collassabile

## 5. Moduli Riproducibili

Ogni modulo sotto e definito con responsabilita, dipendenze e contratto minimo replicabile.

## 5.1 Modulo Shell Autenticata

Responsabilita:

- fornire layout comune con navbar sticky
- applicare contenitore pagina uniforme (`PageShell`)
- ospitare provider sessione utente e query cache client

Contratto minimo:

- ogni pagina autenticata usa shell condivisa
- skip-link verso contenuto principale
- overlay di background non interattivo (solo visuale)

## 5.2 Modulo Dashboard Project-First

Responsabilita:

- mostrare CTA verso progetti (`/dashboard/projects`, `/dashboard/projects/new`)
- esporre shortcut tool
- mostrare ultimi artifact e metriche quota utente

Comportamenti minimi:

- visualizzazione lista progetti recenti
- visualizzazione ultimi artifact con badge tipo/stato
- link diretto al dettaglio artifact e allo storico

## 5.3 Modulo Workspace Progetti

Responsabilita:

- lista completa progetti utente
- dettaglio progetto con artifact del contesto

Comportamenti minimi:

- in dettaglio progetto, ogni artifact espone almeno: tipo, stato, modello, data, link dettaglio
- pulsanti ponte verso storico globale e lista progetti

## 5.4 Modulo Tool Setup Comune

Responsabilita:

- selezione progetto (obbligatoria)
- upload briefing file (obbligatorio)
- opzioni facoltative: modello, tono, note

Vincoli input:

- tipi file supportati: `.docx`, `.txt`, `.md`
- senza progetto selezionato, upload disabilitato

Contratto stati base:

- `phase`: `idle | uploading | extracting | review | generating`
- `intent`: `new | resume | regenerate`
- `extractionLifecycle`: `idle | in_progress | completed_partial | completed_full | failed_hard`

## 5.5 Modulo Tool Generation Engine (UI-Side)

Responsabilita:

- orchestrare chiamate step-by-step
- leggere stream SSE-like via `fetch` + `ReadableStream`
- aggiornare stato step (`idle/running/done/error`)
- esporre retry notice e resume notice

Contratto stream minimo atteso:

- evento `start` con `artifactId` opzionale
- evento `token` con chunk testo
- evento `complete` con `content` finale e `artifactId`
- evento `error` con `message`

## 5.6 Modulo HotLeadFunnel (3 Step)

Step order obbligatorio:

1. `optin`
2. `quiz` (dipende da output optin)
3. `vsl` (dipende da output optin + quiz)

Endpoint GUI dipendenti:

- upload: `/api/tools/funnel-pages/upload`
- extraction: `/api/tools/extraction/generate`
- generation: `/api/tools/funnel-pages/generate`

## 5.7 Modulo NextLand (2 Step)

Step order obbligatorio:

1. `landing`
2. `thank_you` (dipende da output landing)

Endpoint GUI dipendenti:

- upload: `/api/tools/nextland/upload`
- extraction: `/api/tools/extraction/generate`
- generation: `/api/tools/nextland/generate`

## 5.8 Modulo Resume/Checkpoint

Responsabilita:

- recuperare artifact recenti progetto (`/api/artifacts?projectId=...&limit=100`)
- riallineare extraction context e step completati/parziali

Regole as-is:

- priorita extraction checkpoint: `generating` > `completed_partial` > `completed`
- se esistono step ma manca extraction context: forzare caricamento nuovo briefing prima di ripresa
- auto-resume attivo solo con `intent=resume` e `sourceArtifactId` presente

## 5.9 Modulo Storico Artefatti

Responsabilita:

- fornire vista trasversale personale con filtri
- consentire apertura dettaglio, relaunch e cancellazione

Filtri minimi as-is:

- tipo (`content/seo/code`)
- stato (`generating/completed/failed`)
- progetto
- periodo (`all/7d/30d/90d`)

## 5.10 Modulo Dettaglio Artefatto

Responsabilita:

- rendere output formattato leggibile (markdown)
- mostrare metadati operativi (token, stato, date)
- offrire azioni di relaunch coerenti con workflow originale

Azioni minime:

- torna allo storico
- apri progetto di contesto
- relaunch primario + eventuali secondari (se applicabili)

## 5.11 Modulo Admin

Responsabilita:

- vista KPI generali (utenti, artifact, completamento, spesa)
- gestione utenti (ricerca, paginazione, quota/budget)
- gestione registry modelli LLM (CRUD + toggle default/active)
- activity feed recente con filtri stato/tipo

Vincolo accesso:

- accessibile solo a utente con ruolo admin

## 6. Stati UI Canonici (Tool Pages)

Stati UI derivati minimi:

- `draft-empty`
- `processing-briefing`
- `draft-ready`
- `prefilled-regenerate`
- `paused-with-checkpoint`
- `resume-needs-briefing`
- `running`
- `completed`

Policy azione primaria:

- in `processing-briefing` o `running`: bottone primario disabilitato
- in `draft-ready`: azione primaria avvia generazione
- in `paused-with-checkpoint`: azione primaria riprende checkpoint
- in `completed`: azione primaria apre ultimo artifact disponibile

## 7. Contratto Errori e Retry (GUI)

Contratto error payload atteso:

```json
{ "error": { "code": "ERROR_CODE", "message": "...", "details": {} } }
```

Regole retry UI-side:

- retry automatico con backoff per errori retryable (`>=500`, `429` rate-limit temporaneo, `INTERNAL_ERROR`, `RATE_LIMIT_EXCEEDED`)
- nessun retry su `quota_exhausted`
- massimo tentativi: 3

## 8. Sequenze Funzionali Minime

## 8.1 Flusso Base Generazione Tool

1. utente seleziona progetto
2. utente carica briefing
3. GUI invia upload e poi extraction
4. GUI entra in `review` con contesto estratto
5. utente avvia generazione
6. GUI esegue step sequenziali con stream e artifactId per step
7. su successo, stato `completed` e apertura artifact possibile

## 8.2 Flusso Resume

1. utente invoca resume da checkpoint
2. GUI carica artifact progetto
3. GUI ricostruisce extraction + step progress
4. se prerequisiti completi, consente ripresa; altrimenti richiede nuovo briefing

## 9. Dipendenze API Minime lato GUI

Endpoint necessari alla replica:

- `/api/projects` (lista progetti)
- `/api/models` (lista modelli disponibili)
- `/api/artifacts` (lista/filter/checkpoint)
- `/api/tools/funnel-pages/upload`
- `/api/tools/funnel-pages/generate`
- `/api/tools/nextland/upload`
- `/api/tools/nextland/generate`
- `/api/tools/extraction/generate`
- `/api/admin/users` (admin)
- `/api/admin/models` e `/api/admin/models/:id` (admin)

Per contratti dettagliati e codici errore usare la fonte canonica: `docs/specifications/api-specifications.md`.

## 10. Checklist di Equivalenza per Porting

Una replica GUI e considerata equivalente quando:

1. la mappa route e la gerarchia navigazione rispecchiano il modello projects-first.
2. i due tool supportano setup/upload/extraction/generation/resume/regenerate.
3. la generazione e sequenziale per step con dipendenze inter-step rispettate.
4. storico e dettaglio artifact supportano recupero, audit e relaunch.
5. l'admin e segregato per ruolo e mantiene funzioni di controllo utenti/modelli.
6. contratti di stato, errore e retry rispettano questo documento.