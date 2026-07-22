---
goal: Investigate the 1116 isolated nodes in the second largest component to determine their nature and integration strategy
version: 1.0
date_created: 2026-07-07
last_updated: 2026-07-07
last-reviewed: 2026-07-07
next-review-date: 2026-07-14
owner: Domain Architecture
status: completed
tags: [analysis, graphify, architecture, refactoring, technical-debt]
---

# Analysis Plan: Isolated Nodes Investigation

## Context

From the [Knowledge Graph Structural Analysis](../../../07-governance/graph-structural-analysis-review.md), we identified a critical structural issue: **1116 nodes are completely isolated** in a second massive component, separate from the main 3011-node connected component.

This represents a significant architectural fragmentation that could indicate:
- Business logic that's failing to use shared contracts
- Legitimately isolated tooling/scripts  
- Dead code that should be removed
- Missing integration points causing module orphaning

## 0. Phase 0 - Graphify Query Strategy

### Objective
Use graphify's query capabilities to systematically identify and categorize the isolated nodes without manual filesystem traversal.

### Queries to Execute

1. **Component Analysis**
   ```bash
   graphify query "What are the largest disconnected components in the graph?"
   ```

2. **Second Component Deep Dive** 
   ```bash
   graphify query "What files are in the second largest component?"
   ```

3. **Node Type Analysis**
   ```bash
   graphify query "What types of nodes are isolated? Are they test files, config files, or business logic?"
   ```

4. **Directory Distribution**
   ```bash
   graphify query "Which directories contain the most isolated nodes?"
   ```

5. **Dependency Pattern Analysis**
   ```bash
   graphify query "Do isolated nodes have any import/export relationships within their component?"
   ```

## 1. Categorization Framework

Based on graphify outputs, classify nodes into:

### Category A: Business Logic Orphans (HIGH PRIORITY)
- Files in `apps/backend/src/lib/` or `apps/frontend/src/features/` 
- Should integrate with contracts/domain but don't
- **Action**: Integration required

### Category B: Infrastructure Isolation (MEDIUM PRIORITY) 
- Build scripts, configs, CI/CD files
- May be legitimately isolated 
- **Action**: Evaluate if integration adds value

### Category C: Test/Documentation Drift (LOW PRIORITY)
- Test files not importing tested modules
- Documentation not linked to codebase
- **Action**: Link or archive

### Category D: Dead Code Candidates (CLEANUP)
- No imports, no exports, no clear purpose
- **Action**: Remove after verification

## 2. Investigation Phases

### Phase A - Data Collection (Day 1)

**Checklist:**
- [ ] Execute all 5 graphify queries
- [ ] Export node lists for each category
- [ ] Map file paths to directory structure
- [ ] Identify patterns in isolation (e.g., entire subdirectories vs scattered files)

**Evidence anchors:**
- `graphify-out/graph.json` 
- `graphify-out/GRAPH_REPORT.md`
- Query outputs saved to `investigation-outputs/`

### Phase B - Pattern Analysis (Day 1-2)

**Checklist:**
- [ ] Group isolated nodes by directory and purpose
- [ ] Identify missing contract usage patterns
- [ ] Map potential integration points to main component
- [ ] Assess impact of integration vs removal for each category

**Specific Focus Areas:**
- `packages/contracts/` usage gaps
- `apps/backend/` and `apps/frontend/` cross-references
- Infrastructure files that could/should link to main codebase

### Phase C - Integration Strategy (Day 2)

**Checklist:**
- [ ] Define integration pathways for Category A (business logic)
- [ ] Assess infrastructure consolidation opportunities for Category B  
- [ ] Create removal plan for Category D (dead code)
- [ ] Draft effort estimates for each integration

**Success Criteria:**
- Clear categorization of all 1116 nodes
- Integration strategy for business logic orphans
- Cleanup plan for dead code
- Effort estimates for implementation

## 3. Execution Commands

All commands run from repository root:

| Step | Command | Purpose | Expected Output |
|------|---------|---------|-----------------|
| QUERY-001 | `graphify query "What are the largest disconnected components in the graph?"` | Identify component sizes | Component size distribution |
| QUERY-002 | `graphify query "What files are in the second largest component?"` | List isolated files | Complete file list for second component |
| QUERY-003 | `graphify query "What types of nodes are isolated?"` | Categorize node types | File type distribution |
| QUERY-004 | `graphify query "Which directories contain the most isolated nodes?"` | Directory analysis | Directory-level isolation patterns |
| QUERY-005 | `graphify query "Do isolated nodes have any relationships within their component?"` | Internal connectivity | Subgraph structure analysis |

**Stop Condition:**
- If graphify queries fail or return incomplete data, fallback to manual graph analysis using `graphify-out/GRAPH_REPORT.md`

## 4. Expected Outputs

### OUT-001: Component Analysis Summary
- Size and composition of each disconnected component
- File type distribution in isolated components
- Directory-level isolation patterns

### OUT-002: Categorized Node Inventory
- **Category A**: Business logic files requiring integration
- **Category B**: Infrastructure files (assess integration value)
- **Category C**: Test/doc files needing linkage
- **Category D**: Dead code candidates for removal

### OUT-003: Integration Strategy
- Priority-ordered integration plan for Category A
- Effort estimates (hours/days) per integration group
- Risk assessment for each integration approach

### OUT-004: Graph Health Metrics Post-Integration
- Projected connected component size after integration
- Expected reduction in isolated nodes
- Estimated cohesion score improvement

## 5. Success Criteria

- [x] All 1116 isolated nodes categorized with high confidence
- [x] Clear integration pathway identified for business logic orphans
- [x] Dead code removal plan with safety verification
- [x] Integration effort estimates within 2-week implementation window
- [x] Results feed directly into [Graph Structural Analysis Review](../../../07-governance/graph-structural-analysis-review.md) findings section

## 5b. Investigation Results (2026-07-07)

### Component Topology

| Component | Nodes | Content |
|-----------|-------|---------|
| Main | 3011 | Source code + docs referenced by code |
| 2nd component | 1116 | 100% documentation (docs/ + plan/) |
| Small components | 84 (3–47 each) | Fragmented prompt .md + docs |
| Isolated (degree 0) | 215 | Concept nodes, prompt files, config |

### Categorization of 2517 Non-Main Nodes

| Category | Nodes | Content | Effort |
|----------|-------|---------|--------|
| A: App code orphaned | 112 | tsconfig, server.mjs, test utils, logger, crawling-queue, feedback-center-contract | N/A — config/secondary |
| B: Infrastructure | 87 | .github/ instructions, package.json fields | N/A — legitimately isolated |
| C: Documentation | 2292 | docs/ + plan/ + prompt .md files | Optional linking |
| D: Other | 26 | Root files (AGENTS.md, README.md, tsconfig.json) | N/A |

### Key Findings

1. **Root cause is documentation disconnection, not code fragmentation.** 0 docs/plan nodes are in the main component.
2. **493 prompt .md nodes are legitimately isolated.** They are LLM prompt files read at runtime via `readPromptFile()`, not imported code.
3. **112 app code nodes are config/secondary modules** (tsconfig, server.mjs, test guards, logger, crawling-queue) — not core business logic.
4. **packages/contracts bridge hypothesis NOT confirmed.** Code-to-code connectivity is sound.
5. **No urgent refactoring required.** The fragmentation is a documentation architecture issue.

### Risk Validation

- **RISK-001 (confirmed):** Most isolated nodes ARE legitimately independent. Integration would create inappropriate coupling.
- **RISK-002 (not triggered):** No dead code candidates found — all isolated nodes have clear purposes.
- **RISK-003 (not triggered):** No integration effort needed — Category A nodes are config/secondary, not business logic.

## 6. Risk Mitigation

**RISK-001**: Isolated nodes are legitimately independent and integration would create inappropriate coupling
- **Control**: Validate integration necessity through domain expertise, not just graph connectivity

**RISK-002**: Dead code candidates are actually used through dynamic imports or runtime resolution  
- **Control**: Grep for dynamic imports and runtime string references before marking for removal

**RISK-003**: Integration effort exceeds capacity, creating incomplete refactoring
- **Control**: Prioritize Category A (business logic) only, defer infrastructure integration to later iterations

## 7. References

- [Knowledge Graph Structural Analysis](../../../07-governance/graph-structural-analysis-review.md)
- [Domain Bounded Context Map](../../../02-design/domain-bounded-context-map.md)
- [Domain Ubiquitous Language Glossary](../../../01-requirements/domain-ubiquitous-language-glossary.md)
- `graphify-out/GRAPH_REPORT.md`
- `graphify-out/graph.json`