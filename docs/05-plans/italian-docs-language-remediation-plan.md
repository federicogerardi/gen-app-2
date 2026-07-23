---
goal: Translate remaining Italian-language technical documents to English per Documentation Governance Language Policy
version: 1.0
date_created: 2026-07-23
last-reviewed: 2026-07-23
next-review-date: 2026-08-23
owner: Domain Architecture
status: active
tags: [plan, governance, language-policy, remediation, documentation, translation]
type: implementation-plan
---

# Italian Docs Language Remediation Plan

> ⚑ **DDD Reference**: This plan addresses language policy violations identified in the Documentation Governance rules.
> - [Documentation DDD UL Governance](../07-governance/documentation-ddd-ul-governance.md) — Language Policy section
> - [AGENTS.md](../../AGENTS.md) — Documentation Governance summary

## 1. Objective

Translate all remaining Italian-language technical documents to English to comply with the Documentation Governance Language Policy, which requires **English only** for technical documents (code reviews, specifications, ADRs, reference guides, development guides).

## 2. Policy Reference

| Document Type | Language Rule | Status |
|---|---|---|
| Technical documents (glossary, BCM, ADR, specifications, runbooks, code reviews, architecture reviews, reference guides, integration guides, development guides) | **English only** | 🔴 Violation if Italian |
| Product documents (PM briefings, user guides, product presentations) | **Italian allowed** | ✅ Compliant |
| Proposals and implementation plans | **English preferred**; Italian tolerated if primary audience is Italian-speaking PM | ⚠️ Conditional |

## 3. Completed Work (Phase 1 — Partial)

### ✅ Translated (8 documents)

| # | File | Type | Status |
|---|------|------|--------|
| 1 | `docs/07-governance/ddd-implementation-audit.md` | code-review | ✅ Done |
| 2 | `docs/07-governance/xstate-as-aggregate-architectural-review.md` | code-review | ✅ Done |
| 3 | `docs/07-governance/backend-logging-quality-consistency-review.md` | code-review | ✅ Done |
| 4 | `docs/02-design/specifications/xstate-as-aggregate-developer-guide.md` | specification | ✅ Done |
| 5 | `docs/02-design/specifications/frontend-design-system-ui-kit-guide.md` | design-system-guide | ✅ Done |
| 6 | `docs/02-design/specifications/frontend-tool-pages-architecture-spec.md` | specification | ✅ Done |
| 7 | `docs/02-design/specifications/tool-generation-flow-source-of-truth-spec.md` | specification | ✅ Done |
| 8 | `docs/02-design/adr/xstate-explicit-error-states-adr.md` | adr | ✅ Done |

### 🔄 In Progress (1 document)

| # | File | Type | Status |
|---|------|------|--------|
| 9 | `docs/02-design/specifications/deployment-architecture-guide.md` | reference | 🔄 ~60% translated |

---

## 4. Remaining Tasks

### Track A — Phase 1 Completion (High Priority)

| # | File | Type | Action | Estimate |
|---|------|------|--------|----------|
| A-001 | `docs/02-design/specifications/deployment-architecture-guide.md` | reference | Complete remaining Italian sections (~40%) | 15 min |
| A-002 | `docs/02-design/adr/xstate-explicit-error-states-adr.md` | adr | Full translation | 10 min |

### Track B — Phase 2 Proposals & Plans (Medium Priority)

| # | File | Type | Action | Estimate |
|---|------|------|--------|----------|
| B-001 | `docs/02-design/proposal-be-driven-workflow-job-system.md` | proposal | Full translation | 20 min |
| B-002 | `docs/02-design/geometric-admin-debug-monitoring-proposal.md` | proposal | Full translation | 15 min |
| B-003 | `docs/02-design/llm-model-step-override-proposal.md` | proposal | Full translation | 15 min |
| B-004 | `docs/02-design/tone-removal-brand-voice-delegation-plan.md` | implementation-plan | Full translation | 15 min |
| B-005 | `docs/05-plans/plan-bullmq-prerequisites.md` | plan | Full translation | 15 min |
| B-006 | `docs/05-plans/plan-post-bullmq-improvements.md` | plan | Full translation | 15 min |

### Track C — Frontmatter Cleanup (Low Priority)

| # | Action | Estimate |
|---|--------|----------|
| C-001 | Bump `version` on all translated documents | 5 min |
| C-002 | Update `last-reviewed` to `2026-07-23` on all translated documents | 5 min |
| C-003 | Update `next-review-date` (+6 months) on all translated documents | 5 min |

---

## 5. Translation Guidelines

### Rules

1. **Preserve all technical content** — code blocks, file paths, type definitions, and code references remain unchanged
2. **Preserve document structure** — headings, tables, lists, and cross-references remain at same positions
3. **Preserve frontmatter** — YAML frontmatter keys are always English; do not translate field names or values
4. **Preserve canonical terms** — DDD terms (`ToolPage`, `GenerationSystem`, `AggregateRoot`, etc.) remain in English as-is
5. **Preserve Italian UI copy references** — when referencing actual UI strings (e.g., `Avvia la generazione`), keep Italian if it's the actual rendered copy
6. **Translate prose only** — section headings, paragraphs, table cells with descriptive text, blockquotes, and notes

### Style

- Use active voice
- Keep sentences concise
- Use consistent terminology (e.g., "state machine" not "automaton")
- Preserve technical precision — do not paraphrase technical concepts

---

## 6. Acceptance Gates

| Gate | Command | Purpose |
|------|---------|---------|
| GATE-001 | `npm run typecheck` | Verify no broken links or references |
| GATE-002 | Manual review | Verify no Italian prose remains in translated files |
| GATE-003 | `rg -l '[àèéìòù]' docs/02-design/ docs/07-governance/ docs/05-plans/` | Grep for remaining Italian accent characters in translated paths |

---

## 7. Execution Order

```
Track A (Phase 1 completion):
  A-001 → A-002

Track B (Phase 2):
  B-001 → B-002 → B-003 → B-004 → B-005 → B-006

Track C (Frontmatter):
  C-001 → C-002 → C-003

GATE-001 → GATE-002 → GATE-003
```

---

## 8. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Translation introduces semantic drift | Medium | Preserve technical precision; do not paraphrase |
| Broken cross-references after translation | Low | Verify all relative links resolve |
| Italian UI copy references lost | Low | Keep actual UI strings in Italian when quoting rendered copy |
| Frontmatter version bump missed | Low | Track C checklist |

---

## 9. References

- [AGENTS.md — Documentation Governance](../../AGENTS.md)
- [Documentation DDD UL Governance](../07-governance/documentation-ddd-ul-governance.md)
- [Domain Ubiquitous Language Glossary](../01-requirements/domain-ubiquitous-language-glossary.md)
- [Domain Naming Decision Log](../07-governance/domain-naming-decision-log.md)
