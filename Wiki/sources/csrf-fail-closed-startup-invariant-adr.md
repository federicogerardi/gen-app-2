---
type: source-summary
tags:
  - wiki/source
  - security
  - csrf
  - adr
  - backend
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/02-design/adr/csrf-fail-closed-startup-invariant-adr.md
date_ingested: 2026-07-28
source_version: 1.0
---

# ADR: CSRF Fail-Closed Startup Invariant

Security ADR fixing a critical fail-open path in the Node runtime request handler where CSRF validation was silently skipped when trusted origins were empty.

## Problem

`createNodeRuntimeRequestHandler` in `node-server.ts` had a fail-open path: when `csrfEnabled = true` but resolved trusted origins are empty, the condition `csrfTrustedOrigins.length > 0` silently bypasses CSRF validation for every mutating request. No error thrown, no log emitted.

## Decision (Option C)

Fail-fast at factory initialization:
1. `csrfEnabled && origins empty` → throw `Invalid CSRF configuration: trustedOrigins must be non-empty`
2. `csrfEnabled && origins contain '*'` → throw `Invalid CSRF configuration: trustedOrigins cannot include "*"`

Per-request `length > 0` guard removed. Single resolution path: `resolveCsrfTrustedOrigins(options)` consolidates origin resolution from `csrf.trustedOrigins → cors.allowedOrigins → []`.

## Rollout Gate

Before deploying with `CSRF_ENABLED=true`: confirm `CSRF_TRUSTED_ORIGINS`, `CORS_ALLOWED_ORIGINS`, or `FRONTEND_ORIGIN` is set and non-empty; no wildcard `*`; validate startup succeeds.

## Contradictions

None.

## Source

- File: `docs/02-design/adr/csrf-fail-closed-startup-invariant-adr.md`
- Version: 1.0
- Last reviewed: 2026-07-23
- Owner: Backend Architecture