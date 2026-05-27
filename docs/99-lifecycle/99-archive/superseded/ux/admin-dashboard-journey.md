# Admin Dashboard – User Journey Map

## Persona
- Amministratore tecnico, desktop, nessuna esigenza accessibilità specifica.
- Goal: Gestire e monitorare rapidamente tutte le funzioni amministrative.
- Success metric: Completare ogni task in <3 click dalla dashboard.

## Journey Stages

### 1. Accesso alla Dashboard
- Cosa fa: Login e atterraggio sulla dashboard.
- Pain: KPI non ancora tutti collegati a dati reali.
- Opportunità: Completare wiring progressivo mantenendo stati widget deterministici (`loading`/`empty`/`error`/`ready`).

### 2. Navigazione alle Funzioni
- Cosa fa: Usa la navigation persistente disponibile in tutte le rotte `/admin/*`.
- Pain: Necessita stato attivo sempre leggibile durante il passaggio tra pagine.
- Opportunità: Rafforzare indicatori visivi dello stato attivo e densita informativa admin-first.

### 3. Azione Specifica (es. Modifica Modello)
- Cosa fa: Esegue task amministrativo.
- Pain: Mancanza di feedback, errori silenziosi.
- Opportunità: Toast di conferma, undo, validazione inline.

### 4. Monitoraggio Attività Recente
- Cosa fa: Consulta log/attività.
- Pain: Placeholder, dati non aggiornati, filtri assenti.
- Opportunità: Tabella filtrabile, badge stato, timestamp chiari.

### 5. Overview KPI di Sistema
- Cosa fa: Legge i widget KPI della dashboard per priorizzare il triage operativo.
- Pain: Solo una parte dei widget e attualmente connessa a dati reali.
- Opportunità: Estendere il wiring reale a tutte le card KPI mantenendo fallback empty/error consistenti.

## Governance Alignment Reference
- La journey map e sincronizzata con la convergenza archetype descritta in `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`, sezione **3.2.3 Admin Overview companion layout (`/admin`)**.
