---
status: archived
version: 1.0
last-reviewed: 2026-04-26
next-review-date: null
owner: Backend Platform
title: XState v5 Upgrade GO Gap Plan (Archived)
date-archived: 2026-04-26
original-path: plan/upgrade-xstate-go-gap-1.md
---

# XState v5 Upgrade GO Gap Plan — Snapshot 2026-04-24

**Archived**: This planning document describes pre-publish upgrade phases. The XState v5 upgrade is now complete as evidenced by `tools-generation-go-closure-2026-04-25.md`.

**Original Goal**: Colmare il gap XState v5 dallo stato as-is allo stato completamente GO.

**Status at Archive**: Completed. All phases executed successfully with full compliance to strict v5 rules.

## Key Outcomes

- Race condition in generationSystemMachine eliminated
- All machines converted to strict v5 pattern with implementations in setup()
- Event type reading removed from action implementations; params-based typing preferred
- Unnecessary event casts minimized
- Time source determinism achieved for test reproducibility
- Comprehensive test coverage added for transitions, guards, contracts, and error cases

## Verification

- `npm run typecheck`: Zero errors
- `npm run test`: All tests passing
- `npm run test:smoke`: All smoke tests passing
- `npm run backend:go`: Green (final gate)

## Canonical Reference

For current XState architecture, see:
- `docs/02-design/specifications/xstate-system-as-is-spec.md` (as-is blueprint)
- `docs/02-design/specifications/xstate-system-as-is/` (atomized machine specs)
- `docs/07-governance/review/tools-generation-go-closure-2026-04-25.md` (GO evidence)
