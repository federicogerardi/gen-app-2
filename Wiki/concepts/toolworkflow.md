---
type: concept
created: 2026-07-27
updated: 2026-07-27
sources: ["[[sources/tool-domain-concept_435988]]"]
tags: [term]
aliases:
  - "ToolWorkflow"
  - "Tool Workflow"
generation_complete: true
---


# ToolWorkflow

## Definition
**ToolWorkflow** is a system concept that represents the set of workflow values associated with Tools within the system's architecture. It functions as a broad category encompassing complete multi-step Tool chains as well as direct, straightforward processing paths and routing instructions.

## Key Characteristics
- **Broader than Tool Chains**: Encompasses full Tool identities as well as simpler routing instructions (such as 'extraction'), demonstrating that not all workflow values correspond to full Tool chains.
- **Mapping to Identifiers**: Closely associated with the [[entities/toolkey|ToolKey]] identifier; while every Tool possesses a corresponding ToolWorkflow value, the mapping between them is not strictly one-to-one.
- **Architectural Differentiation**: Plays a key role in distinguishing complex, multi-step tool capabilities from direct, single-purpose processing paths.

## Applications
- **System Routing**: Used by the platform architecture to direct tasks along appropriate processing paths based on whether they require full tool chain execution or direct routing logic.
- **Tool Lifecycle & Configuration**: Referenced in architectural decision records (such as DDD-094) to define and approve specific execution values during tool reactivation (e.g., approving 'meta-ads' with a designated ToolWorkflow value).

## Related Concepts
*None*

## Related Entities
- [[entities/geometric|geometric]]
- [[entities/youtube-lf-script|youtube-lf-script]]
- [[entities/brief-generator|brief-generator]]
- [[entities/tool|Tool]]
- [[entities/toolkey|ToolKey]]

## Mentions in Source

- "Not every `ToolWorkflow` value is a Tool — `extraction` is a direct routing path, not a Tool chain." — [[Wiki/concepts/tool-domain-concept|tool-domain-concept]]
- "Approved reactivation: `meta-ads` with `ToolWorkflow = meta_ads_generator` (DDD-094)" — [[Wiki/concepts/tool-domain-concept|tool-domain-concept]]