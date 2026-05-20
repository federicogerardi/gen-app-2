---
goal: Close the CRITICAL hydration briefing-coherence finding with deterministic backend ranking enforcement and regression-proof validation
version: 1.0
date_created: 2026-05-20
last_updated: 2026-05-20
owner: Architecture Review
status: 'Completed'
tags: [process, backend, hydration, ddd, correctness, testing]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

This implementation plan defines deterministic, machine-executable phases to close the CRITICAL finding "Hydration Non-Determinism vs. Requested Briefing" in the backend hydration endpoint. The plan enforces DDD-075 by adding briefing-coherence filtering before source-artifact and recency ranking, preserving legacy fallback behavior, and proving correctness through targeted integration tests.

## 1. Requirements & Constraints

- REQ-001: Enforce DDD-075 in the hydrate ranking path in apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts.
- REQ-002: In handleToolsHydrate, when resolvedBriefingId is non-null, rank only extraction candidates coherent with briefing identity before exact source match and recency.
- REQ-003: Preserve backward compatibility when resolvedBriefingId is null by keeping current sourceExtractionArtifactId + recency ranking behavior.
- REQ-004: Preserve legacy fallback coherence rule for historical artifacts without input.briefingId by matching artifactId.
- REQ-005: Return HTTP 404 with explicit error reason code no_extraction_for_briefing when no briefing-coherent candidate exists.
- REQ-006: Keep API contract unchanged for successful hydration response payload shape.
- REQ-007: Add deterministic test coverage for five mandatory scenarios: multi-briefing filter, no-match 404, legacy fallback, explicit source priority, session-like multi-briefing resume path.
- SEC-001: Keep debug traces non-production only; do not introduce production logging of extractionPayload or normalizedText content.
- DDD-001: Reuse canonical terms exactly as defined in DDD-007, DDD-038, and DDD-075 (ExtractionContext, HydrationResult, resolvedBriefingId, briefing coherence).
- DDD-002: Do not introduce new synonyms for briefing coherence semantics.
- CON-001: Scope is backend-only: no frontend runtime behavior changes.
- CON-002: Primary implementation file is apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts.
- CON-003: Primary regression file is apps/backend/src/lib/tests/runtime.auth-http.test.ts.
- CON-004: Documentation closure update is allowed only after all acceptance gates pass.
- GUD-001: Apply smallest coherent patch in handler ranking flow; avoid unrelated refactors.
- GUD-002: Keep helper logic pure and local when introducing candidate filtering.
- PAT-001: Ranking order must be deterministic: briefing coherence filter -> sourceExtractionArtifactId exact match -> recency.
- PAT-002: Validation must be evidence-driven with explicit pass/fail command gates.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Establish deterministic baseline and exact implementation anchors for the hydration ranking defect.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Confirm defect anchors in apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts: resolvedBriefingId resolution (line 95), candidate listing block (lines 159-164), ranking comparator (lines 170-178), and selected artifact debug payload (lines 195-210). | ✅ | 2026-05-20 |
| TASK-002 | Confirm baseline test anchor in apps/backend/src/lib/tests/runtime.auth-http.test.ts for test name `auth HTTP runtime hydrates extraction artifact from fenced JSON payload`, which currently omits resolvedBriefingId in request payload. | ✅ | 2026-05-20 |
| TASK-003 | Record baseline behavior contract from docs/07-governance/hydration-non-determinism-evidence-analysis.md and docs/07-governance/hydration-pre-implementation-audit.md for closure evidence chaining. | ✅ | 2026-05-20 |

### Implementation Phase 2

- GOAL-002: Implement DDD-075 briefing-coherence ranking in backend hydrate handler with backward compatibility.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | In apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts inside handleToolsHydrate, introduce local helper `resolveCandidateBriefingId(candidate)` with fallback: normalized candidate.input.briefingId when present, else candidate.artifactId. | ✅ | 2026-05-20 |
| TASK-005 | In handleToolsHydrate, build `eligibleCandidates` only when resolvedBriefingId is non-null. Eligibility rule: resolveCandidateBriefingId(candidate) === resolvedBriefingId (legacy artifactId fallback included). | ✅ | 2026-05-20 |
| TASK-006 | If resolvedBriefingId is non-null and eligibleCandidates is empty, call writeError(response, 404, 'no_extraction_for_briefing', 'No extraction artifact found for resolved briefing') and stop execution without recency fallback. | ✅ | 2026-05-20 |
| TASK-007 | Keep ranking comparator deterministic over eligibleCandidates: first sourceExtractionArtifactId exact match, then updatedAt recency descending, then stable tie-break by artifactId ascending when timestamps are equal. | ✅ | 2026-05-20 |
| TASK-008 | Preserve existing behavior when resolvedBriefingId is null by ranking over full candidate list with current source + recency criteria. | ✅ | 2026-05-20 |
| TASK-009 | Keep response hydration payload shape unchanged: extractionArtifactId, extractionPayload, briefingId, normalizedText, parsedFormat. | ✅ | 2026-05-20 |

### Implementation Phase 3

- GOAL-003: Add full regression coverage for DDD-075 semantics and legacy compatibility.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Extend apps/backend/src/lib/tests/runtime.auth-http.test.ts with Scenario 1 (test name prefix: `auth HTTP runtime hydrate`) using two extraction artifacts with different briefingId values and different updatedAt values; assert resolvedBriefingId selects the coherent non-most-recent artifact. | ✅ | 2026-05-20 |
| TASK-011 | Add Scenario 2: resolvedBriefingId provided but no coherent extraction candidate exists -> assert 404 + no_extraction_for_briefing. | ✅ | 2026-05-20 |
| TASK-012 | Add Scenario 3: legacy artifact without input.briefingId where resolvedBriefingId equals artifactId -> assert candidate accepted and hydrated. | ✅ | 2026-05-20 |
| TASK-013 | Add Scenario 4: coherent eligibleCandidates has multiple artifacts and sourceExtractionArtifactId points to one candidate -> assert exact source priority over recency and timestamp ordering. | ✅ | 2026-05-20 |
| TASK-014 | Add Scenario 5: content-artifact resume path where sourceArtifactId references a content artifact containing extractionArtifactId and briefingId metadata that diverges from most-recent extraction in project; assert returned hydration briefingId is coherent with resolvedBriefingId. | ✅ | 2026-05-20 |
| TASK-015 | Update existing fenced JSON hydrate test to include resolvedBriefingId in request payload and keep response assertions stable. | ✅ | 2026-05-20 |

### Implementation Phase 4

- GOAL-004: Run acceptance gates, close finding, and publish closure evidence.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-016 | Run backend typecheck gate with repository-valid script: npm --workspace apps/backend run typecheck (equivalent to build gate for backend package because build script is not defined). Pass criteria: exit code 0. | ✅ | 2026-05-20 |
| TASK-017 | Run focused backend hydrate regression gate: npm --workspace apps/backend run test -- src/lib/tests/runtime.auth-http.test.ts. Pass criteria: hydrate scenarios and baseline tests all pass. | ✅ | 2026-05-20 |
| TASK-018 | Run full backend suite gate: npm --workspace apps/backend run test. Pass criteria: no regressions outside hydration scope. | ✅ | 2026-05-20 |
| TASK-019 | Update docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md moving CRITICAL hydration finding to Closed Since Previous Review only if TASK-016, TASK-017, and TASK-018 pass. | ✅ | 2026-05-20 |
| TASK-020 | Append closure evidence references to section "Next Gate: Implementation planning phase can proceed" in docs/07-governance/hydration-scope-analysis.md with implemented code anchors and command outcomes from TASK-016/017/018. | ✅ | 2026-05-20 |

## 3. Alternatives

- ALT-001: Keep recency-only fallback ranking and rely on frontend hydration guards. Rejected because domain coherence must be enforced at backend boundary per DDD-075.
- ALT-002: Hard-fail all requests without resolvedBriefingId. Rejected because it breaks backward compatibility and existing artifact-driven flows.
- ALT-003: Enforce coherence only in frontend hydration machine. Rejected because it cannot guarantee backend candidate correctness under direct API calls or future clients.

## 4. Dependencies

- DEP-001: apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts
- DEP-002: apps/backend/src/lib/runtime/auth-http/tools-hydration-parser.ts
- DEP-003: apps/backend/src/lib/tests/runtime.auth-http.test.ts
- DEP-004: docs/07-governance/domain-naming-decision-log.md (DDD-075)
- DEP-005: docs/07-governance/hydration-non-determinism-evidence-analysis.md
- DEP-006: docs/07-governance/hydration-pre-implementation-audit.md
- DEP-007: docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md

## 5. Files

- FILE-001: apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts
- FILE-002: apps/backend/src/lib/tests/runtime.auth-http.test.ts
- FILE-003: docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md
- FILE-004: docs/07-governance/hydration-scope-analysis.md

## 6. Testing

- TEST-001: Multi-briefing coherence filter test in apps/backend/src/lib/tests/runtime.auth-http.test.ts.
- TEST-002: No coherent candidate 404 + reason code test in apps/backend/src/lib/tests/runtime.auth-http.test.ts.
- TEST-003: Legacy artifactId fallback coherence test in apps/backend/src/lib/tests/runtime.auth-http.test.ts.
- TEST-004: Source extraction exact-match priority test in apps/backend/src/lib/tests/runtime.auth-http.test.ts.
- TEST-005: Session-like multi-briefing resume coherence test in apps/backend/src/lib/tests/runtime.auth-http.test.ts.
- TEST-006: Existing fenced JSON hydration regression test update with resolvedBriefingId.
- TEST-007: Backend typecheck gate using npm --workspace apps/backend run typecheck.
- TEST-008: Focused hydrate suite gate using npm --workspace apps/backend run test -- src/lib/tests/runtime.auth-http.test.ts.
- TEST-009: Full backend suite gate using npm --workspace apps/backend run test.

## 7. Risks & Assumptions

- RISK-001: Incorrect eligibility filter ordering may hide valid sourceExtractionArtifactId matches if applied after ranking.
- RISK-002: Missing legacy fallback normalization may reject historical extraction artifacts without briefingId.
- RISK-003: New 404 branch may break clients if error envelope deviates from existing writeError conventions.
- RISK-004: Test data setup may accidentally couple to stub sorting behavior instead of handler ranking logic.
- ASSUMPTION-001: writeError(response, 404, code, message) is accepted by current frontend hydration machine error handling.
- ASSUMPTION-002: ArtifactQueryRepositoryStub seed/list/get behavior is sufficient to model multi-briefing scenarios.
- ASSUMPTION-003: No database migration is required because logic operates at query/handler level only.

## 8. Related Specifications / Further Reading

- docs/07-governance/hydration-non-determinism-evidence-analysis.md
- docs/07-governance/hydration-pre-implementation-audit.md
- docs/07-governance/hydration-scope-analysis.md
- docs/07-governance/architecture-weaknesses-code-review-2026-05-18.md
- docs/07-governance/domain-naming-decision-log.md
- docs/01-requirements/domain-ubiquitous-language-glossary.md
- docs/02-design/domain-bounded-context-map.md
