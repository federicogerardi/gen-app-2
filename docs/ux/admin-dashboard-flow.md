# Admin Dashboard – User Flow & Design Principles

## User Flow Unificato

1. Login → redirect a `/admin`
2. Dashboard overview: widget stato, alert, quick actions e card di accesso alle rotte interne
3. Gestione modelli LLM: tabella, azioni, feedback
4. Gestione changelog: lista, azioni, feedback
5. Gestione segnalazioni: tabella, azioni, feedback
6. Attività recente: tabella filtrabile, badge, timestamp
7. Ritorno alla dashboard hub o navigazione tra rotte admin interne

## Design Principles
- Unificazione: dashboard come entry point, card/link interni, componenti riusabili
- Atomizzazione: ogni funzione in una pagina/section atomica, componenti granulari
- Consistenza: stili, feedback, layout coerenti
- Feedback: toast, badge, validazione inline, undo
- Accessibilità: tastiera, focus visibile, contrasto, label ARIA

## Accessibility Checklist
- [ ] Navigazione tastiera
- [ ] Focus visibile
- [ ] Contrasto minimo 4.5:1
- [ ] Label ARIA
- [ ] Feedback annunciati da screen reader
- [ ] Tabelle con header semantici
