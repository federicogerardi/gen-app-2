---
type: concept
tags:
  - wiki/concept
  - ddd
  - governance
date_created: 2026-07-27
last-reviewed: 2026-07-27
next-review-date: 2027-01-27
owner: Domain Architecture
source_count: 3
confidence: high
---

# DDD Governance

The governance framework ensuring domain terminology consistency across code, tests, docs, PR notes, and comments in `gen-app-2`.

## Core Rules

1. **Never rename domain concepts without a DDD decision-log entry**
2. **No non-canonical terms** anywhere — new terms require a `DDD-NNN` entry first
3. **Conflicting synonyms resolved in the decision log** before code changes
4. **Decision IDs immutable** — revisions update existing rows or reference supersession, never duplicate

## Governance Documents

Three mandatory-read documents (read in this order):
1. [[domain-ubiquitous-language-glossary]] — canonical terms dictionary
2. [[domain-bounded-context-map]] — context boundaries and integration rules
3. [[domain-naming-decision-log]] — naming rationale and propagation scope

If touching UI code: additionally read [[frontend-ui-ubiquitous-language-spec]].

## Documentation Standards

Every file under `docs/` must have YAML frontmatter with: `status`, `version`, `last-reviewed`, `next-review-date`, `owner`. Full governance rules in `docs/07-governance/documentation-ddd-ul-governance.md`.

## Term Status

Domain terms are classified:
- **canonical** — stable, implemented, authoritative
- **provisional** — proposed or partially implemented, pending full rollout
- **deprecated** — superseded by newer decisions, kept for historical traceability

Example: [[ToneProfile]] and [[RequestTone]] are deprecated (DDD-216, 2026-07-19), superseded by Brand Voice asset injection via [[AssetFieldMapping]].

## Sources

- [[domain-ubiquitous-language-glossary]]
- [[domain-bounded-context-map]]
- [[domain-naming-decision-log]]