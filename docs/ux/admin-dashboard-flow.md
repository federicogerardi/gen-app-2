# Admin Dashboard – User Flow & Design Principles

## User Flow Unificato

1. Login → redirect a `/admin`
2. Dashboard overview: widget KPI in card con stati `loading`/`empty`/`error`/`ready`; prime integrazioni reali su `UserReport aperti` e `Stato catalogo LlmModel`
3. Navigazione persistente admin (layout-level) disponibile su tutte le rotte `/admin/*`
4. Gestione modelli LLM: tabella, azioni, feedback
5. Gestione changelog: lista, azioni, feedback
6. Gestione segnalazioni: tabella, azioni, feedback
7. Attività recente: tabella filtrabile, badge, timestamp
8. Ritorno alla dashboard hub o navigazione tra rotte admin interne tramite navigation persistente

## Design Principles
- Unificazione: dashboard come entry point con navigation persistente condivisa tra tutte le rotte admin
- KPI-first overview: card widget con stato esplicito (`loading`/`empty`/`error`/`ready`) pronte al collegamento dati reale
- Atomizzazione: ogni funzione in una pagina/section atomica, componenti granulari
- Consistenza: stili, feedback, layout coerenti
- Feedback: toast, badge, validazione inline, undo
- Accessibilità: tastiera, focus visibile, contrasto, label ARIA

## Governance Alignment Reference
- Questo flow adotta la convergenza archetype definita in `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`, sezione **3.2.3 Admin Overview companion layout (`/admin`)**.

## Accessibility Checklist
- [ ] Navigazione tastiera
- [ ] Focus visibile
- [ ] Contrasto minimo 4.5:1
- [ ] Label ARIA
- [ ] Feedback annunciati da screen reader
- [ ] Tabelle con header semantici
