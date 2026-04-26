---
status: archived
version: 1.0
last-reviewed: 2026-04-26
next-review-date: null
owner: Backend Platform
title: Backend Auth Surface Review (Archived)
date-archived: 2026-04-26
original-path: docs/07-governance/code-review/2026-04-25-backend-auth-review.md
---

# Code Review: Backend Auth Surface — Snapshot 2026-04-25

**Archived**: This pre-publish code review identified a critical security issue that has been resolved. The backend is now in GO state as evidenced by `tools-generation-go-closure-2026-04-25.md`.

**Original Status**: Ready for Production: No | Critical Issues: 1

## Critical Issue (RESOLVED)

**Issue**: The generation endpoint was reachable without backend authentication.

**Original Finding**: In `src/lib/runtime/node-server.ts`, the request was passed to the auth runtime first, but if the auth runtime did not handle the path, the server accepted POST requests on the generation route without requiring a session principal.

**Resolution**: Backend authentication now required on generation route. User identity derived from authenticated principal instead of trusting userId from request body.

## Observed Protection Model (Current)

- Public auth bootstrap routes: `/auth/login`, `/auth/google/start`, `/auth/google/callback` (expected to be public)
- Session-backed user routes: `/api/projects*`, `/api/artifacts*`, `/generation/stream` (require valid session)
- Admin-only routes: Require both active session and admin role
- CORS and CSRF: Enabled and enforced

## Recommended Changes (IMPLEMENTED)

✅ Require a valid session principal before accepting the generation route
✅ Derive user identity from the authenticated principal
✅ Keep login and OAuth bootstrap public
✅ Treat all business APIs as authenticated-by-backend

## Canonical Reference

For current backend auth state, see:
- `docs/02-design/specifications/xstate-system-as-is-spec.md` (as-is blueprint)
- `docs/07-governance/review/tools-generation-go-closure-2026-04-25.md` (GO evidence)
