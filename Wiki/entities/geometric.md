---
type: entity
created: 2026-07-27
updated: 2026-07-27
sources: ["[[sources/tool-domain-concept_435988]]"]
tags: [product]
aliases:
  - "geometric"
  - "Geometric Tool"
generation_complete: true
---


# geometric

## Description
geometric is a multi-step [[entities/tool|Tool]] within the application's suite, identified by its canonical ToolKey value 'geometric'. It is notable for utilizing crawling and scoring execution steps alongside generation, setting it apart from standard tools that rely exclusively on extraction and generation. As part of a [[concepts/toolworkflow|ToolWorkflow]], its execution sequence operates across multiple [[entities/workflowstep|WorkflowStep]] elements to process or generate relevant [[entities/artifact|Artifact]] outputs. While its specific domain purpose likely involves spatial or geometric analysis, it functions as one of the active user-facing capabilities composed by the system, sharing operational infrastructure with tools such as [[entities/youtube-lf-script|youtube-lf-script]] and [[entities/brief-generator|brief-generator]].

## Related Entities
- [[entities/youtube-lf-script|youtube-lf-script]]
- [[entities/brief-generator|brief-generator]]
- [[entities/tool|Tool]]
- [[entities/workflowstep|WorkflowStep]]
- [[entities/artifact|Artifact]]

## Related Concepts
- [[concepts/toolworkflow|ToolWorkflow]]

## Mentions in Source

- "Values: `funnel-pages`, `nextland`, `youtube-lf-script`, `angle-generator`, `youtube-description`, `geometric`, `blog-article-generator`, `brief-generator`, `tov-generator`, `personas-generator`" — [[Wiki/concepts/tool-domain-concept|tool-domain-concept]]
- "| `geometric` | Multi-step | `crawling`, `scoring`, `generation` |" — [[Wiki/concepts/tool-domain-concept|tool-domain-concept]]