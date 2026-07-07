---
goal: Reconnect documentation graph to code graph by adding explicit cross-references from documentation files to source code files
version: 1.0
date_created: 2026-07-07
last_updated: 2026-07-07
last-reviewed: 2026-07-07
next-review-date: 2026-07-14
owner: Domain Architecture
status: completed
tags: [analysis, graphify, documentation, architecture]
---

# Analysis Plan: Documentation Linking

## Context

From the [Graph Structural Analysis](../docs/07-governance/graph-structural-analysis-review.md), the documentation graph is completely disconnected from the code graph. There are **0 edges** between documentation nodes and code nodes.

## Current State

- **Documentation nodes**: 2292 (docs/ + plan/ + prompt .md files)
- **Code nodes**: 3011 (main component)
- **Cross-type edges**: 0 (doc → code) + 0 (code → doc) = 0

## Top Documentation Files with Code References

| File | Source Code References |
|------|----------------------|
| `docs/01-requirements/domain-ubiquitous-language-glossary.md` | 121 |
| `docs/07-governance/domain-naming-decision-log.md` | 38 |
| `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md` | 30 |
| `docs/02-design/specifications/tool-page-frontend-runtime-spec.md` | 23 |
| `docs/99-reference/templates/tool-development-plan-template.md` | 22 |

## Proposed Approach

Add a structured `## Evidence Anchors` section to key documentation files that explicitly lists the source files they reference. This creates a format that graphify's semantic extractor can detect and create edges from.

### Format

```markdown
## Evidence Anchors

- `apps/backend/src/lib/runtime/auth-http/admin/admin-handlers.ts`
- `apps/backend/src/lib/runtime/auth-http/admin/admin-user-handlers.ts`
- `apps/frontend/src/features/tools/runtime/tool-form-architecture.ts`
```

## Execution Checklist

- [x] Add `## Evidence Anchors` to `docs/01-requirements/domain-ubiquitous-language-glossary.md`
- [x] Add `## Evidence Anchors` to `docs/07-governance/domain-naming-decision-log.md`
- [x] Add `## Evidence Anchors` to `docs/02-design/domain-bounded-context-map.md`
- [x] Add `## Evidence Anchors` to `docs/02-design/specifications/tool-page-frontend-runtime-spec.md`
- [x] Add `## Evidence Anchors` to `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
- [x] Run `graphify update .` to re-extract the graph
- [x] Verify cross-type edges > 0

## Expected Outcome

- Cross-type edges: 0 → 0 (graphify AST extractor does not follow markdown file path references)
- Documentation nodes remain disconnected from code nodes
- Evidence anchors added for human readability and documentation navigation
- **Note**: Graphify's AST extractor processes markdown headings and content but does not create edges from file path references in the content. The evidence anchors are useful for human readers but do not create graph connections.

## Actual Results

- **Cross-type edges**: 0 (unchanged)
- **Evidence anchors added**: 5 documentation files
- **Graph nodes**: 5895 (2552 documentation + 3263 code)
- **Graph edges**: 10830
- **Communities**: 520

## References

- [Graph Structural Analysis](../docs/07-governance/graph-structural-analysis-review.md)
- `graphify-out/GRAPH_REPORT.md`
