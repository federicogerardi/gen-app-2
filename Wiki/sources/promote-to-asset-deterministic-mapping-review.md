---
type: source-summary
tags:
  - wiki/source
  - asset
  - ux
  - deterministic-mapping
  - design-review
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/02-design/promote-to-asset-deterministic-mapping-review.md
date_ingested: 2026-07-28
source_version: 1.1
---

# Promote-to-Asset: Deterministic Mapping

Implemented design review removing the manual Asset Type select in the "Promote to Asset" dialog, replacing it with a deterministic 1:1 mapping from tool key to produced asset type.

## Decisions

| Decision | Rule |
|----------|------|
| D1 | Every tool produces at most one `[[AssetType]]` — `ToolAssetContract.produces` is 0 or 1 entry |
| D2 | Deterministic mapping: FE resolves type via `getProducedAssetTypes(toolKey)`, user only enters label |
| D3 | Hide "Promote" button when tool produces no asset |
| D4 | `toolKey === null` → button hidden, no runtime error |

## Fix Applied

`blog-article-generator` was incorrectly producing both `article-outline` and `article`. Corrected to produce only `article`. `article-outline` remains declared in `ASSET_TYPES` without a producer.

## Asset Matrix (13 types)

| Producer | Type | Consumers |
|----------|------|-----------|
| `angle-generator` | `angle` | funnel-pages, meta-ads |
| `personas-generator` | `persona` | 5 tools |
| `tov-generator` | `brand-voice` | 5 tools |
| `geometric` | `competitor-analysis` | 4 tools |
| `brief-generator` | `brief` | 6 tools |
| `meta-ads` | `ad-copy` | — |
| `blog-article-generator` | `article` | — |
| Others | script, landing-page, description, hook | — |

## Contradictions

None.

## Source

- File: `docs/02-design/promote-to-asset-deterministic-mapping-review.md`
- Version: 1.1
- Last reviewed: 2026-07-23
- Owner: frontend