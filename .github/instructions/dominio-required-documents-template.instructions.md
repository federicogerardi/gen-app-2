---
applyTo:
  - "docs/index-overview.md"
  - "docs/01-requirements/domain-ubiquitous-language-glossary.md"
  - "docs/02-design/domain-bounded-context-map.md"
  - "docs/07-governance/domain-naming-decision-log.md"
description: "Deterministic template for the minimum canonical DDD documents required before Ubiquitous Language analysis."
---

# Domain Required Documents Template

## Bootstrap Rule
- Before any term harvesting or domain analysis, verify that all required documents below exist.
- If one or more documents are missing, create them first with minimal frontmatter and section skeletons.
- Continue analysis only after the required set is present.

## Deterministic Decision Rules
- Required paths are canonical and non-optional.
- Do not use semantic equivalence matching as a replacement for required canonical files.
- If similar files already exist in different paths, keep them unchanged and add canonical files anyway.
- Record cross-references from canonical files to legacy/similar files only when relevant.

## Required Document Set
- `docs/index-overview.md`
- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/02-design/domain-bounded-context-map.md`
- `docs/07-governance/domain-naming-decision-log.md`

## Minimal Frontmatter (for new files)
Use this exact frontmatter when bootstrapping missing files:

```yaml
---
status: draft
version: 1.0
last-reviewed: YYYY-MM-DD
owner: Domain Architecture
---
```

## Minimal Section Skeletons
Apply the following minimum structure when creating each missing file.

### `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- Title: `# Domain Ubiquitous Language Glossary`
- Sections:
  - `## Scope`
  - `## Canonical Terms`
  - `## Aliases And Deprecated Terms`

### `docs/02-design/domain-bounded-context-map.md`
- Title: `# Domain Bounded Context Map`
- Sections:
  - `## Context Overview`
  - `## Context Boundaries`
  - `## Shared Concepts And Translation Rules`

### `docs/07-governance/domain-naming-decision-log.md`
- Title: `# Domain Naming Decision Log`
- Sections:
  - `## Decision Rules`
  - `## Approved Naming Decisions`
  - `## Open Naming Conflicts`

## Usage Notes
- Keep content in English for domain artifacts.
- Keep term elicitation questions in Italian when interacting with the user.
- Keep the canonical set stable across workspaces so other agents can rely on fixed DDD references.
- Prefer minimal, atomic document updates and reuse the existing canonical document set before introducing any new file or template structure.
- When applying patches, keep each change atomic and localized to one required document block at a time to reduce fail-match risk.
