---
status: accepted
version: 1.0
date_created: 2026-06-26
last-reviewed: 2026-06-26
next-review-date: 2026-07-26
owner: Frontend Platform Team
type: adr
tags: [adr, xstate, error-states, frontend, determinism]
---

# ADR-003: XState Explicit Error States Pattern

> ⚑ **DDD Reference**: This ADR concerns the Frontend/UI bounded context XState machine architecture. Domain concepts referenced below:
> - `ToolPage` (DDD-004) — aggregate root for tool page orchestration
> - `BriefingUpload` (DDD-013) — briefing extraction child machine
> - `AuthSession` (DDD-001) — authentication session machine
> - See [Domain Ubiquitous Language Glossary](../../01-requirements/domain-ubiquitous-language-glossary.md) and [Domain Bounded Context Map](../domain-bounded-context-map.md#frontend-ui-context) for full context.

**Status**: Accepted
**Date**: 2026-06-26
**Deciders**: Frontend Platform Team

## Context

Tre macchine XState (`auth-session`, `briefing-upload`, `tool-page`) nascondevano sotto-stati di errore dentro flag di contesto (`error: string | null`). Questo rendeva il comportamento UX non deterministico dallo stato solo — lo stesso stato `idle` o `unauthenticated` copriva sia condizioni "clean" che "error", distinguibili solo ispezionando `context.error !== null`.

La macchina `tool-page` presentava inoltre un anti-pattern dual-write: le actions aggiornavano simultaneamente campi di contesto E ricostruivano la `viewModel`, creando rischio di desincronizzazione.

## Decision

Adottiamo il pattern **Explicit Error States** per tutte le macchine XState del frontend:

### 1. Child States per Errori

Ogni stato che poteva contenere un errore diventa un compound state con child `clean` e `failed`:

```typescript
// auth-session.machine.ts
unauthenticated: {
  initial: 'idle',
  states: {
    idle: {},
    failed: { on: { LOGIN: '#authenticating', CLEAR_ERROR: 'idle' } }
  }
}

// briefing-upload.machine.ts
idle: {
  initial: 'clean',
  states: {
    clean: {},
    failed: { on: { RETRY: 'clean', RESET: 'clean' } }
  }
}

// tool-page.machine.ts
configuring: {
  initial: 'clean',
  states: {
    clean: {},
    hydrationFailed: { on: { HYDRATE_REQUESTED: '#hydrating', RESET: '.clean' } },
    generationFailed: { on: { START_GENERATION: '#generating', RESET: '.clean' } }
  }
}
```

### 2. Single `errorMessage` Context Field

I campi multipli `generationError` e `hydrationError` sono sostituiti da un singolo `errorMessage: string | null`. Il messaggio è settato contestualmente alla transizione nello stato errore e cleared alla transizione verso `clean`.

### 3. Reactive ViewModel Selector

La `viewModel` è derivata reattivamente tramite `buildReactiveViewModel(context, configuringSubstate)` — una funzione pura che legge stato + contesto. Zero `assign({ viewModel: ... })` nelle actions.

```typescript
// useToolPage.ts
const configuringSubstate = typeof snapshot.value === 'object' && 'configuring' in snapshot.value
  ? (snapshot.value as { configuring: string }).configuring
  : 'clean';
const viewModel = buildReactiveViewModel(snapshot.context, configuringSubstate);
```

### 4. Guard Derivation

I guard che dipendono dalla viewModel (es. `canStartGeneration`) derivano la policy direttamente dal contesto:

```typescript
canStartGeneration: ({ context }) => {
  const policy = buildReactiveViewModel(context).primaryActionPolicy;
  return context.readiness.canStartFlow && canStartFromPolicy(policy);
}
```

## Consequences

**Positive:**
- UX behavior deterministico da `state.matches()` — singolo check, nessuna derivazione da contesto
- Error states visibili in XState DevTools senza ispezione contesto
- ViewModel immune a desincronizzazione (funzione pura, zero dual-write)
- Pattern consistente tra tutte le macchine — nuovi errori = aggiungere child state + transition
- Test assertions state-based: `state.matches('configuring.hydrationFailed')` invece di `context.error !== null`
- 443 test passano, zero regressioni

**Negative:**
- Refactoring significativo: 7 file modificati, 15+ consumer aggiornati
- `buildReactiveViewModel` chiamata ad ogni render (costo O(1), trascurabile)
- `event.output` non disponibile in `onDone` guard per invoked actors con output — risolto con `onError` handler

**Neutral:**
- `generation-lifecycle.machine.ts` mantiene ancora `error: string | null` in contesto — fuori scope, child machine
- `ToolPageViewModel.messages.error: string | null` rimane — è un campo ViewModel, non un contesto macchina

## Alternatives Considered

**Option 1**: Mantenere `error: string | null` in contesto
- Pros: Nessun costo di refactoring
- Cons: UX non deterministico, debugging complesso, test fragili

**Option 2**: Orthogonal regions per errore (parallel states)
- Pros: Separazione netta tra operation state e error state
- Cons: Maggiore complessità, pattern meno intuitivo per nuovi sviluppatori

**Option 3**: Single `errorState` context field + guard logic
- Pros: Meno cambiamenti alla struttura della macchina
- Cons: Non risolve il problema fondamentale — l'errore rimane nascosto nel contesto, non visibile in DevTools

## Code Review Guidelines

Per future modifiche alle macchine XState:

1. **Mai introdurre `error: string | null` nel contesto** — usare child states
2. **Mai dual-write** — derivare viewModel reattivamente, non assegnare in actions
3. **Sempre usare `state.matches()`** per check di errore nei consumer
4. **Sempre testare recovery paths** — RETRY, RESET, CLEAR_ERROR transitions
5. **Error messages nel contesto, condizioni nello stato** — `errorMessage` per il testo, child state per la condizione

## References
- [XState Explicit Error States Refactoring Plan](../../99-lifecycle/99-archive/plans/refactor-xstate-explicit-error-states-a1.md)

- [Frontend UX Determinism Code Review](../../07-governance/frontend-ux-determinism-code-review.md) — Finding A1, A3
- `auth-session.machine.ts` — Sprint 1 reference implementation
- `briefing-upload.machine.ts` — Sprint 2 reference implementation
- `tool-page.machine.ts` — Sprint 3–4 reference implementation
- `tool-page-view-model.ts` — Reactive ViewModel pattern
