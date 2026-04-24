## 15. Piano Test Completo (Per Non Avere Lacune)

## 15.1 Transition Coverage

- Tutte le transizioni root lifecycle (happy + fail).
- Tutte le uscite terminali streaming (`complete`, `error`, `timeout`, `disconnect`).
- Tutti i path extraction (`accept`, `soft-accept`, `escalate`, `exhausted`).

## 15.2 Guard Coverage

- Ogni guardia con caso true/false.
- Ownership mismatch, model unavailable, quota exceeded.
- Idempotency completed vs conflict.

## 15.3 Contract Coverage

- Error object shape stabile.
- SSE event shape stabile per tutti i tipi evento.
- Ordine evento (`start` precede `chunk`, terminal event unico).

## 15.4 Persistence Coverage

- Artifact state transitions consistenti.
- Token/cost persistiti correttamente.
- QuotaHistory coerente con outcome.

## 15.5 Workflow Coverage

- Funnel: optin -> quiz -> vsl con dipendenze.
- NextLand: landing -> thank_you con dipendenza.
- Retry behavior e notice.

## 15.6 Property/Model-based Coverage (Raccomandato)

- Path generation su extractionChainMachine per combinazioni timeout/parse/schema/consistency.
- Assertion: assenza stati terminali ambigui.

## 16. Checklist di Equivalenza Funzionale (Go/No-Go)

Una nuova implementazione e equivalente solo se:

- Rispetta tutti i gate pre-provider nell'ordine corretto.
- Espone stesso contratto errori e SSE.
- Mantiene artifact lifecycle e accounting coerenti.
- Riproduce workflow step-based con dipendenze e retry.
- Riproduce extraction chain con rollout/idempotency/escalation.
- Implementa Tool Registry Contract con mapping obbligatorio `tool_key/workflow_type/artifact_type`.
- Supporta workflow parametrico a step variabili (`active_step_index`, `steps[]`, `dependency_graph`).
- Applica pipeline canonica `extraction -> generation -> save` per ogni tool nuovo.
- Separa esplicitamente `streamTransportMachine`, `persistenceBatchMachine` e `idempotencyCoordinatorMachine`.
- Mantiene l'orchestrazione principale nel root actor XState, non nel route handler/framework.
- Separa formalmente branch `deterministic` e `non_deterministic` con routing esplicito da registry.
- Passa test matrix transizioni/guardie/contratti/persistenza.

## 17. Rischi Residui e Mitigazioni

Rischi:

- Divergenza tra stato stream e stato DB in edge di rete.
- Overlap retry client/server se idempotency incompleta.
- Complessita extraction in assenza di model-based test.

Mitigazioni:

1. Introdurre correlation id obbligatorio su request e artifact.
2. Implementare idempotency forte per endpoint extraction (e opzionalmente tool-step).
3. Aggiungere test model-based e replay test su stream interrotti.
4. Bloccare regressioni con snapshot strutturali delle macchine XState.

## 17.1 Rischi Residui Auth (Mini-Sezione)

Rischi:

- Cookie policy non uniforme tra ambienti (dev/stage/prod): attributi `Secure`, `HttpOnly`, `SameSite`, `Path` non coerenti possono causare sessioni non valide o piu esposte.
- Rotazione sessione incompleta: mancata revoca in logout/reset password/disable user o assenza di policy di refresh/renew aumenta rischio di session fixation o token stantii.
- Hardening hashing non sufficiente: parametri deboli, algoritmo non versionato o assenza di rehash progressivo possono degradare la resilienza contro brute-force/offline cracking.

Mitigazioni:

1. Definire baseline cookie policy per ambiente e validarla con test automatici (`Set-Cookie` include sempre `HttpOnly`, `SameSite`, `Path`; `Secure` obbligatorio in produzione).
2. Imporre rotazione/revoca server-side su eventi critici (logout, reset password, disable user, sospetto account takeover) e testare il path `session prima valida -> revocata -> unauthorized`.
3. Versionare `password_algo` e introdurre strategia di rehash al login quando la policy cambia (es. aumento cost factor), mantenendo audit dei cambi password.
4. Aggiungere test dedicati auth runtime su: cookie clear, session expiry, token hash mismatch, e fallback sicuro su errori del layer auth.

