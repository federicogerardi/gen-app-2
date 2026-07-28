---
type: source-summary
tags:
  - wiki/source
  - implementation-plan
  - bullmq
  - tool-workflow-job
  - refactoring
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/05-plans/feature-tool-workflow-job-system-fase-1.md
date_ingested: 2026-07-28
source_version: "2.2"
---

# ToolWorkflowJob System — Fase 1 (MVP) Implementation Plan

Dettagliato piano di implementazione per la Fase 1 del sistema [[ToolWorkflowJob]]. Status: **implemented** (2026-07-24). Stima: 10 giorni, 22 file.

## File Inventory

**10 nuovi file BE**: `tool-workflow-job-processor.ts` (loop con routing WorkflowStepType), `tool-workflow-job-queue.ts` (BullMQ setup), `tools-job-handlers.ts` (submit/status/cancel), `tools-job-stream-handler.ts` (SSE), `worker-entry.ts` (standalone), 5 file FE (controller submit, hook SSE, 3 componenti UI).

**7 file modificati**: `server.ts`, `tools-routes.ts`, `tool-page.machine.ts`, `tool-page.types.ts`, `useToolPage.ts`, `ToolPageTemplate.tsx`, `backend-capabilities.ts`, `packages/contracts/src/index.ts`.

**5 file non toccati**: `generation-system.execution.states.ts`, `toolWorkflowMachine`, tutti i prompt file, `tools-orchestrate-handlers.ts`, `useToolPageRunController.ts`.

## Architecture

Nuovo flusso: FE invia singolo `POST /api/tools/jobs` → BE accoda su BullMQ → worker processa step in loop → FE consuma SSE passivamente.

Feature flag `BackendCapabilities.toolsJobSystem` per attivazione graduale per-tool. Worker in-process di default (`TOOL_WORKFLOW_WORKER_IN_PROCESS=true`).

## Task Breakdown

| Phase | Task | Stima |
|-------|------|-------|
| 0 — Contracts | `SubmitJobRequest`/`JobStatusResponse`/`JobProgressEvent` in contracts, feature flag | 0.5d |
| 1 — Backend Core | Queue setup, processor (350 LOC), HTTP handlers (submit/status/cancel), SSE handler, worker entry, server.ts, routes | 3.5d |
| 2 — Frontend Core | Machine types/transitions, SSE hook, submit controller, `useToolPage` branching | 3d |
| 3 — Frontend UI | Step tracker, JobPanel, Admin page/toolbar, copy namespace, SWR stub, template swap | 2d |
| 4 — Testing | 10 test tasks (4 BE nuovi, 6 FE) | 3d |

## Acceptance Criteria

15 criteri verificati coprendo: submit, multi-step esecuzione, status polling, SSE stream, retry automatico, idempotency, backward compat, feature flag, cancellazione, per-step idempotency, single-flight guard, routing WorkflowStepType, regression gate.

## Contradictions

None.

## Source

- File: `docs/05-plans/feature-tool-workflow-job-system-fase-1.md`
- Version: 2.2
- Status: implemented (2026-07-24)
- Owner: Backend Runtime + Frontend Tools