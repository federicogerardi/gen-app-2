---
applyTo: "docs/**/*.md"
description: "Instruction for maintaining a consistent Ubiquitous Language across project documentation — gen-app-2."
---

# Domain Ubiquitous Language — gen-app-2

## Purpose
- Keep domain terminology consistent across all documentation under `docs/`.
- Ensure the same concept is always named with one canonical term across all four bounded contexts.

## Canonical Bounded Contexts (gen-app-2)
- **Generation** — artifact lifecycle, XState actors, stream/persistence pipeline
- **Auth** — user identity, sessions, roles, OAuth
- **Usage/Quota** — quota enforcement, audit history, project scoping
- **Frontend/UI** — tool page orchestration, briefing upload, step flow, readiness

## Critical Term Pairs (must not be conflated)
| Use this | Not this | Context |
| --- | --- | --- |
| `Artifact` | Output, Result, Generation, Document | all |
| `GenerationRequest` | GenerationInput, GenerationPayload, CreateGenerationDto | Generation, Frontend |
| `ToolWorkflow` | ToolType, WorkflowKey, RouteType | Generation |
| `SupportedTool` | ToolType, Tool, WorkflowKey | Frontend |
| `WorkflowStep` | Task, Stage, Phase | Generation (abstract) |
| `ToolStep` | StepName, PipelineStep | Frontend (concrete) |
| `ClaimUsage` | DecrementQuota, ConsumeQuota, CheckAndReserve | Usage/Quota |
| `ReadinessSnapshot` | ReadinessState, CanStartFlags | Frontend |
| `ExtractionContext` | BriefingContext, ExtractedData, ParsedBriefing | Frontend, Generation |
| `AuthSessionPrincipal` | CurrentUser, LoggedInUser, SessionUser | Auth |
| `BackendStreamEvent` | StreamEvent, SseEvent, GenerationEvent | Generation, Frontend |
| `HydrationResult` | ResumeState, CheckpointData, SessionSnapshot | Frontend |

## Rules
- Define one canonical term per concept before editing docs.
- Reuse canonical terms in all sections, headings, and tables.
- If synonyms exist, keep one canonical term and list others as aliases in the glossary `Aliases And Deprecated Terms` table.
- Prefer domain terms over technical implementation jargon in user-facing docs.
- Mark uncertain terms as `provisional` until confirmed by DDD analysis.

## Required Output Conventions
- Write final domain artifacts in English.
- Keep definitions concise, unambiguous, and system-specific.
- Include source evidence (file path + line) when introducing or changing a canonical term.
- New terms require a `DDD-NNN` entry in `docs/07-governance/domain-naming-decision-log.md` before propagation.

## Integration Checklist
- Update `docs/01-requirements/domain-ubiquitous-language-glossary.md` first, then propagate to related docs.
- When a new bounded context section is added to the glossary, also update `docs/02-design/domain-bounded-context-map.md`.
- Ensure `docs/index-overview.md` points to any newly added domain document.
- Avoid duplicate glossary files; extend existing domain docs whenever possible.

