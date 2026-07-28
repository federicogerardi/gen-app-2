---
type: concept
tags:
  - wiki/concept
  - frontend
  - architecture
  - registry
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: Frontend Platform Team
source_count: 1
confidence: high
---

# Registry-Driven Architecture

Frontend architectural pattern replacing duplicated per-tool page components with a declarative configuration registry. Single `[[ToolPageTemplate]]` component derives behavior from `[[ToolFormRegistry]]`, reducing ~95% code duplication.

## Core Mechanism

```
ToolFormRegistry (declarative config)
  ├── ToolKey → ToolFormConfig
  │     ├── steps: string[]
  │     ├── stepDependencies: Record<string, string[]>
  │     ├── defaultPrompt, defaultModel
  │     └── customization? (CTA labels, etc.)
  │
  └── ToolPageTemplate (generic renderer)
        ├── Form fields from config
        ├── Steps from config.steps
        ├── Progress from machine state
        └── CTAs from policy derivation
```

[pattern::Declarative configuration over imperative duplication]

## Key Components

| Component | Consumer |
|-----------|----------|
| `[[ToolPageTemplate]]` (~150 LOC) | All tool page wrappers |
| `toolFormRegistry: Record<SupportedTool, ToolFormConfig>` | Registry source |
| `getToolFormConfig(toolKey)` | Config lookup |

## Adding a New Tool

5 files, ~100 lines, ~30 min:
1. Add registry entry in `tool-form-architecture.ts`
2. Create page wrapper (~50 LOC): `<ToolPageTemplate toolKey="new-tool" />`
3. Add copy entries in `app/copy/system.ts`
4. Register route
5. Add navigation entry

## Sources

- [[frontend-tool-pages-architecture-spec]]