---
applyTo: "**"
description: "Workspace-wide DDD-first operating policy: all agents must read canonical domain references before making changes."
---

# DDD-First Workspace Operating Policy

## Objective
- Make DDD and Ubiquitous Language the primary consistency reference for all agent work in this workspace.

## Mandatory Pre-Work Gate (All Agents)
- Before editing any file, read these canonical DDD references in order:
  1. `docs/01-requirements/domain-ubiquitous-language-glossary.md`
  2. `docs/02-design/domain-bounded-context-map.md`
  3. `docs/07-governance/domain-naming-decision-log.md`
- If one or more references are missing, stop non-DDD edits and bootstrap them via the DDD agent workflow first.

## Deterministic Terminology Rules
- Reuse canonical terms exactly as defined in the glossary.
- If a new domain term is required, add a naming decision entry first, then use it in target files.
- Do not introduce parallel synonyms for an existing canonical term.

## Cross-Agent Consistency Contract
- Treat the DDD reference set as source of truth for domain language in analysis, development, testing, operations, and user docs.
- When conflicts are found, resolve them in the DDD reference set first, then propagate changes.