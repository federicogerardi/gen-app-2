---
type: source-summary
tags:
  - wiki/source
  - governance
  - documentation
  - ddd
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/07-governance/documentation-ddd-ul-governance.md
date_ingested: 2026-07-28
source_version: "2.0"
---

# Documentation Governance DDD and Ubiquitous Language

Defines deterministic governance for all documentation under `docs/`. Covers frontmatter integrity, language policy, link integrity, version format, document archetypes, lifecycle, and compliance checklist.

## Frontmatter Integrity (Section 1)

Every `docs/` file must have exactly one YAML frontmatter block. Required fields: `status`, `version`, `last-reviewed`, `next-review-date`, `owner`. `date_created` required for active non-archive docs.

**Status lifecycle**: `draft → approved → active → implemented/completed → archived`

## Language Policy (Section 2)

| Category | Language |
|----------|----------|
| Technical (glossary, BCM, ADR, specs, runbooks, reviews) | **English only** |
| Product (PM briefings, user guides) | **Italian allowed** |
| Proposals, implementation plans | English preferred, Italian tolerated |

No intra-document mixing. Frontmatter keys always English.

## Document Archetypes (Section 5)

26 canonical `type` values including: `glossary`, `bounded-context-map`, `decision-log`, `adr`, `proposal`, `specification`, `ui-governance-spec`, `code-review`, `design-review`, `debug-runbook`, `observability-runbook`, `implementation-plan`, `template`, etc.

## Document Lifecycle (Section 6)

- Active: defines current behavior, referenced by a workflow
- Archive: superseded, historical, or completed
- `next-review-date` max 6 months out; expired reviews must be resolved
- Stale drafts must be resolved within 1 sprint or archived

## Compliance Checklist (Section 8)

11-item checklist: verify DDD terms, check no duplicate docs, assign correct section, fill frontmatter, set `date_created`, assign `type`, populate `tags`, respect language policy, verify links, add DDD reference block if needed, update `docs/index-overview.md`.

## Contradictions

None.

## Source

- File: `docs/07-governance/documentation-ddd-ul-governance.md`
- Version: 2.0
- Last reviewed: 2026-07-23
- Owner: Documentation Archivist