---
status: draft
version: 1.0.0
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

### 1. Module Fragmentation & Contract Boundary Leakage
The graph is significantly partitioned. Out of 5528 total nodes, the largest connected component contains only 3011 nodes (~54%). A second massive isolated component of 1116 nodes exists, alongside 215 completely isolated single nodes.
- **Hypothesis:** The `packages/contracts` layer may not be serving effectively as the universal structural bridge between `apps/frontend` and `apps/backend`. Alternatively, large subsystems (e.g., specific tooling, documentation, CI/CD scripts) are entirely orphaned from the execution flow.
- **Action Item:** Audit the second largest component (1116 nodes) to determine if it contains core business logic that is failing to use shared contracts, or if it is legitimately isolated (e.g., standalone tooling/scripts).

### 2. Low Modular Cohesion ("Feature Envy")
Implicit bounded contexts (communities detected by the graph) show extremely low cohesion scores (ranging from `0.04` to `0.07`). 
- **Symptoms:** Communities such as `Adapters Auth Interfaces`, `Admin Handlers`, and `Adapters Generation Adapters`.
- **Impact:** Files within these modules communicate far more frequently with external modules than with their own siblings. This indicates weak domain boundaries and high external coupling.
- **Action Item:** Revisit the [Domain Bounded Context Map](../02-design/domain-bounded-context-map.md). Refactor these specific directories to encapsulate logic, potentially moving leaked responsibilities closer to where they are actually consumed.

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
2. **Investigation:** Run an isolated graph query on the second largest component to identify the 1116 isolated nodes.
3. **Refactoring Design:** Select one low-cohesion community (e.g., `Admin Handlers` or `Adapters Generation Adapters`) and draft a DDD-aligned refactoring plan to increase its internal cohesion score.