---
goal: Close the CRITICAL ExtractionContext parser-parity finding by unifying hydration parsing with canonical Generation semantics
version: 1.0
date_created: 2026-05-21
last_updated: 2026-05-21
owner: Architecture Review
status: 'Completed'
last-reviewed: 2026-05-21
next-review-date: 2026-08-21
tags: [process, backend, hydration, parsing, ddd, correctness, testing]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This implementation plan closes the CRITICAL finding "Parsing inconsistency for ExtractionContext between hydrate path and canonical Generation parser" by removing parser divergence, introducing a single canonical parsing path for hydration, and validating parity through deterministic regression tests.

## 1. Requirements & Constraints

- REQ-001: Replace hydrate-specific ExtractionContext content parsing with canonical Generation parsing semantics.
- REQ-002: Ensure `/api/tools/hydrate` applies tool-aware parsing for extraction artifacts, including `youtube-lf-script` markdown extraction rules.
- REQ-003: Preserve existing successful hydration response contract (`extractionArtifactId`, `extractionPayload`, `briefingId`, `normalizedText`, `parsedFormat`).
- REQ-004: Keep deterministic ranking behavior (`briefing coherence -> source match -> recency -> tie-break`) unchanged while changing only payload parsing semantics.
- REQ-005: Guarantee parity between hydration parser output and Generation parser output for the same extraction artifact content + tool identity.
- SEC-001: Do not log raw extraction payload or normalized briefing content in production paths.
- DDD-001: Use canonical terms exactly: `ExtractionContext`, `HydrationResult`, `ToolKey`, `ToolWorkflow`, `ReadinessSnapshot`.
- DDD-002: Do not introduce new parser-specific synonyms for existing canonical concepts.
- CON-001: Scope is backend hydration path and related tests; no frontend behavior refactor in this plan.
- CON-002: Existing endpoint contracts must remain backward-compatible.
- CON-003: No DB migration is allowed in this plan.
- GUD-001: Apply smallest coherent change; avoid unrelated code movement.
- GUD-002: Keep parser unification explicit and test-driven.
- PAT-001: Single-source-of-truth parsing rule: hydration must call canonical Generation parsing module.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Define canonical parser ownership and extract deterministic integration points.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Confirm the first-finding evidence anchors in `apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts` (`parseExtractionContent` call sites) and in `apps/backend/src/lib/runtime/auth-http/tools-hydration-parser.ts` (content-only parser signature). | ✅ | 2026-05-21 |
| TASK-002 | Confirm canonical parser ownership and behavior in `apps/backend/src/lib/machines/generation/extraction-parsers.ts`, including `parseExtractionContent(content, extractionToolKey)` and `parseYoutubeExtractionMarkdown`. | ✅ | 2026-05-21 |
| TASK-003 | Define deterministic parser ownership note in code comments: hydration parsing authority is `generation/extraction-parsers.ts` only. | ✅ | 2026-05-21 |

### Implementation Phase 2

- GOAL-002: Implement parser unification in hydrate runtime with no response-shape regressions.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Update `apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts` to import canonical parser from `apps/backend/src/lib/machines/generation/extraction-parsers.ts` and remove local parser dependency for extraction payload reconstruction. | ✅ | 2026-05-21 |
| TASK-005 | In `handleToolsHydrate`, pass tool identity into canonical parser when artifact content is parsed (both direct extraction-source branch and ranked fallback branch). | ✅ | 2026-05-21 |
| TASK-006 | Keep `parsedFormatFromInput` behavior unchanged or move it to a shared parser utility only if required by compile-time constraints; do not alter output values (`txt|md|docx` + `md` fallback). | ✅ | 2026-05-21 |
| TASK-007 | Remove dead/unreferenced functions from `apps/backend/src/lib/runtime/auth-http/tools-hydration-parser.ts` if they become obsolete after parser unification, without changing public route behavior. | ✅ | 2026-05-21 |

### Implementation Phase 3

- GOAL-003: Add deterministic regression coverage for parser parity and tool-specific semantics.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | Add backend test `TEST-CRIT-001` in `apps/backend/src/lib/tests/runtime.auth-http.test.ts`: hydrate youtube extraction content returns canonical fields (`knowledge_content`, `avatar`, `pain_point`, `offer`, `proof`) from markdown format. | ✅ | 2026-05-21 |
| TASK-009 | Add backend test `TEST-CRIT-002`: same extraction artifact content parsed through hydrate path and canonical generation parser yields equivalent payload structure for non-youtube tool. | ✅ | 2026-05-21 |
| TASK-010 | Add backend test `TEST-CRIT-003`: same extraction artifact content parsed through hydrate path and canonical generation parser yields equivalent payload structure for `youtube-lf-script` tool. | ✅ | 2026-05-21 |
| TASK-011 | Add backend test `TEST-CRIT-004`: hydrate response shape remains stable (`hydration.extractionArtifactId`, `hydration.extractionPayload`, `hydration.briefingId`, `hydration.normalizedText`, `hydration.parsedFormat`). | ✅ | 2026-05-21 |

### Implementation Phase 4

- GOAL-004: Validate closure gates and publish closure evidence.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-012 | Run backend typecheck: `npm --workspace apps/backend run typecheck`; require exit code 0. | ✅ | 2026-05-21 |
| TASK-013 | Run focused hydrate suite: `npm --workspace apps/backend run test -- src/lib/tests/runtime.auth-http.test.ts`; require all hydrate tests pass. | ✅ | 2026-05-21 |
| TASK-014 | Run full backend suite: `npm --workspace apps/backend run test`; require no regressions. | ✅ | 2026-05-21 |
| TASK-015 | Update `docs/07-governance/architecture-weaknesses-code-review-2026-05-21.md` first finding status/evidence only after TASK-012, TASK-013, TASK-014 pass. | ✅ | 2026-05-21 |

Phase 4 execution note (2026-05-21):
- Initial focused-suite failures were caused by parser-semantic drift introduced during hydrate parser unification.
- Canonical parser compatibility was restored for non-youtube historical payload formats (payload envelopes + fenced/object-slice JSON extraction).
- Validation gates passed after fix:
	- `node --import tsx --test apps/backend/src/lib/tests/runtime.auth-http.test.ts` -> exit code 0.
	- `npm --workspace apps/backend run test -- src/lib/tests/runtime.auth-http.test.ts` -> exit code 0.
	- `npm --workspace apps/backend run test` -> exit code 0 (153 pass, 0 fail).

## 3. Alternatives

- ALT-001: Keep local hydrate parser and duplicate youtube-specific logic there. Rejected because it preserves drift risk and duplicates domain parsing policy.
- ALT-002: Move parser logic to frontend and trust readiness validation only. Rejected because parser authority must remain backend-side for deterministic hydration semantics.
- ALT-003: Keep current behavior and add only documentation warning. Rejected because finding is CRITICAL and requires code-level closure.

## 4. Dependencies

- DEP-001: `apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts`
- DEP-002: `apps/backend/src/lib/runtime/auth-http/tools-hydration-parser.ts`
- DEP-003: `apps/backend/src/lib/machines/generation/extraction-parsers.ts`
- DEP-004: `apps/backend/src/lib/tests/runtime.auth-http.test.ts`
- DEP-005: `docs/07-governance/architecture-weaknesses-code-review-2026-05-21.md`
- DEP-006: `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- DEP-007: `docs/02-design/domain-bounded-context-map.md`
- DEP-008: `docs/07-governance/domain-naming-decision-log.md`

## 5. Files

- FILE-001: `apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts` - replace hydration parser import/calls with canonical parser calls.
- FILE-002: `apps/backend/src/lib/runtime/auth-http/tools-hydration-parser.ts` - retain only non-duplicated utilities or deprecate unused parser functions.
- FILE-003: `apps/backend/src/lib/machines/generation/extraction-parsers.ts` - authoritative parser module used by hydration and generation paths.
- FILE-004: `apps/backend/src/lib/tests/runtime.auth-http.test.ts` - regression tests for parser parity and response-shape stability.
- FILE-005: `docs/07-governance/architecture-weaknesses-code-review-2026-05-21.md` - closure evidence update after validation gates.

## 6. Testing

- TEST-001: Hydrate youtube markdown parsing returns canonical ExtractionContext keys.
- TEST-002: Hydrate non-youtube parsing parity with canonical generation parser.
- TEST-003: Hydrate youtube parsing parity with canonical generation parser.
- TEST-004: Hydrate response JSON contract stability test.
- TEST-005: Backend typecheck gate (`npm --workspace apps/backend run typecheck`).
- TEST-006: Focused hydrate runtime suite (`npm --workspace apps/backend run test -- src/lib/tests/runtime.auth-http.test.ts`).
- TEST-007: Full backend regression suite (`npm --workspace apps/backend run test`).

## 7. Risks & Assumptions

- RISK-001: Passing wrong tool identity to canonical parser could change extraction payload shape for existing artifacts.
- RISK-002: Removing local parser utilities without full call-site verification could break `parsedFormat` handling.
- RISK-003: Tests may not cover mixed historical artifact formats (raw JSON, fenced JSON, markdown) if fixtures are incomplete.
- ASSUMPTION-001: Canonical generation parser module is stable and intended for reuse by hydrate runtime.
- ASSUMPTION-002: Hydrate endpoint consumers rely on existing response shape, not parser implementation details.
- ASSUMPTION-003: No frontend code changes are required when backend payload semantics become canonical-parity compliant.

## 8. Related Specifications / Further Reading

- `docs/07-governance/architecture-weaknesses-code-review-2026-05-21.md`
- `docs/07-governance/domain-naming-decision-log.md`
- `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- `docs/02-design/domain-bounded-context-map.md`
- `docs/02-design/specifications/tool-page-frontend-runtime-spec.md`
- `apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts`
- `apps/backend/src/lib/machines/generation/extraction-parsers.ts`
