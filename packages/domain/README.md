# packages/domain

Reserved package for future domain-level consolidation.

Package: @gen-app-2/domain

## Intended Scope

When activated, this package should host only true cross-context domain assets, such as:

- stable Value Objects shared by multiple bounded contexts
- invariant-preserving factories with domain meaning
- domain primitives that must remain framework-agnostic

## Current Status

Not yet active in production runtime.

Until activation, canonical language and decisions remain governed by docs and context-local types in backend/frontend packages.

## Activation Rule

Do not move types into this package only for convenience. Promote here only when a concept is truly shared and stable across bounded contexts.

## DDD References

1. ../../docs/01-requirements/domain-ubiquitous-language-glossary.md
2. ../../docs/02-design/domain-bounded-context-map.md
3. ../../docs/07-governance/domain-naming-decision-log.md
