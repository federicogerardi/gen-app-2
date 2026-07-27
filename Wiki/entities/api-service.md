---
type: entity
tags:
  - wiki/entity
  - generation
  - integration
date_created: 2026-07-27
last-reviewed: 2026-07-27
next-review-date: 2027-01-27
owner: Generation
source_count: 3
entity_type: entity
---

# ApiService

An administrator-managed persisted definition of an external API source that a [[Tool]] can use as input context via `WorkflowStepType = 'acquisition'`.

## Configuration

- Service identity (name, description)
- Outbound endpoint URL
- Retrieval policy
- **[[ApiServiceAccessMode]]** (canonical, DDD-102/103/130): `public`, `token`, `query-param`
- **[[tokenHeaderName]]** (canonical, DDD-104) — override header key for `token` mode (default: `Authorization: Bearer`)

## Access Modes

| Mode | Auth Pattern | Example |
|------|-------------|---------|
| `public` | No authentication | Open data APIs |
| `token` | HTTP header-based | `Authorization: Bearer <token>` |
| `query-param` | URL query parameter (DDD-130) | `?api_key=YOUR_KEY` (SerpAPI) |

`query-param` mode requires `tokenParamName` field (defaults to `'api_key'`). Extended for SERP API integration.

## Integration

Belongs to [[Generation]] context (external API invocation, credential-bearing outbound calls are backend-owned). Extends [[ToolInputSource]] without replacing typed form input or file uploads.

## Catalog

[[ApiServiceCatalog]] (provisional) mirrors [[LlmModelCatalog]] pattern. Admin CRUD via `POST/PUT/DELETE /api/admin/api-services`. Tool flows consume read-only resolved definitions.

## Sources

- [[domain-ubiquitous-language-glossary]]
- [[domain-bounded-context-map]]
- [[domain-naming-decision-log]] (DDD-102, DDD-103, DDD-104, DDD-130)