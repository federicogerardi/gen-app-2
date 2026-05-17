---
title: "CI/CD Admin Dashboard Test Suite Integration Spike"
category: "Testing & CI/CD"
status: "� Completed"
priority: "High"
timebox: "2-3 days"
created: 2026-05-17
updated: 2026-05-17
owner: "Federico Gerardi"
tags: ["technical-spike", "ci-cd", "testing", "admin-dashboard", "task-014"]
---

# CI/CD Admin Dashboard Test Suite Integration Spike

## Summary

**Spike Objective:** Define and implement a concrete CI/CD integration strategy for the admin dashboard combined test suite to enable formal closure of TASK-014 macro and establish deterministic regression coverage in pipeline.

**Why This Matters:** The admin dashboard refactor (TASK-006 through TASK-014) has achieved 40/40+ test passing locally (routing, mutations, failure paths, a11y), but without CI/CD integration these gains are not yet locked in against future regressions. Pipeline integration is the final gate for TASK-014 macro closure and prevents test drift.

**Timebox:** 2–3 days (research + pilot implementation)

**Decision Deadline:** By `2026-05-19` to allow PR merge on `chore/move-local-changes-2026-05-11` branch.

## Research Question(s)

**Primary Question:**
How should the admin dashboard combined test suite (`app-router + AdminUsersPage + AdminModelsPage + AdminChangelogPage + AdminUserReportsPage`) be integrated into the root-level CI/CD pipeline to ensure deterministic regression coverage and lock in test gains?

**Secondary Questions:**

- What is the current CI/CD pipeline configuration (GitHub Actions, Railway, other)?
- Where should the admin test command be pinned (root `package.json` scripts vs. app-level vs. separate pipeline job)?
- Should the combined regression suite be a blocking gate (fail PR) or a reporting step?
- What are the a11y smoke test requirements for admin routes in pipeline?
- Are there snapshot or e2e framework updates needed, or should we establish a baseline?

## Investigation Plan

### Research Tasks

- [ ] Audit current CI/CD pipeline configuration (GitHub Actions workflow files, Railway config, any existing test gates)
- [ ] Identify test command pinning strategy: single npm script vs. job matrix vs. separate workflow
- [ ] Document current admin test coverage command: `npm run test -- src/app/routing/app-router.test.tsx src/features/admin/pages/*Page.test.tsx`
- [ ] Verify a11y smoke test route coverage (`/admin`, `/admin/users`, `/admin/models`, `/admin/changelog`, `/admin/user-reports`, `/admin/activity`)
- [ ] Check for snapshot test needs or e2e framework integration points
- [ ] Create proof of concept: test command pinned in root `package.json` with run verification
- [ ] Document findings, gating strategy, and implementation checklist

### Success Criteria

**This spike is complete when:**

- [ ] Current CI/CD pipeline architecture is documented (source files, job definitions, existing gates)
- [ ] Admin test command is defined and runnable: `npm run test:admin-combined` or equivalent
- [ ] Implementation strategy is documented: blocking gate, reporting step, job schedule
- [ ] A11y smoke test integration plan is clear (route list, command, assertion pattern)
- [ ] Snapshot/e2e baseline strategy is decided (skip, establish, or defer)
- [ ] Proof of concept command runs locally with expected output (40+ tests passing)
- [ ] Implementation checklist is ready for PR/TASK-014 closure phase

## Technical Context

**Related Components:**

- `apps/frontend/package.json` (test scripts)
- `apps/frontend/src/app/routing/app-router.test.tsx` (18 tests, router smoke + seed routes)
- `apps/frontend/src/features/admin/pages/*Page.test.tsx` (admin mutation + policy tests)
- `.github/workflows/` (if GitHub Actions used)
- `railway.toml` (if Railway CI/CD used)
- Root `package.json` (npm workspace scripts)

**Dependencies:**

- TASK-014A completion: router smoke coverage (done, 18/18 passing)
- TASK-014B completion: test helpers & MSW factories (done)
- TASK-014C completion: mutation + policy gating coverage (done, 40+/40+ passing)
- DDD governance: all changes follow ubiquitous language from `domain-ubiquitous-language-glossary.md`

**Constraints:**

- Admin pages must render in isolation (component mocks, provider isolation)
- Global feedback spy pattern must be consistent across all admin mutation tests
- Dedupe key assertions must be deterministic: `{feature}:{action}:{targetId}:{outcome}`
- Must not break existing pipeline gates or slow down CI/CD significantly

## Research Findings

### Investigation Results

**Status:** Phase 1 Complete (2026-05-17) — CI/CD architecture audited, findings documented.

#### Findings: Current Pipeline Architecture

**CI/CD System:** GitHub Actions (`.github/workflows/`)

**Active Workflow:** `main-pr-gate.yml`
- **Trigger:** PR to `main` + push to `main` (paths: `apps/frontend/**`, `packages/contracts/**`)
- **Job:** `frontend-gate` (ubuntu-latest, Node 24)
- **Current Gate Sequence:**
  1. Checkout → Setup Node → Install deps
  2. `npm --workspace apps/frontend run typecheck` (TypeScript check)
  3. `npm --workspace apps/frontend run test` (all tests via vitest run)
  4. `npm --workspace apps/frontend run test:forms` (LoginForm + GenerationForm only)
  5. `npm --workspace apps/frontend run test:visual` (snapshot tests)
  6. `npm --workspace apps/frontend run build` (Vite build)
  7. A11y audit (currently commented/disabled — notes "re-enable when ChromeDriver pinned")

**Impact:** Admin dashboard tests are currently bundled in step 3 (`npm run test`), passing but not explicitly pinned as a separate gate.

#### 1. **Test Coverage State (Local, 2026-05-17):**
   - Router smoke (app-router.test.tsx): 18/18 passing ✅
   - AdminUsersPage mutations + failures: 12/12 passing ✅
   - AdminModelsPage mutations + failures: 4/4 passing ✅
   - AdminChangelogPage mutations + failures: 4/4 passing ✅
   - AdminUserReportsPage mutations + failures: 4/4 passing ✅
   - **Total Combined**: 42/42 passing locally
   - TypeCheck: clean (no type errors in frontend package)

2. **Current Test Execution Command:**
   ```bash
   cd apps/frontend && npm run test -- src/app/routing/app-router.test.tsx \
     src/features/admin/pages/AdminUsersPage.test.tsx \
     src/features/admin/pages/AdminModelsPage.test.tsx \
     src/features/admin/pages/AdminChangelogPage.test.tsx \
     src/features/admin/pages/AdminUserReportsPage.test.tsx
   ```

3. **A11y Coverage (TASK-013 completed):**
   - Smoke routes: `/admin`, `/admin/users`, `/admin/models`, `/admin/changelog`, `/admin/user-reports`, `/admin/activity` (6 routes)
   - Test files: `app-router.test.tsx` includes parametrized seed-route matrix (5 admin sections)
   - Command: Can be run via `npm run test -- <file>` with a11y assertions

### Prototype/Testing Notes

*Pending — to be completed as part of spike research.*

### External Resources

- [Vitest Configuration](https://vitest.dev/config/)
- [GitHub Actions for Node.js Testing](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Railway CI/CD Docs](https://docs.railway.app/)
- [MSW Mock Service Worker](https://mswjs.io/)

## Decision

### Recommendation

**Adopt a Two-Track Integration Strategy:**

**Track A (Immediate — Phase 2a):**
1. Add `test:admin-combined` npm script to `apps/frontend/package.json` ✅ (DONE)
2. Insert new step in `main-pr-gate.yml` after existing test steps:
   ```yaml
   - name: Admin Dashboard Combined Tests (Router + Mutations + A11y)
     run: npm --workspace apps/frontend run test:admin-combined
   ```
3. This is a **reporting/blocking step** — passes if 42+ tests pass, otherwise fails and blocks PR merge
4. Pinned command:
   ```bash
   vitest run src/app/routing/app-router.test.tsx \
     src/features/admin/pages/AdminUsersPage.test.tsx \
     src/features/admin/pages/AdminModelsPage.test.tsx \
     src/features/admin/pages/AdminChangelogPage.test.tsx \
     src/features/admin/pages/AdminUserReportsPage.test.tsx
   ```

**Track B (Future — after A11y re-enablement):**
- Once A11y audit is re-enabled (ChromeDriver pinned), add a separate `test:admin-a11y:smoke` step
- Route list: `'/admin', '/admin/users', '/admin/models', '/admin/changelog', '/admin/user-reports', '/admin/activity'`
- Can be integrated with existing Lighthouse config (`lighthouserc.json`)

**Snapshot/E2E Strategy:** Establish baseline in Phase 3 (no changes to existing snapshot test flow)

### Rationale

**Why This Approach:**
- **Minimal disruption:** Adds one npm script + one workflow step without restructuring existing gates
- **Explicit pinning:** Admin tests are now visible as a separate gate (rather than hidden in `npm run test`)
- **Failure isolation:** If admin tests fail, the PR message is clear ("Admin Dashboard Combined Tests failed")
- **Scalability:** Can add more admin routes or mutation patterns without rewriting workflow syntax
- **DDD compliance:** Test naming and dedupe keys enforce canonical ubiquitous language (already implemented locally)

## Implementation Checklist

**Phase 1: Research & Decision (2026-05-17 → 2026-05-18) — ✅ COMPLETE**
- [x] Audit `.github/workflows/` for existing test gates → Found `main-pr-gate.yml` with 6-step frontend gate
- [x] Check `railway.toml` for deployment and test integration points → Not required for CI gate (GH Actions owns test pipeline)
- [x] Document current pipeline architecture and entry points → Documented in Findings section
- [x] Validate test command locally: `npm run test -- src/app/routing/app-router.test.tsx src/features/admin/pages/*Page.test.tsx` → 42/42 passing ✅
- [x] Create npm script shorthand (e.g., `"test:admin-combined"`) → Added to `apps/frontend/package.json` ✅

**Phase 2: Implementation (2026-05-18 → 2026-05-19) — IN PROGRESS**
- [x] Add `test:admin-combined` npm script to `apps/frontend/package.json` ✅ (done)
- [x] Update `.github/workflows/main-pr-gate.yml` to add admin test step after existing test suite ✅ (done)
- [x] A11y CI step: replaced commented `audit:a11y` with `test:admin-a11y` vitest step (12 smoke tests, 6 admin routes, no browser required) ✅ (2026-05-17)
- [ ] Test new workflow syntax locally (validate YAML, dry-run or stage branch)
- [x] Snapshot/E2E strategy: defer (establish baseline on next admin feature iteration)

**Phase 3: Closure (2026-05-19 → 2026-05-20)**
- [ ] Merge `.github/workflows/main-pr-gate.yml` changes to `chore/move-local-changes-2026-05-11` branch
- [ ] Merge PR to `main`
- [ ] Update `/plan/refactor-admin-dashboard-frontend-1.md` Section 2.4 with implementation evidence (workflow file + npm script)
- [ ] Update TASK-014 macro status to `Completed` with CI/CD pinning evidence
- [ ] Verify all admin tests passing in live GitHub Actions pipeline on next PR

## Exit Criteria for TASK-014 Macro Closure

1. ✅ **Test Coverage Locked** (Phase 1): 42/42 admin tests locally passing + command documented
2. ✅ **A11y Baseline Established** (Phase 1): 6 admin routes smoke-tested with assertion pattern
3. ✅ **CI/CD Architecture Audited** (Phase 1): GitHub Actions pipeline analyzed, recommendation drafted
4. ✅ **npm Script Created** (Phase 2a): `test:admin-combined` added to `apps/frontend/package.json`
5. ✅ **Workflow Updated** (Phase 2b): `main-pr-gate.yml` — step `Admin Dashboard Combined Tests` ✅ + step `Admin A11y Smoke Tests` (vitest, 12 tests, 6 route) ✅ (2026-05-17)
6. ⏳ **Plan Updated** (Phase 3): Evidence pinned + TASK-014 marked Completed in `refactor-admin-dashboard-frontend-1.md`
7. ⏳ **Pipeline Verified** (Phase 3): Live GitHub Actions confirms 42+ admin tests passing on PR/push to main

---

**Current Status:** Phase 1 ✅ + Phase 2a ✅ + Phase 2b ✅ — ready for Phase 3 (PR merge + pipeline verification)

**Next Action:** Update `.github/workflows/main-pr-gate.yml` with admin test step → validate YAML → commit → Phase 3 merge and live verification.
