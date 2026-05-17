---
description: "Use when executing, refining, or reviewing the Railway private-network same-origin plan. Enforce deterministic implementation tasks, explicit acceptance gates, and no-ambiguity rollout/rollback steps across plan, frontend proxy, and deployment docs."
applyTo:
  - "plan/architecture-railway-private-network-same-origin-1.md"
  - "docs/02-design/specifications/deployment-architecture-guide.md"
  - "frontend/server.mjs"
  - "frontend/railway.toml"
  - "frontend/Dockerfile"
  - "frontend/README.md"
  - "frontend/.env.example"
  - "src/server.ts"
---

# Railway Private-Network Execution Determinism

## Objective
- Turn plan tasks into deterministic execution steps with one expected outcome.
- Remove implementation ambiguity before coding or deployment.

## Deterministic Task Contract
- Every execution task must define all of the following:
  - exact target file(s)
  - exact runtime/environment variable names and expected values
  - exact HTTP method/path pairs involved
  - explicit success criteria and explicit fail/stop criteria
  - rollback action for the same scope
- If any item above is missing, add it before implementation.
- Prefer the smallest deterministic task slice, split broad implementation work into atomic steps, and reuse existing repository patterns or dependencies before adding new ones.
- When using `apply_patch`, keep each task-scoped edit atomic and narrowly targeted; avoid monolithic replacements that make deterministic implementation harder to validate.

## Plan-To-Code Mapping Rule
- For each task that changes runtime behavior, include at least one concrete code anchor:
  - file path and symbol/block to modify
  - routing order or matching rule when request handling is involved
- For proxy behavior, always specify both directions:
  - request forwarding contract
  - response forwarding contract (including Set-Cookie/Location handling)

## Anti-Ambiguity Rules For Proxy Changes
- Route matching must state the strategy explicitly (for example, prefix match) and evaluation order.
- Specify method handling for proxied routes and non-proxied routes separately.
- Streaming tasks must define connection lifecycle behavior (open, flush, disconnect, cleanup).
- Header handling must state:
  - required forwarded headers
  - required blocked headers (hop-by-hop)

## Environment Determinism
- Separate frontend server runtime env from backend env; do not mix them in the same example file.
- For required env vars in production, enforce fail-fast startup behavior.
- For every env change, record:
  - local default
  - production value source
  - validation command/check

## External Dependency Gates
- Any dependency outside the repository (Railway console, Google Cloud OAuth settings) must be a blocking task with:
  - exact console location
  - expected configured value
  - failure symptom if omitted

## Testing Determinism
- Add at least one local pre-deploy test and one deployed smoke test for each behavior class:
  - auth/session cookies
  - proxy routing correctness
  - SSE streaming continuity
  - OAuth callback completion
- Tests must include command examples and expected observable result (status code, header, or user-visible behavior).

## Review Gate
- A review is complete only if findings include:
  - severity
  - concrete impacted file
  - concrete breakage mode
  - minimal correction proposal
- If no findings are present, explicitly state residual risk and test gaps.
