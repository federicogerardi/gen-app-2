---
type: source
created: 2026-07-27
updated: 2026-07-27
source_file: "[[Wiki/concepts/tool-domain-concept.md]]"
tags: [wiki/concept, ddd, cross-context]
aliases: ["Tool Domain Concept", "Tool Concept Document"]
contentHash: 984-c170187a
generation_complete: true
---

# Tool (domain concept) - Summary

## Source
- Original file: [[Wiki/concepts/tool-domain-concept.md]]
- Ingested: 2026-07-27

## Core Content
This document defines the [[concepts/tool|Tool]] as the foundational organizing concept of the application context in Domain-Driven Design. A [[concepts/tool|Tool]] encapsulates a complete user-facing capability, taking structured input via defined [[concepts/toolinputsource|ToolInputSource]] families, executing an ordered chain of modular [[concepts/workflowstep|WorkflowStep]] items, progressively enriching context, and outputting a final [[concepts/artifact|Artifact]] or [[concepts/asset|Asset]]. Tools are uniquely identified across contexts via [[concepts/toolkey|ToolKey]], while workflow execution paths map through [[concepts/toolworkflow|ToolWorkflow]]. Governance over new or reactivated tools requires formal entries in the DDD decision log.

## Key Entities
- [[entities/apiservice|ApiService]]: Service component providing external API integrations for the `api-acquisition` input family.
- [[entities/geometric|geometric]]: A multi-step active tool executing crawling, scoring, and generation step types.
- [[entities/youtube-lf-script|youtube-lf-script]]: A complex multi-step active tool featuring a 6-step workflow for script extraction and generation.
- [[entities/brief-generator|brief-generator]]: A single-step active tool that processes direct input to generate a brief asset.

## Key Concepts
- [[concepts/tool|Tool]]: The core application organizing concept representing an end-to-end user capability.
- [[concepts/workflowstep|WorkflowStep]]: Reusable operational steps (e.g., extraction, crawling, scoring, generation) arranged into ordered chains within tools.
- [[concepts/artifact|Artifact]]: The final deliverable produced upon completion of a tool workflow.
- [[concepts/toolkey|ToolKey]]: Canonical identifier used across bounded contexts (e.g., UI frontend and generation service requests).
- [[concepts/toolinputsource|ToolInputSource]]: The four input families consumed by tools: direct-input, tool-input-file, api-acquisition, and project-asset.
- [[concepts/asset|Asset]]: Project assets that serve as both tool input sources and generated artifact deliverables.
- [[concepts/toolworkflow|ToolWorkflow]]: Execution routing paths and workflow classifications across system boundaries.

## Main Points
- A [[concepts/tool|Tool]] structures user capabilities into structured input intake, step-wise workflow execution, context enrichment, and final deliverable output.
- Identification is standardized across contexts using canonical [[concepts/toolkey|ToolKey]] definitions.
- Tools accept inputs from four [[concepts/toolinputsource|ToolInputSource]] families, including external data via [[entities/apiservice|ApiService]] and persistent [[concepts/asset|Asset]] entities.
- [[concepts/workflowstep|WorkflowStep]] units are modular and reusable across different tool configurations.
- Creation or modification of tool identities is strictly governed through DDD decision log entries.