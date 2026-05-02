# XState System As-Is Blueprint Index

Versione: 2.5
Data: 2026-05-02

Indice compatto del blueprint atomizzato.

Nota aggiornamento 2.5 (as-is post-refactor frontend XState scope tools/auth/workspace):

- flusso frontend briefing upload/extraction stabilizzato con sincronizzazione input actor (`INPUT_SYNCED`) in caso di variazione `projectId`/sessione dopo mount
- recovery deterministico dello stato frontend `extracting` tramite artifact extraction persistito (`EXTRACTION_RECOVERED`) con convergenza a stato `ready`
- pipeline UI as-is verificata end-to-end fino all'ultimo artifact (`GO` smoke 2026-05-02)
- hygiene as-is frontend: check strict TypeScript `noUnusedLocals/noUnusedParameters` passato nel workspace frontend

Nota aggiornamento 2.4 (allineamento as-is post-fix orchestration + SSE):

- `generationSystemMachine` as-is: gate `idempotency -> usage` eseguiti prima del routing verso flow con side effect (`toolGenerationFlow` / `extractionFlow`)
- `generationSystemMachine` as-is: replay e usage reject chiudono il flusso senza invocare workflow actor
- contratto SSE frontend as-is: `requestId` di `start` deve combaciare con la request attiva
- contratto SSE frontend as-is: `chunk` e `terminal` devono riferirsi all`artifactId` dello stream attivo o produrre `protocol_error`
- test di regressione as-is: coperti replay/rate-limit pre-workflow e mismatch `artifactId` lato frontend

Nota aggiornamento 2.3 (as-is runtime LLM + auth + OAuth):

- provider LLM as-is: OpenRouter (con fallback sintetico per test/offline)
- contratto SSE esterno as-is: `start/chunk/terminal`
- runtime helper Node as-is: stream AsyncIterable + adapter HTTP SSE su ServerResponse
- surface auth HTTP minima as-is: `POST /auth/login`, `POST /auth/logout`, `GET /auth/session`
- contratti runtime auth as-is: session cookie runtime + password hashing runtime
- OAuth Google as-is: `GET /auth/google/start`, `GET /auth/google/callback` con state token + PKCE
- runtime OAuth Google as-is: factory da env (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`)
- adapter server Node unificato as-is: dispatch automatico auth/generation nella stessa `createServer`

## Cross-Cutting

- [xstate-system-overview-and-domain-spec.md](./xstate-system-as-is/xstate-system-overview-and-domain-spec.md)
- [api-persistence-and-runtime-contracts-spec.md](./xstate-system-as-is/api-persistence-and-runtime-contracts-spec.md)
- [xstate-actor-contracts-and-topology-spec.md](./xstate-system-as-is/xstate-actor-contracts-and-topology-spec.md)
- [auth-go-ready-spec.md](./xstate-system-as-is/auth-go-ready-spec.md)
- [frontend-sse-ui-ready-spec.md](./xstate-system-as-is/frontend-sse-ui-ready-spec.md)
- [testing-go-no-go-and-risk-spec.md](./xstate-system-as-is/testing-go-no-go-and-risk-spec.md)
- [documentation-go-no-go-checklist-spec.md](./xstate-system-as-is/documentation-go-no-go-checklist-spec.md)
- [backend-go-checklist-spec.md](./xstate-system-as-is/backend-go-checklist-spec.md)

## Machine Specs

- [generation-system-machine-spec.md](./xstate-system-as-is/generation-system-machine-spec.md)
- [request-gateway-machine-spec.md](./xstate-system-as-is/request-gateway-machine-spec.md)
- [usage-machine-spec.md](./xstate-system-as-is/usage-machine-spec.md)
- [idempotency-coordinator-machine-spec.md](./xstate-system-as-is/idempotency-coordinator-machine-spec.md)
- [stream-transport-machine-spec.md](./xstate-system-as-is/stream-transport-machine-spec.md)
- [persistence-batch-machine-spec.md](./xstate-system-as-is/persistence-batch-machine-spec.md)
- [tool-workflow-machine-spec.md](./xstate-system-as-is/tool-workflow-machine-spec.md)
- [extraction-chain-machine-spec.md](./xstate-system-as-is/extraction-chain-machine-spec.md)

## Typed Appendices

- [xstate-v5-skeleton-spec.md](./xstate-system-as-is/xstate-v5-skeleton-spec.md)
- [artifact-types-contract-spec.md](./xstate-system-as-is/artifact-types-contract-spec.md)
- [xstate-shared-types-contract-spec.md](./xstate-system-as-is/xstate-shared-types-contract-spec.md)

## Historical Closures

- [xstate-review-closure-2026-04-24.md](../../99-lifecycle/99-archive/xstate-review-closure-2026-04-24.md)