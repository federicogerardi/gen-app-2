---
status: active
version: 2.0
date_created: 2026-05-27
last-reviewed: 2026-07-23
next-review-date: 2026-10-23
owner: Documentation Archivist
type: reference
tags: [governance, documentation, ddd, ubiquitous-language, frontmatter, lifecycle]
---

# Documentation Governance DDD and Ubiquitous Language

> **v2.0 (2026-07-23)**: Expanded with language policy, frontmatter integrity rules, link integrity, version format policy, document archetype classification, and stale review enforcement — driven by the 2026-07-23 documentation layer audit.

## Purpose
- Define a deterministic governance model for project documentation using Domain-Driven Design and Ubiquitous Language.
- Keep active documentation minimal, coherent, and directly useful for engineering and agent workflows.
- Prevent naming drift between code, contracts, and documentation.
- Ensure all documents under `docs/` are discoverable, linkable, and machine-parseable through consistent frontmatter and naming conventions.

## Scope
- Applies to all documentation under `docs/`.
- Excludes source-code implementation changes.
- Works together with repository instructions defined in `AGENTS.md`.

## Mandatory Canonical References
Before creating or editing any active document, review these three canonical references in this order:
1. [Domain Ubiquitous Language Glossary](../../docs/01-requirements/domain-ubiquitous-language-glossary.md)
2. [Domain Bounded Context Map](../../docs/02-design/domain-bounded-context-map.md)
3. [Domain Naming Decision Log](domain-naming-decision-log.md)

If a required term does not exist, register a new DDD decision first, then propagate the term.

---

## 1. Frontmatter Integrity

### 1.1 Mandatory YAML Frontmatter
Every file under `docs/` must start with exactly one YAML frontmatter block delimited by `---` lines. No exceptions — including archived and superseded files. Double frontmatter blocks (two consecutive `---`-delimited sections) are forbidden and must be resolved immediately.

### 1.2 Required Fields

| Field | Applies to | Constraints |
|---|---|---|
| `status` | All documents | Strictly lowercase. Canonical values: `active`, `approved`, `draft`, `archived`, `implemented`, `completed`, `accepted`. Never quoted, never title-case, never uppercase, never free-form. |
| `version` | All documents | `X.Y` format (major.minor). `X.Y.Z` only when the document governs a versioned artifact that requires three-segment semver. |
| `last-reviewed` | All documents | ISO date `YYYY-MM-DD` |
| `next-review-date` | All documents | ISO date `YYYY-MM-DD`, at most 6 months in the future |
| `owner` | All documents | Team or role name, not individual name |
| `date_created` | Active non-archive docs | ISO date `YYYY-MM-DD` |

### 1.3 Optional Fields
- `title`: explicit display title (inferred from H1 if absent)
- `type`: document kind from the canonical set (see §5)
- `tags`: YAML list of topical tags
- `goal`: short statement of objective
- `implementation_date`: ISO date (for `implemented` proposals)
- `superseded-by`: relative path to replacement (for `archived` docs with `status: archived`)

### 1.4 Status Lifecycle
```
draft → approved → active → implemented / completed → archived
                                   ↓
                              (superseded-by another active doc)
```
- `accepted` is terminal for ADRs that have been decided but not yet fully implemented.
- `implemented` and `completed` require `implementation_date`.
- `archived` for superseded docs must include `superseded-by`.

---

## 2. Language Policy

### 2.1 Rule
| Document category | Language |
|---|---|
| Technical documents (glossary, BCM, decision log, ADR, specifications, runbooks, code reviews, architecture reviews, reference guides, integration guides, development guides) | **English only** |
| Product documents (PM briefings, user guides, product presentations) | **Italian allowed** |
| Proposals and implementation plans | **English preferred**; Italian tolerated if the primary audience is an Italian-speaking PM |

### 2.2 Consistency
- Never mix English and Italian within the same document body.
- Document title and all section headings must match the body language.
- Frontmatter keys are always in English.

---

## 3. Link Integrity

### 3.1 Resolution Rule
Every relative link in any document under `docs/` must resolve to an existing file. Broken links are not tolerated in active documents.

### 3.2 Move/Rename Protocol
When moving or renaming a file:
1. Update all inbound links in the same commit.
2. Use `../../` relative paths correctly for the document's depth from `docs/` root.

### 3.3 Cross-Directory Links
Links to directories outside `docs/` (e.g., `plan/`) are allowed but must be verified at review time. Prefer stable references over fragile relative paths.

### 3.4 DDD Reference Block
Documents defining domain behavior should include a `> ⚑ DDD Reference` block with explicit links to glossary, BCM, and decision log.

---

## 4. Version Format Policy

- **Standard**: `X.Y` (major.minor, e.g., `1.0`, `2.3`, `4.15`).
- **Exception**: `X.Y.Z` only when the document governs a versioned artifact (e.g., `packages/contracts`) that independently uses three-segment semver.
- On any content change: bump `version` appropriately (patch for fixes, minor for additions, major for restructuring).
- Never use `X.Y.Z` as a general convention — it creates false expectations of three-segment compatibility semantics.

---

## 5. Document Archetype Classification

Every document must declare its `type` from the canonical set:

| Type | Applies to | Example |
|---|---|---|
| `glossary` | Domain vocabulary | `domain-ubiquitous-language-glossary.md` |
| `bounded-context-map` | Context boundaries | `domain-bounded-context-map.md` |
| `decision-log` | Naming governance | `domain-naming-decision-log.md` |
| `adr` | Architecture decisions | `frontend-data-access-layer-adr.md` |
| `proposal` | Feature/tool proposals | `proposal-be-driven-workflow-job-system.md` |
| `tool-proposal` | New tool proposals | `tool-proposal-blog-article-generator.md` |
| `specification` | Technical specs | `tool-step-display-config-spec.md` |
| `ai-first-runtime-spec` | Agent-readable runtime specs | `tool-page-frontend-runtime-spec.md` |
| `ui-governance-spec` | UI naming & layout governance | `frontend-ui-ubiquitous-language-spec.md` |
| `code-review` | Architectural/quality reviews | `ddd-implementation-audit.md` |
| `design-review` | Design-level analysis | `promote-to-asset-deterministic-mapping-review.md` |
| `debug-runbook` | Debug procedures | `streaming-generator-debug-runbook.md` |
| `observability-runbook` | Logging/monitoring | `production-observability-runbook.md` |
| `development-guide` | Developer how-tos | `llm-model-override-configuration-guide.md` |
| `integration-guide` | External integration docs | `serpapi-integration-guide.md` |
| `reference` | Reference material | `geometric-crawling-step-reference.md` |
| `template` | Document templates | `tool-development-plan-template.md` |
| `briefing-note` | PM-facing summaries | `architectural-review-pm-briefing-note.md` |
| `project-tracker` | Progress tracking | `unified-review-progress-tracker.md` |
| `product-presentation` | Product slides | `product-refactoring-presentation.md` |
| `design-proposal` | UI/UX design proposals | `workspace-hub-restyling-proposal.md` |
| `implementation-plan` | Step-by-step execution | `tone-removal-brand-voice-delegation-plan.md` |

---

## 6. Document Lifecycle

### 6.1 Active Document Criteria
A document stays active only if all conditions are true:
- It defines current behavior, contracts, or governance constraints.
- It is referenced by a current workflow, review, or implementation surface.
- It has no newer document that supersedes its operational purpose.

### 6.2 Archive Criteria
A document must be archived when one or more conditions are true:
- It is superseded by a newer canonical document.
- It duplicates another active document without adding active constraints.
- It records historical analysis no longer required for day-to-day operation.

### 6.3 Archive Paths
- `docs/99-lifecycle/99-archive/plans/` — completed or abandoned development plans.
- `docs/99-lifecycle/99-archive/superseded/` — documents explicitly replaced by newer ones. Must include `superseded-by` in frontmatter.

### 6.4 Stale Review Enforcement
- Every document has `next-review-date`. Documents whose review date has passed must be reviewed and updated (or archived if no longer needed) at the earliest opportunity.
- `next-review-date` must never be set more than 6 months into the future.
- Review scadute in documenti `status: draft` devono essere risolte entro 1 sprint dalla scadenza o il documento va archiviato.

---

## 7. Governance Model

### 7.1 DDD-First Naming Gate
- Use canonical terms only.
- Do not introduce synonyms as primary terms.
- Keep deprecated aliases only when explicitly documented in the decision log.

### 7.2 Context Ownership Gate
- Each document must have one primary bounded-context ownership.
- Cross-context concepts must reference the context map and translation boundaries.
- Avoid multi-context scope creep in a single document.

### 7.3 Active vs Archive Gate
- Active: only documents required for current architecture, runtime, testing, and governance operation.
- Archive: superseded snapshots, historical investigations, completed plans, duplicate variants.

### 7.4 Link Simplicity Gate
- Avoid link maze patterns.
- Keep one index entrypoint and a short core-first reading path.
- Prefer stable directory links for large archives over long per-file enumerations.

---

## 8. Minimal Compliance Checklist

For every new or modified document under `docs/`:
1. [ ] Canonical DDD terms verified against glossary, BCM, and decision log.
2. [ ] No existing document already covers the same scope.
3. [ ] Assigned to correct section (`01-requirements`, `02-design`, `04-testing`, `07-governance`, `99-reference`, `99-lifecycle`).
4. [ ] All required frontmatter fields filled with canonical values.
5. [ ] `date_created` present (active non-archive docs).
6. [ ] `type` assigned from canonical set.
7. [ ] `tags` populated.
8. [ ] Language policy respected — no intra-document mixing.
9. [ ] All relative links resolve within the change set.
10. [ ] DDD Reference block present if the document defines domain behavior.
11. [ ] `docs/index-overview.md` updated if the document is in the core navigation path.

---

## 9. Change Protocol
1. Classify the change: active update, supersession, or archive move.
2. Apply terminology alignment first.
3. Update `docs/index-overview.md` in the same patch.
4. Run link-resolution checks (manual or scripted).
5. Record governance rationale when the change affects naming or ownership.

---

## 10. Operational Notes For Agents
- Start from `docs/index-overview.md` core-first navigation.
- Use active docs as source of truth; treat archive as historical evidence.
- When conflicts appear, resolve in canonical DDD references first, then propagate.
- Never introduce non-canonical domain terms — new terms require a `DDD-NNN` entry in the decision log first.
