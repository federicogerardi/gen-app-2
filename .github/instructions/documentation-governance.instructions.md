---
applyTo: "docs/**/*.md"
description: "Use when creating, updating, reorganizing, archiving, or reviewing project documentation governance under docs/."
---

# Documentation Governance

## Scope
- Operate on project documentation under `docs/` only.
- Keep documentation aligned with the current as-is repository state.
- Do not add or modify application implementation details unless required to keep docs accurate.

## Documentation Root And Taxonomy
- Treat `docs/` as the canonical documentation root.
- Preserve the current high-level taxonomy unless a real file move requires a change:
  - `docs/01-requirements/` for product/domain requirements and glossary-level definitions.
  - `docs/02-design/` for design specs and ADR.
  - `docs/03-development/` for implementation deltas and development changelog.
  - `docs/04-testing/` for quality gates, test strategy, and verification artifacts.
  - `docs/05-ops/` for operations and deployment documentation.
  - `docs/06-user/` for user-facing documentation.
  - `docs/07-governance/` for governance rules, review decisions, and domain naming decisions.
  - `docs/99-lifecycle/99-archive/` for superseded or historical documents.
- Prefer updating existing docs instead of creating duplicates.

## DDD-First Policy
- Every new or updated documentation artifact must be DDD-first.
- Use canonical terms from the DDD reference set before introducing new terminology:
  - `docs/01-requirements/domain-ubiquitous-language-glossary.md`
  - `docs/02-design/domain-bounded-context-map.md`
  - `docs/07-governance/domain-naming-decision-log.md`
- If a required canonical term is missing, add it to the reference set first, then proceed with the target document.

## Naming Rules
- Use lowercase kebab-case for all markdown filenames.
- Use semantic names with topic + document type (for example: `frontend-sse-ui-ready-spec.md`).
- Use explicit suffixes when possible: `spec`, `plan`, `tracker`, `runbook`, `review`, `audit`, `closure`, `gap-analysis`, `overview`, `strategy`.
- Use `YYYY-MM-DD` only for time-bound snapshots.
- Use numeric suffixes (`-1`, `-2`) only for intentional parallel versions.
- Avoid ambiguous names like `notes.md`, `tmp.md`, `new.md`, `final.md`, `misc.md` unless an existing local convention explicitly requires them.

## Archive And Consolidation
- Archive only documents that are superseded, duplicated, or no longer operationally active.
- When archiving or renaming, update all impacted links and indexes in the same change.
- Keep path depth minimal and retrieval predictable.

## Alignment Workflow
- Start with bounded discovery (`rg`, path-filtered listing) before deep reading.
- Validate uncertain repository status against git and, when needed, GitHub (`gh`) state.
- Summarize changes as deltas: what changed, why, and which areas are impacted.

## Overlap Control
- Keep this instruction focused on governance, structure, naming, archive flow, and index/link integrity.
- Keep content-writing style guidance separate from structural governance rules to avoid instruction overlap.
- Prefer the smallest coherent documentation change, split large updates into atomic edits, and reuse existing docs or established patterns before introducing new structure.
- When using `apply_patch`, keep documentation edits atomic per section or paragraph; avoid monolithic substitutions that make patch application brittle.
