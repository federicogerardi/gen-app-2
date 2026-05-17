# Gen App 2

Gen App 2 helps teams turn ideas into production-ready communication assets.

At its core, the product is built around Tools. A Tool takes your input, moves it through a deterministic step flow, and produces an Artifact you can use, review, and relaunch from.

This repository is organized with Domain-Driven Design and a strict Ubiquitous Language so product, design, and engineering can describe the same behavior with the same words.

## Why This Matters

Most content systems break when teams scale: terms drift, flows become unclear, and the same action means different things in different screens.

Gen App 2 solves that by anchoring every workflow around four bounded contexts and one shared language.

## The Four Bounded Contexts

| Bounded Context | What it owns | Canonical examples |
| --- | --- | --- |
| Generation | Producing and persisting Artifacts | GenerationSystem, GenerationRequest, Artifact, WorkflowStep |
| Auth | Identity and session trust | User, AuthSession, AuthSessionPrincipal |
| Usage/Quota | Fair usage and auditability | ClaimUsage, MonthlyQuota, QuotaHistory, Project |
| Frontend/UI | Guided user experience | ToolPage, ReadinessSnapshot, HydrationResult, ToolStep |

## Product Story in One Flow

1. A user enters a ToolPage.
2. The UI computes a ReadinessSnapshot.
3. If ready, the app assembles and sends a GenerationRequest.
4. Generation runs as a deterministic XState actor flow.
5. The user sees live BackendStreamEvent updates.
6. The final Artifact is stored and becomes relaunchable through ArtifactRelaunch.

In business terms: users move from brief to reusable output with traceable decisions and predictable behavior.

## Current Product Surface

- SupportedTool lineup: funnel-pages, nextland, youtube-lf-script.
- ToolPage experience: briefing upload, ReadinessSnapshot gating, deterministic ToolStep progression.
- Dual history model: Artifact history for single outputs plus SessionSummary for GenerationSession aggregate navigation.
- AdminDashboard for user management, LLM model catalog management, changelog publishing, user report triage, and activity review.

## DDD + UL Promise

This codebase avoids synonym drift by design.

- Artifact always means persisted generation output.
- ToolKey is the cross-context identifier of a Tool.
- SupportedTool is the Frontend projection of ToolKey.
- ToolWorkflow remains a Generation routing concept, separate from Tool identity.
- SessionSummary is the aggregate listing projection for GenerationSession navigation.

## XState as Product Reliability Layer

XState is not just implementation detail here. It is how domain behavior stays explicit:

- clear state transitions
- deterministic orchestration
- resumable and regenerable runs through WorkflowRunMode
- auditable stream and persistence lifecycle

## Quiet Principles

Model first. Name things once. Let events tell the truth.

<!-- bomberto-egg-01 cipher:b64 c2JlcnNh -->

## Repository At A Glance

- apps/backend: Generation, Auth, Usage/Quota runtime
- apps/frontend: Frontend/UI runtime and user journey
- packages/contracts: FE/BE contract authority for GenerationRequest and BackendStreamEvent
- packages/domain: shared domain package
- packages/infra-db: migrations, seeds, and DB execution utilities
- docs: canonical DDD and Ubiquitous Language governance

## Start Here

If you are new to the project, read these in order:

1. docs/01-requirements/domain-ubiquitous-language-glossary.md
2. docs/02-design/domain-bounded-context-map.md
3. docs/07-governance/domain-naming-decision-log.md
4. docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md

Then move to docs/index-overview.md for the full architecture and implementation map.

---

With gratitude to Bomberto ❤️❤️
