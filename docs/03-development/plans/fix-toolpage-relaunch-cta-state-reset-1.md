---
goal: Fix CTA bloccata su "Visualizza i risultati" dopo "Avvia di nuovo" da artifact
version: 1.0
date_created: 2026-05-05
last_updated: 2026-05-05
owner: Frontend/UI
status: 'Completed'
tags: [bug, toolpage, xstate, cta, relaunch, ux]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-green)

**Comportamento osservato (bug)**:
Dopo una generazione avvenuta con successo, l'utente clicca "Avvia di nuovo" su un artefatto
dallo storico. Il routing porta a `/tools/<tool>?intent=regenerate&sourceArtifactId=...`.
Il brief viene caricato correttamente (hydration funziona), ma:
- CTA primaria rimane su **"Visualizza i risultati"** (policy `open-last-artifact`)
- Colonna 3 mostra ancora il feedback della generazione precedente
- La macchina è in stato `completed` invece di `prefilled-regenerate`

**Root cause (confermata da analisi statica)**:
In `frontend/src/features/tools/machines/tool-page.machine.ts`, la funzione
`buildToolPageViewModel` valuta `hasCompletedAllSteps → open-last-artifact` **prima** di
`intent === 'regenerate' → regenerate-current-step`. Con tutti gli step completati da una
run precedente, il branch `regenerate` non viene mai raggiunto.

```
// Ordine attuale — ERRATO per intent=regenerate
1. generationError          → paused-with-checkpoint
2. hasCompletedAllSteps     → open-last-artifact   ← blocca qui (BUG)
3. intent === 'regenerate'  → regenerate-current-step  ← mai raggiunto
4. hasCheckpoint            → resume-checkpoint
...
```

Il test `tool-page.machine.test.ts` (riga ~252, `syncs unified progress in context via PROGRESS_SYNCED`)
attesta esplicitamente `open-last-artifact` per `intent='regenerate'` + tutti gli step
completati, codificando il comportamento errato come expected.

**Bounded context**: Frontend/UI — ToolPageMachine (DDD-019)

---

## 1. Requirements & Constraints

- **REQ-001**: Quando `intent === 'regenerate'`, la policy `regenerate-current-step` deve
  avere priorità su `open-last-artifact`, indipendentemente dallo stato dei completed steps.
- **REQ-002**: Il comportamento `open-last-artifact` rimane valido solo quando `intent` è
  `'new'` o `'resume'` (nessun intent relaunch attivo) e tutti gli step sono completati.
- **REQ-003**: Il test che codifica il comportamento errato (`open-last-artifact` per
  `intent=regenerate` + all-completed) deve essere aggiornato per attestare il comportamento
  corretto (`prefilled-regenerate` + `regenerate-current-step`).
- **REQ-004**: Nessuna regressione sui flussi `new`, `resume`, `paused-with-checkpoint`.
- **CON-001**: Il fix è circoscritto a `buildToolPageViewModel` in `tool-page.machine.ts` e
  al test associato. Nessuna modifica al routing, ai props o alla logica di hydration.

---

## 2. Implementation Steps

### Implementation Phase A — Fix priorità guardie in `buildToolPageViewModel`

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-A-001 | In `frontend/src/features/tools/machines/tool-page.machine.ts`: spostare il blocco `if (intent === 'regenerate' && ...)` **prima** del blocco `if (hasCompletedAllSteps)`. La condizione per regenerate diventa: `intent === 'regenerate' && readiness.canStartFlow` (rimuovere il requisito `hasCompletedAtLeastOneStep` — se si naviga con intent=regenerate si presuppone un sourceArtifact, la progressione è irrilevante per la policy). | ✅ | 2026-05-05 |
| TASK-A-002 | In `frontend/src/features/tools/machines/tool-page.machine.test.ts` (riga ~252): aggiornare le assertion del test `syncs unified progress in context via PROGRESS_SYNCED` per `intent=regenerate` con tutti gli step completati: `canonicalState` → `'prefilled-regenerate'`, `primaryActionPolicy` → `'regenerate-current-step'`. | ✅ | 2026-05-05 |
| TASK-A-003 | Aggiungere un test dedicato che attesta la separazione: `intent='new'` + all-steps-completed → `open-last-artifact`; `intent='regenerate'` + all-steps-completed → `regenerate-current-step`. | ✅ | 2026-05-05 |
| TASK-A-004 | Eseguire `npm --prefix frontend run typecheck` e `npm --prefix frontend run test`. Verificare baseline test stabile. | ✅ | 2026-05-05 |

**Gate A**: `npm --prefix frontend run test` → test `syncs unified progress in context via PROGRESS_SYNCED` verde con nuove assertion; nessun fail aggiuntivo; typecheck pulito.

---

## 3. Alternatives

- **ALT-001**: Aggiungere una guardia separata `intent === 'regenerate'` dentro il blocco
  `hasCompletedAllSteps` invece di riordinare. Scartato: introduce duplicazione e rende il
  flow condizionale più difficile da leggere. Il riordino è più esplicito.
- **ALT-002**: Gestire il reset di stato a livello di routing (reset del context macchina
  al mount della pagina). Scartato: il context viene preservato per consentire la hydration
  da sourceArtifact; azzerare i `completedSteps` prima della hydration rompe il progress
  tracking del resume checkpoint.

---

## 4. Files

- **FILE-001**: `frontend/src/features/tools/machines/tool-page.machine.ts` — fix priorità guardie in `buildToolPageViewModel`
- **FILE-002**: `frontend/src/features/tools/machines/tool-page.machine.test.ts` — aggiornamento assertion + nuovo test case

---

## 5. Testing

- **TEST-001**: `intent='regenerate'` + tutti gli step completati + briefing ready →
  `canonicalState: 'prefilled-regenerate'`, `primaryActionPolicy: 'regenerate-current-step'`.
- **TEST-002**: `intent='new'` + tutti gli step completati + briefing ready →
  `canonicalState: 'completed'`, `primaryActionPolicy: 'open-last-artifact'` (invariato).
- **TEST-003**: `intent='resume'` + tutti gli step completati + briefing ready →
  `canonicalState: 'completed'`, `primaryActionPolicy: 'open-last-artifact'` (invariato).
- **TEST-004**: `intent='regenerate'` + zero step completati + briefing ready →
  `canonicalState: 'prefilled-regenerate'`, `primaryActionPolicy: 'regenerate-current-step'`.

---

## 6. Risks & Assumptions

- **RISK-001**: Il riordino potrebbe impattare il caso `intent=regenerate` + errore
  di generazione (`generationError !== null`). Verificare che il blocco `generationError`
  resti primo nella catena (ha priorità assoluta su tutto).
- **ASSUMPTION-001**: Colonna 3 (feedback precedente) scomparirà automaticamente quando
  la macchina emette `prefilled-regenerate`; il template usa `effectiveCanonicalState` che
  dipende da `machineViewModel.canonicalState`.
- **ASSUMPTION-002**: La condizione `hasCompletedAtLeastOneStep` nella guardia regenerate
  è ridondante con `intent=regenerate` (si naviga da un artifact esistente, quindi almeno
  uno step era completato). Rimozione sicura.
