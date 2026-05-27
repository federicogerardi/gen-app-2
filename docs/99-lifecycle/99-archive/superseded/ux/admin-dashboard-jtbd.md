# Admin Dashboard – Jobs To Be Done (JTBD)

## Job Statement
Quando sono un amministratore e accedo al backend, voglio avere una dashboard centralizzata che mi permetta di gestire modelli LLM, changelog, segnalazioni e monitorare l’attività recente, così posso amministrare il sistema in modo efficiente e senza confusione.

## Soluzione attuale & Pain Points
- Soluzione: Dashboard hub su `/admin` con navigation persistente su `/admin/*` e overview KPI a card con stati widget.
- Pain:
  - Non tutti i KPI sono ancora alimentati da dati reali.
  - Incoerenza tra le pagine (stili, componenti, feedback).
  - Mancanza di feedback immediato sulle azioni.
  - Necessita consolidare KPI critici in vista overview.

## Opportunità di Miglioramento
- Dashboard unica come entry point.
- Navigation persistente condivisa tra tutte le rotte admin.
- Widget KPI con stato esplicito (`loading`/`empty`/`error`/`ready`) e wiring progressivo ai dati reali.
- Feedback visivo e undo per ogni azione.
- Accessibilità e consistenza tra tutte le sezioni.

## Governance Alignment Reference
- Questo JTBD e allineato alla convergenza archetype formalizzata in `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`, sezione **3.2.3 Admin Overview companion layout (`/admin`)**.
