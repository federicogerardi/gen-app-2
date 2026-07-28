---
type: source-summary
tags:
  - wiki/source
  - ddd
  - audit
  - governance
  - bounded-context
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/07-governance/ddd-implementation-audit.md
date_ingested: 2026-07-28
source_version: 1.1
---

# DDD Implementation Audit

Comprehensive audit of DDD implementation in `gen-app-2`, executed 2026-07-22. Verifies 6 bounded contexts, all value objects, contracts, repository pattern, and XState-as-Aggregate pattern.

## Overall Assessment: Solid — 2 minor gaps, no blockers

## Bounded Context Verification

| Context | Status | Aggregate Root |
|---------|--------|---------------|
| Generation | ✅ Canonical, implemented | `[[GenerationSystem]]`, `[[ToolWorkflowJob]]` (provisional) |
| Auth | ✅ Canonical, implemented | `[[AuthSessionPrincipal]]` |
| Usage/Quota | ✅ Canonical, implemented | `ClaimUsage`, `ConsumeCredits`, `RecordArtifactSuccess` commands |
| Frontend/UI | ✅ Canonical, implemented | `[[ToolPage]]` |
| Crawling & Extraction | ⚠️ Provisional | `[[CrawlingJob]]`, partial runtime |
| Competitor Analysis | ⚠️ Provisional | `[[CompetitorRanking]]`, partial runtime |

## Value Object Verification

All shared VOs in `packages/domain/src/index.ts` use the pattern `const ARRAY = [...] as const` + `type = (typeof ARRAY)[number]` with type guards and normalizers. Backend and Frontend import from `@gen-app-2/domain` — zero duplication.

## Contracts: Excellent

`packages/contracts` is single source of truth with compile-time parity guard. Covers `GenerationRequest`, `BackendStreamEvent`, 11 `ToolWorkflowDefinition`s, `AssetDomainModel` (13 `AssetType`s), `ExtractionFields` (39 canonical keys), `ApiServiceDto`.

## Identified Gaps

| Gap | Severity | DDD Ref | Status (2026-07-23) |
|-----|----------|---------|---------------------|
| `ToolFormKey` type never created | Medium | DDD-029 | Still missing — `SupportedTool` used instead |
| Hardcoded Italian `'Progetto'` in `ProjectsListPage.tsx:43` | Low | UI Spec §13.5 | Still present — soft fallback |

## Architectural Observations

**XState-as-Aggregate** is validated as a legitimate DDD pattern (Actor Model / hybrid Event Sourcing). Strengths: explicit typed state machines, clear domain/infrastructure separation, `assign()`/`guard()`/`action()` encapsulating business logic.

**Areas of attention** noted: domain logic distributed across machines/selectors/normalizers (not concentrated in entity classes), no explicit domain event bus, inter-process event mechanism needed for async contexts (BullMQ).

**Repository pattern**: excellent — typed interfaces, Kysely implementations, no ORM, no direct DB access from domain.

## Recommendations

1. Implement `[[ToolFormKey]]` type alias (5 min)
2. Remove hardcoded `'Progetto'` fallback (2 min)
3. Define inter-process events for `[[ToolWorkflowJob]]`
4. Document XState-as-Aggregate pattern in [[BCM]]
5. Centralize business rules into `domain-rules.ts`

## Contradictions

- **DDD-029 violation confirmed**: the audit documents that `ToolFormKey` type (mandated by DDD-029) was never implemented — `SupportedTool` is used instead. This contradicts the [[domain-naming-decision-log]] which states DDD-029 as canonical.
- **Domain Events gap**: the audit notes "events only within XState actor tree, not inter-process" — this may be a tension point with the [[be-driven-workflow-execution]] concept which introduces BullMQ-backed async jobs crossing process boundaries.

## Source

- File: `docs/07-governance/ddd-implementation-audit.md`
- Version: 1.1
- Last reviewed: 2026-07-23
- Owner: Domain Architecture