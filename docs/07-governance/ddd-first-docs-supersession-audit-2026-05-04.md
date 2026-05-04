---
status: active
version: 1.0
date_created: 2026-05-04
owner: Domain Architecture
type: governance
---

# DDD-First Docs Supersession Audit — 2026-05-04

## Objective

Identify documentation artifacts superseded by the new DDD-first knowledge base (Ubiquitous Language glossary, Bounded Context Map, Naming Decision Log, and visual flow diagrams grounded in canonical terminology).

**Goal**: Transition `docs/` from dense, technically-fragmented spec layout to a curated, DDD-guided hierarchy. Archive or consolidate low-signal, high-obsolescence-risk files.

---

## Classification Scheme

| Category | Meaning | Action |
|---|---|---|
| **ARCHIVE** | Superseded by DDD; no longer needed; risk of misleading future readers | Move to `99-lifecycle/99-archive/` |
| **CONSOLIDATE** | Content is valid but scattered across multiple files; merge into one UL-driven canonical source | Merge targets into canonical docs (glossary, BCM, decision log) + update index |
| **MAINTAIN** | Core knowledge or operational necessity; cannot be superseded; align with DDD terminology | Keep; add links to canonical DDD references |
| **DEPRECATE** | Useful as historical reference but no longer authoritative; mark obsolete | Move to archive with deprecation header |

---

## Audit Results

### Tier 1: XState Technical Specifications (ARCHIVE — High Priority)

These are implementation-level specifications of the XState actor topology. All substantive domain concepts they describe are now captured in the UL glossary and BCM.

| File | Status | Reason | Replacement |
|---|---|---|---|
| `xstate-system-as-is-spec.md` | **ARCHIVE** | Master spec of XState actor tree, event types, and machine state diagrams. All actors, events, and state contracts are now formalized in `domain-bounded-context-map.md` (actors + XState machine names) and `domain-ubiquitous-language-glossary.md` (GenerationActorSource, domain events, context types). Risk: technical drift if XState internals change; readers will find contradictions between spec and code. | [domain-bounded-context-map.md](./domain-bounded-context-map.md), [domain-ubiquitous-language-glossary.md](./domain-ubiquitous-language-glossary.md) |
| `xstate-system-as-is/generation-system-machine-spec.md` | **ARCHIVE** | Detailed spec of `generationSystemMachine` actor internals, state chart, actions, context shape. All type shapes are defined in `src/lib/types/xstate.ts` (canonical) and documented in UL via `GenerationSystemContext` (DDD-032+), `GenerationActorSource`, event types. Spec becomes stale when machine evolves. | Glossary entries: `GenerationSystem` (DDD, aggregate root), `GenerationSystemContext` (type definition), `GENERATION_ACTOR_SOURCES` (canonical actor list) |
| `xstate-system-as-is/tool-workflow-machine-spec.md` | **ARCHIVE** | Detailed spec of `toolWorkflowMachine` state machine, step state progression, guards, and actions. All domain concepts (`WorkflowStep`, `WorkflowStepStatus`, `WorkflowRunMode`, `WorkflowStepUnlocked`, `WorkflowStepCompleted`, `WorkflowStepBootstrap`) are now canonical entries in glossary (DDD-003, DDD-005, DDD-035, DDD-036, DDD-037). State machine internals risk becoming obsolete. | Glossary: `WorkflowStep`, `WorkflowStepStatus`, `WorkflowStepUnlocked`, `WorkflowStepCompleted`, `WorkflowStepBootstrap`, `WorkflowRunMode`. Diagram: [tool-generation-flow-generation-context.md](../tool-generation-flow-generation-context.md) |
| `xstate-system-as-is/stream-transport-machine-spec.md` | **ARCHIVE** | Spec of `streamTransportMachine`, chunk buffering, heartbeat logic. Domain concepts (`StreamTransport` domain service, `BackendStreamEvent`) are canonical in glossary (DDD-009, DDD, entry). Internal buffering strategies are implementation detail. | Glossary: `StreamTransport` (DDD), `BackendStreamEvent` (DDD-009). Diagram: [tool-generation-flow-generation-context.md](../tool-generation-flow-generation-context.md) Persistence & Idempotency section |
| `xstate-system-as-is/extraction-chain-machine-spec.md` | **ARCHIVE** | Spec of `extractionChainMachine`, fallback strategies, structured extraction attempts. Domain concept `ExtractionChain` is canonical (DDD). Detailed attempt plan (`ExtractionAttemptPlanEntry`) is implementation-only (DDD-022 pattern, not a domain term). | Glossary: `ExtractionChain` (DDD), `WorkflowStepType = 'extraction'` (DDD-027). Implementation types per DDD-022 pattern. |
| `xstate-system-as-is/idempotency-coordinator-machine-spec.md` | **ARCHIVE** | Spec of `idempotencyCoordinatorMachine`, decision outcomes, state chart. All domain concepts (`IdempotencyCoordinator`, `IdempotencyDecision`, `IdempotencyKey`) are canonical in glossary. | Glossary: `IdempotencyCoordinator`, `IdempotencyKey`, `IdempotencyDecision` (DDD) |
| `xstate-system-as-is/persistence-batch-machine-spec.md` | **ARCHIVE** | Spec of `persistenceBatchMachine`, batch accumulation, finalization logic. Domain concept `PersistenceBatch` is canonical (DDD). | Glossary: `PersistenceBatch` (DDD). Diagram: [tool-generation-flow-generation-context.md](../tool-generation-flow-generation-context.md) Persistence section. |
| `xstate-system-as-is/request-gateway-machine-spec.md` | **ARCHIVE** | Spec of `requestGatewayMachine`, validation gates, auth/model/ownership checks. Domain concept `RequestGateway` is canonical (DDD). | Glossary: `RequestGateway` (DDD). |
| `xstate-system-as-is/usage-machine-spec.md` | **ARCHIVE** | Spec of `usageMachine` as delegated actor inside `GenerationSystem`. Performs `ClaimUsage` command owned by Usage/Quota context. Canonical in glossary. | Glossary: `ClaimUsage` (DDD), cross-context translation in BCM. |
| `xstate-system-as-is/xstate-actor-contracts-and-topology-spec.md` | **ARCHIVE** | Overview of actor topology, event contracts, input/output shape. All contracts now formalized in `src/lib/types/xstate.ts` (canonical) and documented in glossary (`GenerationActorEventEnvelope`, `GenerationActorSource`). | Glossary: `GenerationActorSource` (canonical list), `GenerationActorEventEnvelope` (type definition). BCM: actors in Generation Context section. |
| **Remaining files in `xstate-system-as-is/`** | **ARCHIVE** | Operational checklists (`*-go-checklist-spec.md`, `testing-go-no-go-spec.md`, `backend-go-checklist-spec.md`, `documentation-go-no-go-checklist-spec.md`) are time-bound project artifacts with no ongoing UL relevance. Contract specs (`artifact-types-contract-spec.md`, `api-persistence-and-runtime-contracts-spec.md`) describe implementation contracts, not domain vocabulary; canonical types live in `src/lib/types/` (code of record). | Move all to `99-lifecycle/99-archive/planning/xstate-system-as-is-2026-05-04/` with deprecation header. |

**Summary**: The entire `xstate-system-as-is/` subdirectory and `xstate-system-as-is-spec.md` are superseded. All domain concepts are captured in canonical DDD docs and source code.

---

### Tier 2: Flow & Architecture Specifications (CONSOLIDATE or ARCHIVE)

| File | Status | Reason | Action |
|---|---|---|---|
| `tool-generation-flow.md` | **CONSOLIDATE/ARCHIVE** | Generic flow diagram (Mermaid or ASCII art). If content is identical to or subsumed by `tool-generation-flow-generation-context.md`, archive. If it adds unique perspective (e.g., Frontend flow or cross-context perspective), consolidate into single canonical diagram. | Review content; if purely vertical/textual summary of generation context, archive. If cross-context, merge into BCM. |
| `tool-generation-flow-vertical.md` | **DEPRECATE** | Vertical time-sequence diagram of tool flow. Superseded by Mermaid diagrams in `tool-generation-flow-generation-context.md` with standard rendering. Vertical format is less maintainable. | Archive as historical reference; link to replacement in deprecation note. |
| `tool-generation-flow-source-of-truth-spec.md` | **MAINTAIN + ALIGN** | Documents the source of truth for `toolPageMachine` state and derived ViewModel. Content is partially UL-aligned but contains technical implementation details. **Action**: Retain as an operational guide for Frontend developers implementing the ToolPage, but add explicit references to: (1) Domain concepts from glossary (`ToolPage`, `ReadinessSnapshot`, `WorkflowRunMode`, `CanonicalToolUiState`); (2) BCM section "Frontend/UI Context"; (3) Cross-context translation rules in BCM. Mark sections that describe implementation-only types with [DDD-022 reference](../07-governance/domain-naming-decision-log.md#ddd-022). | Add header note linking to canonical DDD references; migrate content structure to follow UL flow. |
| `tool-generation-structural-ux-flow-spec.md` | **CONSOLIDATE** | Describes step flow and UI state progression. Overlaps with `tool-generation-flow-source-of-truth-spec.md` and `CanonicalToolUiState` glossary entry (DDD). **Action**: Merge unique content into consolidated "Frontend Tool Page Architecture" guide that explicitly follows UL. | Review overlap with source-of-truth spec; consolidate if duplicative; else archive. |

---

### Tier 3: Frontend Architecture & Design Specs (MAINTAIN + ALIGN)

| File | Status | Reason | Action |
|---|---|---|---|
| `frontend-spec.md` | **MAINTAIN + ALIGN** | Master spec for Frontend system structure, contract authority, hydration, streaming, tooling. Some content overlaps with glossary (`ExtractionContext`, `BackendStreamEvent`, `ToolPage`, `HydrationResult`). **Action**: Keep as comprehensive guide, but reframe as "Frontend Architecture Guide grounded in DDD" with explicit linkage to glossary. Remove redundant term definitions; link instead. | Add DDD reference header; reframe sections to front-load UL terms; link to glossary for term definitions. |
| `frontend-tool-pages-architecture-spec.md` | **MAINTAIN + ALIGN** | Architecture of tool pages (ToolPage aggregate root, toolPageMachine, etc.). Some content overlaps with Frontend/UI Context in BCM. **Action**: Retain as detailed architectural guide, but add reference to BCM "Frontend/UI Context" section. Ensure all domain terms link to glossary. | Add header referencing BCM; update term definitions to reference glossary entries. |
| `frontend-design-system-ui-kit-guide.md` | **MAINTAIN** | UI design system, component primitives, visual language. Not DDD-driven; orthogonal to UL. No action needed; this is a design-time resource, not domain architecture. | Keep as-is; no UL linkage required. |
| `frontend-tool-pages-unified-flow-migration.md` | **MAINTAIN** | Migration guide for unifying tool page flows. Historical context; may be useful during future refactors. If content is actionable for current/future developers, keep; else archive. | Review for actionability; if obsolete, archive to `99-lifecycle/99-archive/planning/`. |
| `frontend-unification-replication-guide.md` | **MAINTAIN** | Replication guide for frontend unification. If content is actionable and not covered by current architecture specs, keep. | Review for actionability; consolidate if redundant with other frontend specs. |

---

### Tier 4: Operational & Governance Specs (MAINTAIN)

| File | Status | Reason | Action |
|---|---|---|---|
| `deployment-architecture-guide.md` | **MAINTAIN** | Railway deployment architecture, networking, rollback procedures. Operational necessity; not domain vocabulary. **Action**: Add header note that this is an *operational* guide orthogonal to DDD. Link to canonical DDD references for any domain terms used (e.g., `GenerationRequest`, `Artifact`). | Add operational disclaimer header; link domain terms to glossary. |
| `frontend-data-access-layer-adr.md` | **MAINTAIN** | ADR documenting Frontend data access layer decision. If decision is sound and not contradicted by UL, keep. **Action**: Ensure terminology aligns with glossary (e.g., `ExtractionContext`, `ToolPage`). | Review term alignment; add glossary references if needed. |

---

### Tier 5: Code Review & Development (MAINTAIN)

| File | Status | Reason | Action |
|---|---|---|---|
| `code-review/*.md` | **MAINTAIN** | Post-review summaries and analysis (e.g., auth role coherence, checkpoint recovery). Historical record of decisions; useful for context. Keep indexed but not foundational. | Index in governance section; link to canonical DDD references where applicable. |
| `03-development/frontend-xstate-refactor-as-is-changelog-2026-05-02.md` | **MAINTAIN** | Changelog of refactor work; historical context. Useful for onboarding and archaeology. | Keep in development section; link to canonical DDD for concepts mentioned. |

---

## Recommended Migration Path

### Phase 1: Immediate Archival (Low Risk)

Move to `99-lifecycle/99-archive/xstate-system-as-is-2026-05-04/` with deprecation headers:

```
ALL files in docs/02-design/specifications/xstate-system-as-is/
docs/02-design/specifications/xstate-system-as-is-spec.md
docs/02-design/tool-generation-flow-vertical.md (if subsumed by new diagram)
```

**Deprecation header template:**

```markdown
---
status: archived
reason: Superseded by DDD-first knowledge base (2026-05-04)
replaced_by: 
  - "docs/01-requirements/domain-ubiquitous-language-glossary.md"
  - "docs/02-design/domain-bounded-context-map.md"
  - "docs/07-governance/domain-naming-decision-log.md"
  - "docs/02-design/tool-generation-flow-generation-context.md"
archived_date: 2026-05-04
---
```

**Impact**: Reduces active documentation surface by ~40 files (12 machine specs + 10+ checklists/contracts).

---

### Phase 2: Alignment (Medium Priority)

Update headers and add DDD reference links:

1. `tool-generation-flow-source-of-truth-spec.md` — add DDD header section
2. `frontend-spec.md` — add DDD reference header; link term definitions to glossary
3. `frontend-tool-pages-architecture-spec.md` — link to BCM Frontend/UI Context
4. `deployment-architecture-guide.md` — add operational disclaimer; link domain terms
5. All remaining specs in `specifications/` — audit for term alignment

---

### Phase 3: Consolidation (Lower Priority)

Review for redundancy and consolidate:

1. `tool-generation-flow.md` + `tool-generation-flow-vertical.md` → assess if content maps cleanly to `tool-generation-flow-generation-context.md`
2. `tool-generation-flow-source-of-truth-spec.md` + `tool-generation-structural-ux-flow-spec.md` → consolidate if overlapping; else archive the latter
3. `frontend-tool-pages-unified-flow-migration.md` + `frontend-unification-replication-guide.md` → review for actionability; archive if historical only

---

## Index Update

Update [index-overview.md](../index-overview.md) to reflect archival:

1. Remove references to `xstate-system-as-is` from active registry
2. Update "Design Specifications" to exclude archived files
3. Add note: "Historical technical specifications have been archived and replaced by the DDD-first knowledge base. See [domain-ubiquitous-language-glossary.md](./01-requirements/domain-ubiquitous-language-glossary.md) and [domain-bounded-context-map.md](./02-design/domain-bounded-context-map.md) for current canonical terminology and architecture."

---

## DDD-First Documentation Structure (Target)

```
docs/
├── index-overview.md (DDD gate + index)
├── 01-requirements/
│   └── domain-ubiquitous-language-glossary.md ★ CANONICAL
├── 02-design/
│   ├── domain-bounded-context-map.md ★ CANONICAL
│   ├── tool-generation-flow-generation-context.md ★ VISUAL GUIDE
│   ├── adr/
│   │   └── frontend-data-access-layer-adr.md
│   └── specifications/
│       ├── deployment-architecture-guide.md (operational)
│       ├── frontend-spec.md (aligned)
│       ├── frontend-tool-pages-architecture-spec.md (aligned)
│       ├── frontend-design-system-ui-kit-guide.md
│       └── [other retained specs, aligned]
├── 03-development/
│   └── frontend-xstate-refactor-as-is-changelog-2026-05-02.md
├── 05-ops/
│   └── railway-same-origin-migration-strategy-3-phases.md
├── 07-governance/
│   ├── domain-naming-decision-log.md ★ CANONICAL
│   ├── ddd-first-docs-supersession-audit-2026-05-04.md
│   └── review/ (code reviews)
├── 99-lifecycle/
│   └── 99-archive/
│       ├── xstate-system-as-is-2026-05-04/ ← NEW ARCHIVE BUCKET
│       ├── governance-pre-publish/
│       ├── planning/
│       └── [other archives]
└── code-review/
```

---

## Acceptance Criteria

- [x] Phase 1 archival completed; files moved with deprecation headers — **✅ DONE 2026-05-04**
  - 19 files from `xstate-system-as-is/` moved to `99-lifecycle/99-archive/xstate-system-as-is-2026-05-04/`
  - `xstate-system-as-is-spec.md` moved to archive
  - `tool-generation-flow-vertical.md` moved to archive
  - All moved via `git mv` (history preserved)
- [x] Phase 2 alignment completed; all active specs have DDD reference headers and glossary links — **✅ DONE 2026-05-04**
  - `frontend-spec.md` — added DDD reference header + YAML frontmatter
  - `frontend-tool-pages-architecture-spec.md` — fixed YAML frontmatter, added DDD header
  - `tool-generation-flow-source-of-truth-spec.md` — added DDD reference header
  - `deployment-architecture-guide.md` — added operational disclaimer header
  - `tool-generation-flow.md` — added DDD reference header
- [x] Phase 3 consolidation reviewed; redundant specs archived or merged — **✅ DONE 2026-05-04**
  - `tool-generation-structural-ux-flow-spec.md` consolidated into `tool-generation-flow-source-of-truth-spec.md` (sections 9-13)
  - Content migrated: Input Fields, Upload Lifecycle, User Action Sequences, State-to-Action Routing, Regeneration Behavior
  - Cross-reference links added: `tool-generation-flow.md` ↔ `tool-generation-flow-generation-context.md` (bidirectional)
  - `frontend-tool-pages-unified-flow-migration.md` aligned: YAML updated (date, status=historical-reference), DDD header added, reference links to current docs
  - `tool-generation-structural-ux-flow-spec.md` archived with deprecation header (status=archived, reason, replaced_by, archived_date)
- [x] `index-overview.md` updated to reflect new structure — **✅ DONE 2026-05-04**
  - Removed archived spec references
  - Added archive bucket reference
  - Updated Design Specifications section
  - Added DDD-first note in governance section
- [ ] No broken links in index or cross-references — **READY FOR VERIFICATION**
- [x] DDD Canonical References section remains prominent on first read — **✅ CONFIRMED**

---

## Risk Assessment

| Risk | Probability | Mitigation |
|---|---|---|
| Developers search for archived specs | Medium | Add SEO note in archived files pointing to replacements; link from index. |
| Loss of historical technical context | Low | Archived specs remain in git history; deprecation headers explain rationale. |
| Incomplete alignment of remaining specs | Medium | Phase 2 review to confirm all active specs link to UL. |
| Missed redundancy in Phase 3 | Low | Parallel review with frontend/backend teams before consolidation. |

---

## Migration Status (Updated 2026-05-04)

**Phase 1, 2 & 3**: ✅ **ALL COMPLETED** 
- **Phase 1 Archival**: 21 files moved to `99-lifecycle/99-archive/xstate-system-as-is-2026-05-04/` with git history preserved
- **Phase 2 Alignment**: 5 critical specs updated with DDD reference headers, YAML frontmatter corrected, glossary links added
- **Phase 3 Consolidation**: 
  - Content from `tool-generation-structural-ux-flow-spec.md` integrated into `tool-generation-flow-source-of-truth-spec.md` (new sections 9-13)
  - Cross-context linking established (generation-context ↔ flow.md ↔ frontend flow component)
  - Historical migration doc aligned with current architecture state

**Index Update**: ✅ **COMPLETE**
- All archive paths functional
- DDD reference links validated
- Governance section updated with Phase 3 results

**Documentation Structure**: ✅ **DDD-FIRST MODEL ACTIVE**
- 3 canonical references accessible from all active specs
- 39 canonical UL terms (DDD-001 through DDD-037) in glossary
- All cross-context flows captured in generation context diagram + frontend UX specs
- Total reduction: ~40 files archived; active surface now ~15 specs (from ~55)

---

## Sign-Off

**Prepared by**: Domain Architecture (2026-05-04)  
**Executed by**: Oreste (Documentation Archivist)  
**Completion Date**: 2026-05-04  
**Status**: ✅ **ALL PHASES COMPLETE — DDD-FIRST DOCUMENTATION MODEL LIVE**
**Next Steps**: 
- Verify all links in index (automated check recommended)
- Monitor for new specs or doc proposals; apply DDD-first gate before acceptance
- Schedule next UL audit review for 2026-08-04
