---
type: concept
tags:
  - wiki/concept
  - ddd
  - cross-context
date_created: 2026-07-27
last-reviewed: 2026-07-27
next-review-date: 2027-01-27
owner: Domain Architecture
source_count: 3
confidence: high
---

# Tool (domain concept)

The organizing concept of the entire application. A [[Tool]] encapsulates a complete user-facing capability: structured input intake, an ordered [[WorkflowStep]] chain, progressive context enrichment across steps, and final [[Artifact]] production.

Each Tool addresses one specific user problem. Steps within a Tool may be reused across different Tools. The system's purpose is to compose a suite of Tools that collectively support team members' core work.

## Identity

[canonicalIdentifier::[[ToolKey]]]

[[ToolKey]] is the cross-context canonical identifier (DDD-029), expressed as:
- `SupportedTool` in Frontend/UI (kebab-case)
- `toolKey` field in `GenerationRequest` (Generation)
- Values: `funnel-pages`, `nextland`, `youtube-lf-script`, `angle-generator`, `youtube-description`, `geometric`, `blog-article-generator`, `brief-generator`, `tov-generator`, `personas-generator`
- Approved reactivation: `meta-ads` with `ToolWorkflow = meta_ads_generator` (DDD-094)

Not every `ToolWorkflow` value is a Tool — `extraction` is a direct routing path, not a Tool chain.

## Current Active Tools

| ToolKey | Complexity | Step Types Used |
|---------|------------|-----------------|
| `funnel-pages` | Multi-step | `extraction`, `generation` |
| `nextland` | Multi-step | `extraction`, `generation` |
| `youtube-lf-script` | Multi-step (6 steps) | `extraction`, `generation` |
| `angle-generator` | Multi-step | `extraction`, `generation` |
| `youtube-description` | Single-step | `generation` (direct-input only) |
| `geometric` | Multi-step | `crawling`, `scoring`, `generation` |
| `blog-article-generator` | Multi-step | `generation` |
| `brief-generator` | Single-step | `generation` (→ `'brief'` Asset) |
| `tov-generator` | Single-step | `generation` (→ `'brand-voice'` Asset) |
| `personas-generator` | Single-step | `generation` (→ `'persona'` Asset) |

## Input Sources

Tools consume input from multiple [[ToolInputSource]] families: `direct-input` (form fields), `tool-input-file` (uploaded files), `api-acquisition` (external APIs via [[ApiService]]), `project-asset` ([[Asset]] entities).

## Governance

New Tool identities require DDD decision-log entries (e.g., DDD-155 for `blog-article-generator`, DDD-210 for `brief-generator`).

## Sources

- [[domain-ubiquitous-language-glossary]]
- [[domain-bounded-context-map]]
- [[domain-naming-decision-log]] (DDD-026, DDD-029, DDD-040, DDD-077, DDD-094, DDD-095)