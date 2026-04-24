2. `requestGatewayMachine`
- figlio del root.
- responsabile solo di auth, validation, model availability, ownership e avvio usage.
- non puo parlare col provider.

## 14.2 Principio di Separazione Obbligatorio

Separazioni non negoziabili nella nuova codebase:

- `requestGatewayMachine` decide se una richiesta puo partire; non costruisce stream e non persiste output.
- `streamTransportMachine` trasporta token/eventi; non calcola policy quota/idempotency e non scrive audit.
- `persistenceBatchMachine` persiste snapshot e finalizza artifact; non parla mai direttamente col provider.
- `idempotencyCoordinatorMachine` decide replay/conflict/claim; non interpreta prompt o output modello.
- `toolWorkflowMachine` governa solo dipendenze step e resume/regenerate; non esegue gate auth o usage.

Questa separazione ha precedenza sulla replica della logica as-is, perche riduce accoppiamento, rende i test di transizione piu piccoli e permette evoluzione indipendente di streaming, storage e workflow.

| `gateway` | `AUTH_OK` | - | `gateway` | `set userId` |
| `gateway` | `VALIDATION_OK` | routing non ambiguo (14.1.1) | `usageAndIdempotency` | `set workflowType`, `set registry selector` |
| `gateway` | `AUTH_FAIL` | - | `failed` | `set failureReason='unauthorized'` |
| `gateway` | `VALIDATION_FAIL` | - | `failed` | `set failureReason=event.reason` |
| Machine | Responsabilita primaria | Cosa non deve fare |
|---|---|---|
| `requestGatewayMachine` | gate iniziali e routing | nessuna write progressiva di stream |
| `usageMachine` | claim quota e rate-limit | nessuna gestione token provider |
