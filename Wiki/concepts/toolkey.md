---
type: concept
created: 2026-07-27
updated: 2026-07-27
sources: ["[[sources/tool-domain-concept_435988]]"]
tags: [term]
aliases:
  - "SupportedTool"
  - "toolKey"
  - "ToolKey"
generation_complete: true
---


# ToolKey

## Definition
ToolKey is the cross-context canonical identifier used to uniquely represent a [[concepts/tool|Tool]] across different software context layers. It ensures consistent identification of tool capabilities across frontend user interfaces and backend request processing pipelines.

## Key Characteristics
- **Contextual Variants**: Manifests as `SupportedTool` in Frontend/UI using kebab-case string representations, and as the `toolKey` field within backend schemas such as `GenerationRequest`.
- **Known Canonical Values**: Includes identifiers such as `funnel-pages`, `nextland`, `youtube-lf-script`, `angle-generator`, `youtube-description`, `geometric`, `blog-article-generator`, `brief-generator`, `tov-generator`, and `personas-generator`.
- **Distinct from Routing Paths**: Unlike broader `ToolWorkflow` enumeration values which may represent routing or extraction processes (e.g., `extraction`), a ToolKey specifically identifies a executable tool chain rather than a generic routing path.

## Applications
- **Cross-Layer Request Mapping**: Used in `GenerationRequest` objects to route execution requests from frontend UI actions to corresponding backend tool logic.
- **Frontend State Management**: Serves as the primary key (`SupportedTool`) for rendering UI components, configurations, and input controls tied to specific tools.

## Related Concepts
- [[concepts/tool|Tool]]

## Related Entities
None

## Mentions in Source

- "ToolKey is the cross-context canonical identifier (DDD-029), expressed as: SupportedTool in Frontend/UI (kebab-case), toolKey field in GenerationRequest (Generation)" — [[Wiki/concepts/tool-domain-concept|tool-domain-concept]]
- "Values: funnel-pages, nextland, youtube-lf-script, angle-generator, youtube-description, geometric, blog-article-generator, brief-generator, tov-generator, personas-generator" — [[Wiki/concepts/tool-domain-concept|tool-domain-concept]]