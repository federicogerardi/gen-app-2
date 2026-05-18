---
goal: Canonical DDD UL Documentation Alignment For Planning And Operations Determinism
version: 1.0
date_created: 2026-05-18
last_updated: 2026-05-18
owner: Domain Architecture
status: Planned
tags: [process, ddd, ubiquitous-language, documentation, governance, operations]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan aligns canonical DDD and Ubiquitous Language documentation with current runtime behavior and repository structure to improve consistency, coherence, compactness, and deterministic execution during planning and operations.

## 1. Requirements & Constraints

- **REQ-001**: Apply changes only to canonical DDD documents: docs/01-requirements/domain-ubiquitous-language-glossary.md, docs/02-design/domain-bounded-context-map.md, docs/07-governance/domain-naming-decision-log.md.
- **REQ-002**: Resolve ArtifactRelaunch rule conflict so all canonical docs express one deterministic post-hydration CTA policy.
- **REQ-003**: Update governance status for DDD-C-007, DDD-031, DDD-051, and DDD-019 to match code as-is.
- **REQ-004**: Normalize source evidence paths from legacy prefixes to current workspace prefixes.
- **SEC-001**: Do not modify authentication, authorization, or runtime endpoint behavior; documentation-only intervention.
- **DOC-001**: Keep one active decision state per conflict entry in Open Naming Conflicts.
- **DOC-002**: Preserve historical rationale while marking superseded statements as historical notes, not active rules.
- **CON-001**: No code file changes under apps/, packages/, or root runtime configuration files.
- **CON-002**: No new canonical term introduction unless strictly required by existing approved decisions.
- **CON-003**: Keep document language in English for domain artifacts.
- **GUD-001**: Use deterministic wording: one rule per concept, no dual normative statements.
- **GUD-002**: Prefer atomic edits by concept block to minimize cross-section drift.
- **PAT-001**: DDD-first gate: verify glossary -> bounded context map -> decision log ordering before edits.
- **PAT-002**: Evidence-first updates: each changed statement must reference a current code source path that exists in this repository.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Prepare deterministic baseline and lock canonical scope for documentation-only execution.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Verify canonical documents exist and are editable at docs/01-requirements/domain-ubiquitous-language-glossary.md, docs/02-design/domain-bounded-context-map.md, docs/07-governance/domain-naming-decision-log.md. |  |  |
| TASK-002 | Validate runtime anchor points used for alignment: apps/frontend/src/features/tools/machines/tool-page.machine.ts (prefilled-regenerate -> regenerate-current-step), apps/frontend/src/features/tools/runtime/useToolPageRunController.ts (orchestrateToolStep call), apps/backend/src/lib/runtime/auth-http.ts (/api/tools/orchestrate and /api/tools/sessions handlers). |  |  |
| TASK-003 | Build legacy-to-current path mapping table for evidence normalization: frontend/src -> apps/frontend/src, src/lib -> apps/backend/src/lib, src/server.ts -> apps/backend/src/server.ts, db/migrations -> packages/infra-db/migrations. |  |  |

### Implementation Phase 2

- GOAL-002: Execute Atomic Block 1 by aligning ArtifactRelaunch normative policy across canonical docs.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | In docs/07-governance/domain-naming-decision-log.md, update DDD-020 decision text so post-hydration relaunch action in prefilled-regenerate state is regenerate-current-step and start-generation is constrained to intent=new first-time generation. |  |  |
| TASK-005 | In docs/02-design/domain-bounded-context-map.md, update Shared Concepts row ArtifactRelaunch and Integration Constraint row ArtifactRelaunch default runtime intent to remove contradictory start-generation wording and match DDD-020 updated rule. |  |  |
| TASK-006 | In docs/01-requirements/domain-ubiquitous-language-glossary.md, verify ArtifactRelaunch entry remains authoritative and add one explicit cross-reference to updated DDD-020 text to prevent future divergence. |  |  |

### Implementation Phase 3

- GOAL-003: Execute Atomic Block 2 by updating decision and conflict status entries to reflect current code behavior.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | In docs/07-governance/domain-naming-decision-log.md, update DDD-C-007 status from open to resolved-documented with evidence that apps/frontend/src/features/tools/runtime/useToolPageRunController.ts invokes orchestrateToolStep and apps/backend/src/lib/runtime/auth-http.ts serves /api/tools/orchestrate. |  |  |
| TASK-008 | In docs/07-governance/domain-naming-decision-log.md, update DDD-031 status narrative from target-only to implemented-runtime provisional, preserving any residual cleanup scope as separate follow-up note. |  |  |
| TASK-009 | In docs/07-governance/domain-naming-decision-log.md, revise DDD-051 implementation status text to mark /api/tools/sessions listing as implemented in apps/backend/src/lib/runtime/auth-http.ts and remove pending-rollout wording. |  |  |
| TASK-010 | In docs/07-governance/domain-naming-decision-log.md, revise DDD-019 narrative to declare shared source in packages/contracts/src/tool-workflows.ts via TOOL_STEP_ORDER consumed by FE and BE projections. |  |  |

### Implementation Phase 4

- GOAL-004: Execute Atomic Block 3 by normalizing source evidence paths to current repository structure.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | In docs/01-requirements/domain-ubiquitous-language-glossary.md, replace legacy source evidence path prefixes with current equivalents using the Phase 1 mapping table while preserving semantic evidence scope. |  |  |
| TASK-012 | In docs/02-design/domain-bounded-context-map.md, normalize legacy source evidence paths to current prefixes and keep only verifiable path references. |  |  |
| TASK-013 | In docs/07-governance/domain-naming-decision-log.md, normalize legacy source evidence paths to current prefixes and remove stale references that cannot be validated in the workspace. |  |  |

### Implementation Phase 5

- GOAL-005: Validate deterministic consistency and close the documentation change set.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-014 | Run deterministic grep checks to confirm no remaining contradictory ArtifactRelaunch action terms across canonical docs. Search terms: regenerate-current-step, start-generation, prefilled-regenerate, DDD-020. |  |  |
| TASK-015 | Run deterministic grep checks to confirm DDD-C-007, DDD-031, DDD-051, and DDD-019 status text matches updated runtime facts and no stale pending wording remains. |  |  |
| TASK-016 | Run deterministic grep checks to confirm no legacy evidence prefixes remain in canonical docs: frontend/src, src/lib, src/server.ts, db/migrations. |  |  |

## 3. Alternatives

- **ALT-001**: Update only docs/07-governance/domain-naming-decision-log.md and leave glossary and bounded context map unchanged.
  Rejected because normative conflict on ArtifactRelaunch exists cross-document and would persist.
- **ALT-002**: Apply broad automatic search-replace for all legacy path prefixes across docs/.
  Rejected because non-canonical and archival documents may intentionally preserve historical paths.
- **ALT-003**: Create new DDD decisions instead of updating DDD-019, DDD-031, DDD-051, and DDD-C-007 entries.
  Rejected because existing IDs already own the concepts and require status correction, not concept expansion.

## 4. Dependencies

- **DEP-001**: Canonical DDD references must remain authoritative and internally consistent: docs/01-requirements/domain-ubiquitous-language-glossary.md, docs/02-design/domain-bounded-context-map.md, docs/07-governance/domain-naming-decision-log.md.
- **DEP-002**: Runtime evidence must remain readable for validation during execution: apps/frontend/src/features/tools/machines/tool-page.machine.ts, apps/frontend/src/features/tools/runtime/useToolPageRunController.ts, apps/backend/src/lib/runtime/auth-http.ts, packages/contracts/src/tool-workflows.ts.
- **DEP-003**: No schema or API behavior dependency; this plan is documentation-only and runtime read-only for evidence checks.

## 5. Files

- **FILE-001**: docs/01-requirements/domain-ubiquitous-language-glossary.md
  Description: Keep ArtifactRelaunch canonical rule stable and normalize legacy source evidence paths.
- **FILE-002**: docs/02-design/domain-bounded-context-map.md
  Description: Align ArtifactRelaunch translation and integration constraints with updated DDD-020 rule; normalize evidence paths.
- **FILE-003**: docs/07-governance/domain-naming-decision-log.md
  Description: Update DDD-020, DDD-019, DDD-031, DDD-051, DDD-C-007 states and normalize evidence paths.
- **FILE-004**: plan/process-canonical-ddd-ul-docs-alignment-1.md
  Description: This implementation plan file.

## 6. Testing

- **TEST-001**: Consistency test for ArtifactRelaunch rules.
  Command: rg -n "ArtifactRelaunch|regenerate-current-step|start-generation|DDD-020" docs/01-requirements/domain-ubiquitous-language-glossary.md docs/02-design/domain-bounded-context-map.md docs/07-governance/domain-naming-decision-log.md
  Pass criteria: No contradictory normative statements for post-hydration relaunch action.
- **TEST-002**: Status coherence test for DDD-C-007, DDD-031, DDD-051, DDD-019.
  Command: rg -n "DDD-C-007|DDD-031|DDD-051|DDD-019|open|resolved|pending|implemented" docs/07-governance/domain-naming-decision-log.md
  Pass criteria: Updated entries reflect runtime implementation facts and do not claim zero runtime callers for orchestrateToolStep.
- **TEST-003**: Evidence path normalization test.
  Command: rg -n "frontend/src/|src/lib/|src/server.ts|db/migrations/" docs/01-requirements/domain-ubiquitous-language-glossary.md docs/02-design/domain-bounded-context-map.md docs/07-governance/domain-naming-decision-log.md
  Pass criteria: Zero legacy path prefixes in canonical docs after update.
- **TEST-004**: Evidence existence test.
  Command: verify each updated evidence path exists with rg --files and exact path lookup.
  Pass criteria: Every cited source path resolves inside current workspace.

## 7. Risks & Assumptions

- **RISK-001**: Historical rationale can be unintentionally removed while normalizing state entries.
  Mitigation: Keep superseded content as historical note blocks, not active rule text.
- **RISK-002**: Automated path normalization can alter non-evidence prose.
  Mitigation: Apply per-row atomic edits only in Source or Evidence fields.
- **RISK-003**: Mixed bilingual notes can introduce semantic drift in normative sentences.
  Mitigation: Keep normative clauses in concise English and isolate non-normative notes.
- **ASSUMPTION-001**: Runtime anchor files remain stable during documentation update window.
- **ASSUMPTION-002**: No additional canonical decision IDs are required to close current drift set.
- **ASSUMPTION-003**: Existing contracts package remains the shared source for TOOL_STEP_ORDER during this documentation cycle.

## 8. Related Specifications / Further Reading

- docs/01-requirements/domain-ubiquitous-language-glossary.md
- docs/02-design/domain-bounded-context-map.md
- docs/07-governance/domain-naming-decision-log.md
- docs/index-overview.md
- packages/contracts/src/tool-workflows.ts
- apps/frontend/src/features/tools/machines/tool-page.machine.ts
- apps/frontend/src/features/tools/runtime/useToolPageRunController.ts
- apps/backend/src/lib/runtime/auth-http.ts