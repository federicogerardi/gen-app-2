---
type: concept
created: 2026-07-27
updated: 2026-07-27
sources: ["[[sources/tool-domain-concept_435988]]"]
tags: [term]
aliases:
  - "WorkflowStep"
  - "Workflow Step"
generation_complete: true
---


# WorkflowStep

## Definition
WorkflowStep is a foundational unit of execution within the [[concepts/tool|Tool]] architecture, representing an ordered operational stage in a Tool's workflow. It facilitates progressive context enrichment as input data travels through various processing stages toward the final production of an [[concepts/artifact|Artifact]].

## Key Characteristics
- **Ordered Execution**: Represents sequential, deterministic steps within a Tool's overall operational pipeline.
- **Modularity and Reusability**: Designed to be reusable across different Tools, promoting clean separation of concerns and component reusability.
- **Diverse Functional Types**: Encompasses standard process operations including extraction, generation, web crawling, and scoring.
- **Progressive Enrichment**: Drives incremental context enhancement, transforming initial user inputs into structured outputs.

## Applications
- **Modular Tool Design**: Constructing complex multi-step processes by chaining standardized WorkflowSteps together.
- **Data Transformation Pipelines**: Ingesting raw inputs and progressively transforming them through step-wise crawling, extraction, scoring, and text generation.

## Related Concepts
- [[concepts/tool|Tool]]
- [[concepts/artifact|Artifact]]

## Related Entities
*No related entities.*

## Mentions in Source

- "an ordered WorkflowStep chain" — [[Wiki/concepts/tool-domain-concept|tool-domain-concept]]
- "Steps within a Tool may be reused across different Tools." — [[Wiki/concepts/tool-domain-concept|tool-domain-concept]]