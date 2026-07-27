---
type: entity
tags:
  - wiki/entity
  - generation
  - persistence
date_created: 2026-07-27
last-reviewed: 2026-07-27
next-review-date: 2027-01-27
owner: Generation
source_count: 3
entity_type: entity
---

# Artifact

The persisted output of a single generation attempt — the central entity of the [[Generation]] context.

## Lifecycle

[artifactStatus::`generating` | `completed` | `failed`]

Governed by [[ArtifactStatus]]. Failure reasons are tracked via [[ArtifactFailureReason]]: `client_disconnect`, `timeout`, `error`, `stale`.

## Classification

- **[[ArtifactType]]**: `content`, `seo`, `code`, `extraction` (canonical); `analysis`, `crawl` (provisional, GEOMETRIC)
- **[[ArtifactRole]]** (DDD-033): `'step'` (intermediate, feeds downstream dependencies) or `'final'` (terminal Tool output)

## In Multi-Step Workflows

Each `Artifact` carries [[ToolWorkflowPersistenceMetadata]] in its persisted input JSON — the orchestration contract for resume/regenerate flows. Queryable denormalized columns (`session_id`, `step_key`, `artifact_role`, `run_mode`) enable indexed reads (DDD-050).

## Cross-Context

- Generation produces `ArtifactDetail` 
- Frontend/UI consumes `GenerationArtifact` (read-model projection)
- Frontend must not write to Artifact

## Related

- [[WorkflowStep]] — produces artifacts during execution
- [[GenerationSession]] — groups artifacts by session
- [[SessionSummary]] — listing projection
- [[ArtifactRelaunch]] — governance concept for resuming from existing artifacts

## Sources

- [[domain-ubiquitous-language-glossary]]
- [[domain-bounded-context-map]]
- [[domain-naming-decision-log]] (DDD-001, DDD-033, DDD-034)