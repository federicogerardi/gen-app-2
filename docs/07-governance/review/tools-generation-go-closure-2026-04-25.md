# Tools Generation GO Closure - 2026-04-25

Data: 2026-04-25
Stato: GO (condizionato a monitoraggio warning SSL smoke)
Scope: upload brief, extraction persistita, generation workflow Funnel/Nextland, completion e fallback

## 1. Executive Outcome

La pipeline tools e stata validata end-to-end su backend e frontend:

- Upload brief autenticato (`POST /api/tools/briefs`) operativo con ownership check.
- Extraction persistita come artifact dedicato (`type=extraction`) con payload strutturato.
- Workflow tool step-based completato per Funnel (`optin -> quiz -> vsl`) e Nextland (`landing -> thank_you`).
- Frontend integrato su stati reali `uploading/extracting/review/generating/done/failed`.

Decisione: GO operativo per rilascio controllato con kill-switch attivi.

## 2. Evidence Suite (TASK-019 rerun)

| Comando | Exit | Evidenza |
|---|---|---|
| `npm test` | `0` | `49 passed, 0 failed` |
| `set -a && . ./.env.local && set +a && npm run test:smoke` | `0` | `Smoke OK: claimed -> completed -> replay`, `lock present -> conflict`, `queries scoped/filtered` |
| `npm --prefix frontend run test` | `0` | `81 passed, 0 failed` |
| `npm --prefix frontend run typecheck` | `0` | `tsc --noEmit` senza errori |

Nota: nei comandi smoke compare warning di compatibilita futura su `pg-connection-string`/`sslmode`.

## 3. Runbook Operativo GO

### 3.1 Preflight

1. Caricare env locale per smoke/backend gate: `set -a && . ./.env.local && set +a`.
2. Verificare capability frontend:
   - `VITE_CAP_PROJECTS=true`
   - `VITE_CAP_ARTIFACTS=true`
   - `VITE_CAP_TOOLS_UPLOAD=true`
3. Verificare sessione autenticata e ownership progetto.

### 3.2 Smoke funzionale minimo

1. Login (`POST /auth/login`) con utente seed.
2. Upload brief (`POST /api/tools/briefs`) su progetto owner.
3. Avvio generation tool con `extractionArtifactId` valido.
4. Verifica artifact step/finale su archivio.

### 3.3 Osservabilita minima

Monitorare su finestra post-rilascio:

- Tasso errori upload (`4xx` validazione e `5xx` runtime).
- Tasso `protocol_error` lato frontend per mismatch SSE.
- Percentuale workflow completati per tool (`funnel-pages`, `nextland`).
- Tempo mediano da upload a completion.

## 4. Known Issues E Mitigazioni

- Warning SSL `pg-connection-string` in smoke: non blocca GO ma richiede hardening configurazione connessione DB prima del cutover finale.
- Endpoint models/admin-models non disponibili in backend as-is: fallback frontend rimane attivo e previsto.

## 5. No-Go Triggers Immediati

Bloccare rilascio o attivare rollback se si verifica almeno uno dei seguenti:

- Fallimento anche di un solo comando della suite bloccante.
- Aumento anomalo errori `protocol_error` SSE dopo deploy.
- Errori `403` su utenti owner validi (regressione ownership).
- Artifact extraction non persistiti o non recuperabili da API artifact.

## 6. Link Correlati

- `docs/99-lifecycle/99-archive/governance-pre-publish/frontend-sprint-go-checklist-snapshot-2026-04-24.md`
- `docs/99-lifecycle/99-archive/governance-pre-publish/frontend-sprint-regression-policy-snapshot-2026-04-24.md`
- `docs/specifications/xstate-system-as-is/testing-go-no-go-and-risk-spec.md`
- `docs/99-lifecycle/99-archive/planning/feature-frontend-generation-tools-go-1-snapshot-2026-04-25.md`

## 7. Delta Post-GO (2026-04-25)

Aggiornamenti runtime applicati dopo il GO iniziale:

- Normalizzazione model id OpenRouter a formato `provider/model` (`openrouter:auto` -> `openrouter/auto`).
- Iniezione esplicita del contesto brief nel payload messaggi LLM (`briefingText`/`normalizedText` + `extractionPayload`).
- Iniezione del contesto progressivo step-by-step (`stepDependencyArtifactContentsByStep`) oltre agli artifact id.

Impatto operativo:

- Ridotto rischio di output extraction che richiede nuovamente il brief nonostante upload/extraction completati.
- Migliorata coerenza semantica tra step successivi (quiz/vsl, thank_you) grazie al passaggio contenuti step precedenti.

Evidenza di regressione post-fix:

- suite backend: `53 passed, 0 failed`
- suite frontend tools-client: `3 passed, 0 failed`

## 8. Regressione Post-GO Chiusa (2026-04-26)

Scenario aggiornato:

1. avvio generazione step 1: OK
2. salvataggio output step 1: OK
3. passaggio automatico a step 2: OK

Risoluzione applicata:

- Correzione del calcolo step disponibili per non riproporre step gia completati.
- Ripristino del chaining automatico tra step consecutivi su template tools condiviso.

Evidenze di regressione post-fix:

- test frontend mirati: `npm --prefix frontend run test -- src/features/tools/runtime/tool-form-architecture.test.ts src/features/tools/ui/ToolPageTemplate.test.tsx` -> `4 passed, 0 failed`
- typecheck frontend: `npm --prefix frontend run typecheck` -> `0` errori
- conferma manuale: generation step-by-step funzionante in frontend

Riferimento operativo:

- `docs/99-lifecycle/99-archive/governance-pre-publish/frontend-sprint-go-checklist-snapshot-2026-04-24.md` (snapshot pre-publish di riferimento).

## 9. Delta As-Is Post-Refactor Frontend XState (2026-05-02)

Aggiornamento operativo successivo al piano `refactor-xstate-frontend-machines-1` completato.

Esiti confermati:

- smoke test tools completato fino all'ultimo artifact (GO)
- convergenza stabile `extracting -> ready` anche in presenza di artifact extraction gia persistito
- sincronizzazione input actor briefing su variazioni runtime (`projectId`/session)
- cleanup dead code frontend verificato con check strict TypeScript (`noUnusedLocals`/`noUnusedParameters`)

Conseguenza documentale:

- blueprint as-is e specifiche testing/risk aggiornate al delta 2026-05-02 per riflettere lo stato reale del sistema frontend.