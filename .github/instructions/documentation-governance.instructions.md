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
  - `docs/specifications/` for specs and contracts.
  - `docs/review/` for checklists, reviews, and go/no-go material.
  - `docs/archive/` for superseded or historical documents.
- Prefer updating existing docs instead of creating duplicates.

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
