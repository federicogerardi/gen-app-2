---
applyTo: "**"
description: "Workspace-wide DDD-first operating policy: all agents must read canonical domain references before making changes to ANY file — code, tests, configs, or docs."
---

# DDD-First Workspace Operating Policy

## Lessons Learned: DDD-First Enforcement (2026-05-19)

To prevent future code drift and costly refactoring, every phase of code writing in this workspace is subject to these mandatory DDD-first rules:

1. **Define canonical terms first**
  - Every new concept, type, parameter, or field must be registered in the DDD glossary and decision log before use in code.
  - If a term is missing, block code writing and create the DDD entry first.

2. **Use only canonical terms in code**
  - No synonyms, abbreviations, or local variants: always reuse the exact glossary term.
  - If a new nuance is needed, open a DDD-NNN decision and document the rationale.

3. **Update documentation with code**
  - Every change to types, parameters, or contracts must be accompanied by a patch to DDD docs (glossary, BCM, decision log).
  - No PR/merge without updated documentation.

4. **Verify consistency with automated scans**
  - Regularly run grep/scan to detect drift between code and docs.
  - Integrate these checks into CI/CD workflows.

5. **Make cross-context translations explicit**
  - Any naming divergence between FE/BE/DB must be deliberate, documented, and centralized (e.g., toolKey/workflowType mapping).
  - Never leave implicit or "temporary" divergences.

6. **Enforce DDD-first at team and review level**
  - All contributors must know and apply the DDD-first policy: no shortcuts, no "fix later".
  - Reviews must block merges that do not comply with DDD governance.

**Summary:**
Treat DDD documentation as mandatory source code and the single source of truth. This is the only way to prevent drift and avoid future refactoring for DDD alignment.

## Objective
- Make DDD and Ubiquitous Language the **primary and mandatory** consistency reference for all agent work in this workspace.
- This policy applies equally to source code (`src/`, `frontend/src/`), tests, configuration, and documentation.

## Mandatory Pre-Work Gate (All Agents — All File Types)
- Before editing **any** file — TypeScript, React, config, migration, or markdown — read these canonical DDD references in order:
  0. `docs/07-governance/documentation-ddd-ul-governance.md` — primary governance reference for documentation production/modification under `docs/`
  1. `docs/01-requirements/domain-ubiquitous-language-glossary.md` — 39 canonical terms across 4 bounded contexts
  2. `docs/02-design/domain-bounded-context-map.md` — bounded context responsibilities and cross-context translation rules
  3. `docs/07-governance/domain-naming-decision-log.md` — 17 approved naming decisions, deprecated terms, backward-compat aliases
- If one or more references are missing, stop non-DDD edits and bootstrap them via the DDD agent workflow first.

## Mandatory GUI Governance Gate (Frontend/UI Interventions)
- This gate is mandatory whenever the intervention touches GUI code or GUI documentation, including files under `apps/frontend/src/**`, `frontend/src/**`, and UI docs under `docs/02-design/specifications/**`.
- Before proposing or applying GUI changes, read and apply:
  - `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
- Enforce these constraints during GUI work:
  1. Classify each touched screen into one canonical archetype: `Tool Workspace Page` or `Data Table View`.
  2. Reuse canonical UI terms from the spec in analysis, PR notes, and updated docs.
  3. If the screen is tabular, align behavior and composition with the `Data Table View` + canonical table standard.
  4. If the screen diverges from the canonical archetype, treat it as drift and document convergence in the same change.
  5. Avoid nested cards by default. Use nested cards only when strictly necessary for semantic grouping that cannot be expressed with spacing, dividers, or typography. Card nesting increases cognitive load and visually weights layouts.

## Dependency And Lockfile Determinism Gate (Deploy Safety)
- This gate is mandatory whenever dependency manifests are changed, including any edit under:
  - `package.json`
  - `package-lock.json`
  - `apps/*/package.json`
  - `apps/*/package-lock.json`
  - `packages/*/package.json`
- Never hand-edit lockfiles. Regenerate lockfiles only through npm commands.
- If dependencies change in any workspace package, update lockfiles in the same change so `npm ci` remains deterministic in CI/CD.

### Required Command Sequence After Dependency Changes
Run these commands from workspace root and ensure all succeed before considering the task complete:
1. `npm install --workspaces --include-workspace-root`
2. `npm ci`
3. `npm ci --workspaces --include-workspace-root`
4. `npm --workspace apps/frontend run build`

### Additional Rules For This Repository
- Keep both lockfiles in sync when dependency graphs change:
  - root lockfile: `package-lock.json`
  - frontend lockfile: `apps/frontend/package-lock.json`
- Validate the exact install strategy used by Dockerfiles:
  - frontend image path must pass `npm ci` from root before frontend build
  - root image path must pass `npm ci --workspaces --include-workspace-root`
- If `npm ci` reports "package.json and package-lock.json are not in sync", stop and regenerate lockfiles via `npm install` (never patch lockfiles manually).

## Terminal Output Capture Determinism Gate (Execution Safety)
- This gate is mandatory whenever agents run terminal commands whose output is used for analysis, verification, or reporting.
- Prefer deterministic output capture via file redirection instead of relying on direct terminal scraping.
- Canonical pattern: run command with stdout/stderr redirected to a workspace log file, then read the log file as the source of truth.
- For application test runs, file-redirection capture is required and must be followed rigorously to prevent repeated output-acquisition error chains.
- Keep logs isolated per command/run and avoid mixing outputs from multiple executions in one file unless explicitly intended.

## Code Analysis Gate
- Before analyzing TypeScript/React code, identify which bounded context owns the file being analyzed.
- Map every domain concept in the file to a canonical term in the glossary before proposing changes.
- If a type, interface, or variable name does not match a canonical term, flag it as a DDD drift candidate.
- Do not suggest renaming without first verifying the canonical term in the decision log.

## Code Intervention Rules
- When adding or renaming a type, interface, function, or variable that represents a domain concept:
  1. Verify the canonical term in `domain-ubiquitous-language-glossary.md`.
  2. If no canonical term exists, create a `DDD-NNN` entry in `domain-naming-decision-log.md` first.
  3. Apply the canonical term in the code change.
  4. Add a backward-compat alias if the old name is referenced by other code (deprecated, 1 cycle).
- When adding or changing user-facing text in code, prefer one centralized copy authority for the owning surface instead of introducing local hardcoded literals in components, hooks, machines, or utilities.
- Do not make runtime control flow depend on exact user-visible text values. Use typed flags, canonical codes, or explicit state branches instead of comparing rendered strings.
- Prefer the smallest coherent change that solves one concern at a time; avoid monolithic implementations that bundle unrelated behavior into one block.
- Prefer unifying duplicate or overlapping logic into a single authoritative path when the concepts are the same.
- Prefer atomized helpers, modules, and components over large all-in-one structures when the split improves clarity and reuse.
- Prefer scalable structure over local convenience: extract reusable helpers, copy maps, selectors, and small presentational components before duplicating behavior or text across files.
- Reuse existing libraries, adapters, utilities, and workspace patterns before introducing a new dependency or custom implementation.
- When editing files with `apply_patch`, prefer atomic hunks that touch one concern at a time; avoid monolithic replacement blocks that increase fail-match risk.
- Never introduce synonyms for existing canonical terms (e.g., do not use `BriefingContext` where `ExtractionContext` is canonical).
- Deprecated aliases (prefixed with `ToolPage*`, `Tool*`, `Stream*`) must not be promoted to primary definitions.

## Deterministic Terminology Rules
- Reuse canonical terms exactly as defined in the glossary.
- If a new domain term is required, add a naming decision entry first, then use it in target files.
- Do not introduce parallel synonyms for an existing canonical term.

## Cross-Agent Consistency Contract
- Treat the DDD reference set as source of truth for domain language in analysis, development, testing, operations, and user docs.
- When conflicts are found, resolve them in the DDD reference set first, then propagate changes.