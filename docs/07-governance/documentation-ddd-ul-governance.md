---
status: active
version: 1.0
last-reviewed: 2026-05-27
next-review-date: 2026-08-16
owner: Documentation Archivist
---

# Documentation Governance DDD and Ubiquitous Language

## Purpose
- Define a deterministic governance model for project documentation using Domain-Driven Design and Ubiquitous Language.
- Keep active documentation minimal, coherent, and directly useful for engineering and agent workflows.
- Prevent naming drift between code, contracts, and documentation.

## Scope
- Applies to all documentation under docs/.
- Excludes source-code implementation changes.
- Works together with repository instructions under .github/instructions/.

## Mandatory Canonical References
Before creating or editing any active document, review these three canonical references in this order:
1. docs/01-requirements/domain-ubiquitous-language-glossary.md
2. docs/02-design/domain-bounded-context-map.md
3. docs/07-governance/domain-naming-decision-log.md

If a required term does not exist, register a new DDD decision first, then propagate the term.

## Governance Model

### 1) DDD-First Naming Gate
- Use canonical terms only.
- Do not introduce synonyms as primary terms.
- Keep deprecated aliases only when explicitly documented in the decision log.

### 2) Context Ownership Gate
- Each document must have one primary bounded-context ownership.
- Cross-context concepts must reference the context map and translation boundaries.
- Avoid multi-context scope creep in a single document.

### 3) Active vs Archive Gate
- Active: only documents required for current architecture, runtime, testing, and governance operation.
- Archive: superseded snapshots, historical investigations, completed plans, duplicate variants.
- Archive path: docs/99-lifecycle/99-archive/ with stable grouping by topic.

### 4) Link Simplicity Gate
- Avoid link maze patterns.
- Keep one index entrypoint and a short core-first reading path.
- Prefer stable directory links for large archives over long per-file enumerations.

## Document Lifecycle Policy

### Active Document Criteria
A document stays active only if all conditions are true:
- It defines current behavior, contracts, or governance constraints.
- It is referenced by a current workflow, review, or implementation surface.
- It has no newer document that supersedes its operational purpose.

### Archive Criteria
A document must be archived when one or more conditions are true:
- It is superseded by a newer canonical document.
- It duplicates another active document without adding active constraints.
- It records historical analysis no longer required for day-to-day operation.

## Minimal Compliance Checklist
- Canonical terms verified against glossary, context map, and decision log.
- Primary context ownership is explicit.
- Supersession status is explicit (active or archive).
- Links resolve and do not create circular navigation burden.
- Index entry is updated in the same change when active status changes.

## Change Protocol
1. Classify the change: active update, supersession, or archive move.
2. Apply terminology alignment first.
3. Update index-overview.md in the same patch.
4. Run link-resolution checks.
5. Record governance rationale when the change affects naming or ownership.

## Operational Notes For Agents
- Start from docs/index-overview.md core-first navigation.
- Use active docs as source of truth; treat archive as historical evidence.
- When conflicts appear, resolve in canonical DDD references first, then propagate.
