---
type: entity
created: 2026-07-27
updated: 2026-07-27
sources: []
tags: [product]
aliases:
  - "Brief Generator"
  - "brief-generator"
generation_complete: true
---


# brief-generator

## Description
The `brief-generator` is a single-step [[entities/tool|Tool]] designed to produce a "brief" [[entities/asset|Asset]] as its output. Unlike multi-step tools, it employs a generation step type operating exclusively with direct input. Identified by its canonical ToolKey `brief-generator`, the tool was formally introduced via DDD decision-log entry DDD-210, demonstrating governance oversight for establishing new tool identities within the system. As a single-step tool, it provides a streamlined capability to directly transform input into a designated [[entities/artifact|Artifact]] type, forming part of a broader suite of tools alongside [[entities/geometric|geometric]] and [[entities/youtube-lf-script|youtube-lf-script]] to support core team workflows.

## Related Entities
- [[entities/geometric|geometric]]
- [[entities/youtube-lf-script|youtube-lf-script]]
- [[entities/tool|Tool]]
- [[entities/asset|Asset]]
- [[entities/artifact|Artifact]]

## Related Concepts
- [[concepts/tool-workflow|ToolWorkflow]]

## Mentions in Source

- "| `brief-generator` | Single-step | `generation` (→ `'brief'` Asset) |" — [[Wiki/concepts/tool-domain-concept|tool-domain-concept]]
- "New Tool identities require DDD decision-log entries (e.g., DDD-155 for `blog-article-generator`, DDD-210 for `brief-generator`)." — [[Wiki/concepts/tool-domain-concept|tool-domain-concept]]