---
status: approved
version: 1.0
last-reviewed: 2026-05-21
next-review-date: 2026-08-21
owner: Backend Architecture
---

# Orchestrate Scalability Benchmark 2026-05-21

## Scope
- Benchmark target: `POST /api/tools/orchestrate` path after Phase 1-3 remediation.
- Canonical domain scope: `ToolStepOrchestration` in Generation context.
- Execution mode: local deterministic benchmark harness with concurrent request load.

## Command

```bash
npm --workspace apps/backend run bench:orchestrate
```

Benchmark harness source:
- `apps/backend/src/lib/tests/runtime.tools-orchestrate.benchmark.ts`

## Method
- Dataset sizes: `1000`, `5000`, `10000` artifacts.
- Request profile per scenario: `120` orchestrate calls, `12` concurrent workers.
- Target request payload: `toolKey=funnel-pages`, `targetStep=vsl`.
- Timeout budget during benchmark run: `toolsOrchestrateTimeoutMs=6500`.
- Bounded scan setting during benchmark run: `toolsOrchestrateArtifactScanLimit=<datasetSize>`.
- Captured metrics: `p50`, `p95`, `p99`, `min`, `max`, `avg`, `memoryDeltaMb`, `timeoutCount`, `errorCount`.

## Results

| Dataset | Requests | Concurrency | p50 ms | p95 ms | p99 ms | memoryDeltaMb | timeoutCount | errorCount |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1000 | 120 | 12 | 14.20 | 16.88 | 17.04 | 5.33 | 0 | 0 |
| 5000 | 120 | 12 | 43.19 | 57.15 | 57.23 | 18.98 | 0 | 0 |
| 10000 | 120 | 12 | 105.07 | 114.47 | 114.52 | 13.83 | 0 | 0 |

## Acceptance Outcome
- Pass: `timeoutCount = 0` on all scenarios.
- Pass: `errorCount = 0` on all scenarios.
- Pass: p99 remains well below configured 6500 ms timeout budget for all scenarios.
- Observation: memory delta is non-monotonic (`5000` peak higher than `10000`), consistent with GC/runtime effects under local synthetic workload.

## Reproducibility Notes
- Run from repository root with unchanged benchmark script and backend dependencies.
- Metrics are environment-sensitive and must be interpreted as local comparative evidence, not production SLA.
- For release gating, repeat benchmark in CI/staging with fixed machine profile and artifact snapshots.
