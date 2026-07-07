---
status: active
version: 1.5.0
last-reviewed: 2026-07-07
next-review-date: 2026-08-07
owner: Domain Architecture
date_created: 2026-07-07
title: Knowledge Graph Structural Analysis & Refactoring Proposal
type: code-review
tags:
  - architecture
  - refactoring
  - technical-debt
  - graphify
goal: Identify structural technical debt from graphify topology analysis and propose refactoring targets.
---

# Knowledge Graph Structural Analysis & Refactoring Proposal

This document outlines structural vulnerabilities and architectural technical debt identified via topological analysis of the project's knowledge graph (generated via `graphify`). It serves as a baseline proposal for targeted refactoring.

## Executive Summary

The project exhibits **perfect referential integrity** (zero dangling edges, missing endpoints, or self-loops) and a fundamentally sound **hub-and-spoke topology** (assortativity: -0.03). Core concepts are successfully distributed across the system without forming a central, inextricable monolithic knot. 

However, the architecture suffers from **low modular cohesion** ("Distributed Monolith Syndrome"). Responsibilities within directories frequently leak, forcing modules to couple heavily to external domains rather than encapsulating their own behavior.

## Key Areas for Intervention

### 1. Module Fragmentation & Documentation Graph Disconnection (INVESTIGATED)
The graph is significantly partitioned. Out of 5528 total nodes, the largest connected component contains only 3011 nodes (~54%). A second massive isolated component of 1116 nodes exists, alongside 215 completely isolated single nodes and 84 smaller components (3–47 nodes each).

**Investigation Result (2026-07-07):** The fragmentation is **not** caused by business logic failing to use shared contracts. The root cause is a **complete disconnection between the code graph and the documentation graph**.

#### Component Topology

| Component | Nodes | Content |
|-----------|-------|---------|
| Main | 3011 | Source code + docs referenced by code |
| 2nd component | 1116 | 100% documentation (docs/ + plan/) |
| Small components | 84 (3–47 each) | Fragmented prompt .md + docs |
| Isolated (degree 0) | 215 | Concept nodes, prompt files, config |

#### Categorization of 2517 Non-Main Nodes

| Category | Nodes | Content |
|----------|-------|---------|
| A: App code orphaned | 112 | tsconfig, server.mjs, test utils, logger, crawling-queue, feedback-center-contract |
| B: Infrastructure | 87 | .github/ instructions, package.json fields |
| C: Documentation | 2292 | docs/ + plan/ + prompt .md files |
| D: Other | 26 | Root files (AGENTS.md, README.md, tsconfig.json) |

#### Key Findings

- **0 docs/plan nodes** are connected to the main code component — the documentation graph is entirely self-referential.
- **493 prompt .md nodes** (in `apps/backend/src/lib/runtime/tool-prompts/`) are legitimately isolated — they are LLM prompt files read at runtime via `readPromptFile()`, not imported code.
- **112 app code isolated nodes** are config files (tsconfig.json), test guard scripts, server.mjs, and secondary modules (`crawling-queue.ts`, `feedback-center-contract.ts`, `logger.ts`) — **not core business logic**.
- The original hypothesis that `packages/contracts` is failing as a structural bridge is **not confirmed**. The code-to-code connectivity is sound; the gap is code-to-documentation.

#### Revised Assessment

The fragmentation represents a **documentation architecture issue**, not a code architecture issue. The documentation forms its own disconnected knowledge graph, which reduces the value of graphify for cross-referencing code ↔ docs. No urgent refactoring is required for the code layer.

### 2. Low Modular Cohesion ("Feature Envy") — PARTIALLY ADDRESSED
Implicit bounded contexts (communities detected by the graph) show extremely low cohesion scores (ranging from `0.04` to `0.07`). 
- **Symptoms:** Communities such as `Adapters Auth Interfaces`, `Admin Handlers`, and `Adapters Generation Adapters`.
- **Impact:** Files within these modules communicate far more frequently with external modules than with their own siblings. This indicates weak domain boundaries and high external coupling.
- **Action Taken (2026-07-07):** Refactored `Admin Handlers` community via subdirectory decomposition. `auth-http/` split into `admin/`, `auth/`, `projects/`, `tools/`. Cohesion improved from 0.05 to 0.09. See [plan/refactor-admin-handlers-cohesion-1.md](../../plan/refactor-admin-handlers-cohesion-1.md).
- **Remaining:** `Adapters Auth Interfaces` (0.06) and `Adapters Generation Adapters` (0.06) remain unaddressed.

### 3. Overloaded Domain "God Nodes"
While generic UI utilities (`appCopy`, `cx()`) are expected to be highly connected, several architectural abstractions have accumulated an unsustainable number of dependencies:
- `useAuthSession()` (48 edges)
- `resolveBackendCapabilities()` (41 edges)
- `ToolKey` (32 edges, spanning backend route pipelines, frontend hydration, and shared validation)
- **Impact:** Changes to these core abstractions will trigger massive, cascading refactoring across the repository. They currently violate the Single Responsibility Principle by centralizing too much disparate logic.
- **Action Item:** Decompose these God Nodes. For instance, split `ToolKey` usages into context-specific interfaces (e.g., `ToolRoutingKey`, `ToolUIConfigKey`).

### 4. Circular Dependencies (RESOLVED)
The graph previously detected active import cycles, explicitly highlighting barrel file (`index.ts`) misuse.
- **Detected Cycle:** `apps/backend/src/lib/runtime/index.ts` -> `apps/backend/src/lib/runtime/node-server.ts` -> `apps/backend/src/lib/runtime/index.ts`.
- **Resolution:** The handler logic was extracted from the barrel file into a dedicated `generation-handler.ts` file, and `node-server.ts` was updated to import directly from it. The barrel file now acts purely as a re-export module, breaking the cycle and enforcing unidirectional data flow.

## Proposed Next Steps

1. ~~**Immediate fix (Low effort, high value):** Resolve the `index.ts` circular dependency in `apps/backend/src/lib/runtime/`.~~ (Completed)
2. ~~**Investigation:** Run an isolated graph query on the second largest component to identify the 1116 isolated nodes.~~ (Completed — see Section 1 findings)
3. ~~**Refactoring Design:** Select one low-cohesion community (e.g., `Admin Handlers` or `Adapters Generation Adapters`) and draft a DDD-aligned refactoring plan to increase its internal cohesion score.~~ (Completed — see [plan/refactor-admin-handlers-cohesion-1.md](../../plan/refactor-admin-handlers-cohesion-1.md). Cohesion: 0.05 → 0.09)
4. ~~**Documentation Linking (Optional, Low Priority):** Add explicit cross-references from documentation files to source code (e.g., via `graphify` annotations or structured frontmatter `code-anchors`) to re-connect the documentation graph to the code graph. This would improve graphify's utility for code ↔ docs navigation but has no functional impact.~~ (Completed — Evidence anchors added to 5 key documentation files. Graphify AST extractor does not follow markdown file path references; cross-type edges remain 0. See [plan/analysis-documentation-linking-1.md](../../plan/analysis-documentation-linking-1.md))
5. **Future Refactoring (Optional):** Address remaining low-cohesion communities (`Adapters Auth Interfaces`, `Adapters Generation Adapters`) using the same subdirectory decomposition pattern.