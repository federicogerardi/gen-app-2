---
status: accepted
version: 1.0
last-reviewed: 2026-04-27
next-review-date: 2026-07-27
owner: Frontend Platform Team
---

# ADR-001: Unified Frontend Data Access Layer

> ⚑ **DDD Reference**: This ADR concerns the Frontend/UI bounded context data access infrastructure. Domain concepts referenced below:
> - `ExtractionContext` (DDD-013) — briefing extraction output, consumed by tool data access layer
> - `HydrationResult` (DDD-020) — session rehydration output, served via the query hooks layer
> - `ToolPage` (DDD-004) — aggregate root for tool page orchestration
> - See [Domain Ubiquitous Language Glossary](../../01-requirements/domain-ubiquitous-language-glossary.md) and [Domain Bounded Context Map](../domain-bounded-context-map.md#frontend-ui-context) for full context.

**Status**: Accepted
**Date**: 2026-04-27
**Deciders**: Frontend Platform Team

## Context

Il frontend presentava duplicazione in quattro aree strutturali:

- helper locali per composizione URL HTTP;
- endpoint hardcoded nelle pagine;
- pattern ripetuto di caricamento dati list/detail;
- parser duplicati per query params dei wrapper tool.

Questa situazione aumentava il costo di manutenzione, la probabilita di regressioni e la divergenza tra feature runtime e pagine visuali.

Serviva una decisione architetturale che riducesse la duplicazione senza introdurre una libreria esterna di data fetching e senza modificare i contratti backend esistenti.

## Decision

Adottiamo un data access layer frontend unificato composto da:

- `frontend/src/app/runtime/http-client.ts` come layer condiviso per transport HTTP non-streaming;
- `frontend/src/app/runtime/api-paths.ts` come registry unico degli endpoint;
- `frontend/src/app/runtime/queries/` come sede dei query hooks condivisi per pagine data-driven;
- `frontend/src/features/*/runtime/` come layer feature-aware per mapping payload, fallback e compatibilita dei contratti;
- parser condivisi per ingressi URL riusabili, come `frontend/src/features/tools/runtime/tool-entry-params.ts`.

Regole operative approvate:

- le pagine non eseguono `fetch()` diretto per flussi standard list/detail;
- i client feature non ridefiniscono helper locali `joinApiPath`;
- gli endpoint non vengono hardcodati nelle pagine production;
- le nuove astrazioni devono restare leggere e interne al repository, senza introdurre React Query o SWR in questa fase.

## Consequences

**Positive:**

- Riduzione della duplicazione nel layer runtime e nelle pagine data-driven.
- Maggiore coerenza tra error handling, capability gating e composizione endpoint.
- Migliore scalabilita per nuove feature list/detail e nuovi wrapper tool.
- Riduzione del boilerplate nelle pagine focalizzando i componenti sul rendering.

**Negative:**

- Introduzione di un layer architetturale in piu da mantenere e documentare.
- Rischio di astrazioni eccessive se il pattern viene esteso a casi realmente one-off.
- Necessita di disciplina di team per evitare regressioni verso hardcoding e fetch locale.

**Neutral:**

- Lo streaming generation mantiene il proprio contratto dedicato e riusa solo la composizione URL condivisa.
- I contratti backend restano invariati.

## Alternatives Considered

**Option 1**: Mantenere client e pagine con logica locale duplicata
- Pros: Nessun costo iniziale di refactor.
- Cons: Duplica bug, aumenta costo evolutivo, rende incoerenti endpoint e error handling.

**Option 2**: Adottare direttamente una libreria esterna di data fetching
- Pros: Query cache, retry e invalidazione gia pronti.
- Cons: Aumenta superficie architetturale, introduce dipendenza non necessaria per il livello di complessita corrente, viola la constraint di questo ciclo.

**Option 3**: Unificare solo gli helper URL senza intervenire sulle pagine
- Pros: Refactor minimo e rapido.
- Cons: Non risolve la duplicazione di `useEffect + IIFE async`, dei fallback e del wiring list/detail.

## References

- [Frontend Tool Pages Architecture](../specifications/frontend-tool-pages-architecture-spec.md)

## Monorepo Boundary Addendum (2026-05-06)

Decision addendum aligned with the workspace standardization plan:

- Repository boundaries are now explicit and deterministic:
	- deployable apps live under `apps/*` (`apps/backend`, `apps/frontend`)
	- shared packages live under `packages/*` (`packages/contracts`, `packages/domain`, `packages/infra-db`)
- Frontend data-access layer ownership remains in Frontend/UI context (`apps/frontend/src/app/runtime/*` and `apps/frontend/src/features/*/runtime/*`).
- Contract authority is centralized in `packages/contracts` and consumed by both frontend and backend.
- Database infra ownership is centralized in `packages/infra-db` and consumed by backend workspace scripts.

Deterministic phase sequencing policy:

- Phase execution is strictly ordered (1 -> 2 -> 3A -> 3B -> 3C -> 4).
- Each gate requires machine-verifiable evidence under `plan/evidence/gate-00x/`.
- No destructive move is allowed without a prior rollback plan and rollback reference.

Rollback strategy policy:

- Every gate must include `rollback.md` with deterministic commands and validation checks.
- Every gate must include `rollback-ref.txt` containing a single rollback commit reference.
- Compatibility scripts at repository root are intentionally temporary and removed only after release-cycle evidence confirms zero fallback usage.
