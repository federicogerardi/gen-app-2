---
type: source-summary
tags:
  - wiki/source
  - governance
  - tools
  - matrix
  - routing
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/07-governance/tool-governance-tool-matrix.md
date_ingested: 2026-07-28
source_version: 1.4
---

# Tool Governance Matrix

Canonical reference consolidating the current tool-by-tool governance view aligned with the as-is runtime registry, frontend routing, backend orchestration, and tool input-file policy.

## Tool Matrix (11 Tools)

| [[ToolKey]] | Status | Steps | File Policy |
|-------------|--------|-------|-------------|
| `funnel-pages` | enabled | 3 (optin→quiz→vsl) | Single: BriefingFile required |
| `nextland` | admin-only | 2 (landing→thank_you) | Single: BriefingFile required |
| `youtube-lf-script` | enabled | 6 steps | Single: BriefingFile required |
| `youtube-description` | all | 1 step | Direct-input only |
| `angle-generator` | enabled | 3 steps | Multi: BriefingFile required, AngleDetectorFile optional |
| `meta-ads` | enabled | 2 steps | Multi: BriefingFile required, AngleDetectorFile optional |
| `blog-article-generator` | all | 3 steps | Direct-input only, hardcoded model overrides |
| `brief-generator` | all | 1 step | Single: BriefingFile required, primitive |
| `tov-generator` | all | 1 step | Single: BriefingFile required, produces brand-voice |
| `personas-generator` | all | 1 step | Single: BriefingFile required, produces persona |
| `geometric` | admin-only | multi-query | SerpAPI crawling |

## Availability Policy

`TOOL_AVAILABILITY_POLICY_BY_TOOL_KEY` from `@gen-app-2/contracts`: `enabled-for-all`, `enabled-for-admin-only` (redirected by `ToolRouteGuard`), `disabled-for-all`. Governed by `canRoleAccessToolKey` helper.

## Contradictions

None.

## Source

- File: `docs/07-governance/tool-governance-tool-matrix.md`
- Version: 1.4
- Last reviewed: 2026-07-18
- Owner: Documentation Archivist