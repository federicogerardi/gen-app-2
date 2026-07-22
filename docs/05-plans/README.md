# Implementation Plans

This directory contains only **active, in-progress, and draft plans**.
Completed plans are archived to [`docs/99-lifecycle/99-archive/plans/`](../docs/99-lifecycle/99-archive/plans/).
Superseded plans are in [`docs/99-lifecycle/99-archive/superseded/`](../docs/99-lifecycle/99-archive/superseded/).

**Last verified**: 2026-07-23 (codebase cross-reference + archive move)

## Active Sprint Plans

| Sprint | Plan | Status | Description |
|--------|------|--------|-------------|
| **Sprint 4** | [Core Architecture Resolution](./sprint-4-core-architecture-resolution-implementation-plan.md) | 🚧 **IN-PROGRESS** | Phase 1 FE complete; Phase 2 BE deferred |

## BullMQ Prerequisites & Post-BullMQ Improvements

| Plan | Status | Effort | Description |
|------|--------|--------|-------------|
| [BullMQ Prerequisites](./plan-bullmq-prerequisites.md) | 📝 **DRAFT** | 5-8 giorni | Fase 1 — Redis pub/sub event bridge (RISK-2) + manual step serialization (RISK-1) |
| [Post-BullMQ Improvements](./plan-post-bullmq-improvements.md) | 📝 **DRAFT** | 10-15 giorni | Fase 2 — Developer guide, Domain Decision Modules, Zod validation, Actor Inspector |

**Documento di riferimento**: [XState-as-Aggregate Architectural Review](../docs/07-governance/xstate-as-aggregate-architectural-review.md)

## Feature & UX Plans

| Plan | Status | Description |
|------|--------|-------------|
| [workspace-dashboard-ux-restyling](./workspace-dashboard-ux-restyling-implementation-plan.md) | 🚧 **IN-PROGRESS** | Asset accordion (built, not wired) + foundation tools (done) + inline promotion (built, not wired) |
| [workspace-centric-ux-transformation](./workspace-centric-ux-transformation-implementation-plan.md) | 🚀 **ACTIVE** | Core routing/layout done; old `/tools/:key` routes still active; `/sessionsummary` redirect to fix |
| [workspace-centric-ux-transformation-ai-executable](./workspace-centric-ux-transformation-ai-executable-plan.md) | 🚀 **ACTIVE** | AI task decomposition — 47 tasks, partially executed |
| [workspace-centric-ux-transformation-refined](./workspace-centric-ux-transformation-refined-plan.md) | 📋 **APPROVED** | Consolidated routing map + strategy (prerequisito per gli altri piani workspace) |
| [feature-tool-output-personalization-1](./feature-tool-output-personalization-1.md) | 📝 **DRAFT** | Multi-variant, HITL, feedback — 0% implemented |

## Archived (Completed Plans)

I piani completati sono stati spostati in [`docs/99-lifecycle/99-archive/plans/`](../docs/99-lifecycle/99-archive/plans/):

| Plan | Completato |
|------|-----------|
| Sprint 1–3, 5–7 | 2026-07-08 / 2026-07-12 |
| asset-to-prompt-injection-wiring | 2026-07-18 |
| backend-logging-unification | 2026-07-15 |
| blog-article-generator | 2026-07-08 |
| brief-generator, tov-generator, personas-generator | 2026-07-18 / 2026-07-19 |
| promote-to-asset-deterministic-mapping | 2026-07-20 |
| model-selector-knowledge-section | 2026-07-19 |
| dashboard-workspace-centric-restyling | 2026-07-21 |
| workspace-layout-unification | 2026-07-19 |
| test-suite-optimization | 2026-07-19 |

I piani superseded (`sprint-1/2` originali) sono in [`docs/99-lifecycle/99-archive/superseded/`](../docs/99-lifecycle/99-archive/superseded/).