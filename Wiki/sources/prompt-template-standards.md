---
type: source-summary
tags:
  - wiki/source
  - prompt-engineering
  - development-standards
  - tool-generation
date_created: 2026-07-28
last-reviewed: 2026-07-28
next-review-date: 2027-01-28
owner: LLM
source_file: docs/03-development/prompt-template-standards.md
date_ingested: 2026-07-28
source_version: 1.0
---

# Prompt Template Standards

Canonical reference for creating and maintaining LLM prompt templates under `apps/backend/src/lib/runtime/tool-prompts/`. Enforced by the completed prompt-layer-remediation-plan (2026-07-23), applies to 34 upgraded templates across 12 tools.

## Language Policy

| Channel | Language |
|---------|----------|
| System instructions | **English** |
| Artifact output | **Italian (`it-IT`)** |
| Awareness labels | **English** (invariant) |

## Mandatory Structure

Every prompt must include these sections in order: PLACEHOLDERS block → Role → Objective → Input → Anti-Hallucination Guardrails → Pipeline Context (multi-step only) → Persona Asset Usage (persona tools) → Output Rules → Required Output Structure → Good vs. Bad Examples (≥2 pairs) → Internal Checklist (≥5 items) → Feedback Incorporation (feedbackEnabled steps).

## Quality Gates

Six anti-hallucination guardrails standard block: never fabricate sources, never invent statistics, never reference non-existent studies, declare uncertainty when appropriate, stay within domain boundaries, respect hierarchy of evidence.

## Chain-Aware Prompts

Multi-step tools declare `## Pipeline Context` with explicit dependency on previous step outputs and progressive enrichment rules. Single-step tools omit this section.

## Persona Asset Rules

Tools consuming persona assets include `## Persona Asset Usage` with extraction and application rules keyed to `{{driverPersona}}` and `{{passengerPersona}}` placeholders.

## Minimum Line Counts

Extraction prompts: 70+ lines. Single-step generation: 150+ lines. Multi-step generation (step > 1): 120+ lines.

## Contradictions

None.

## Source

- File: `docs/03-development/prompt-template-standards.md`
- Version: 1.0
- Last reviewed: 2026-07-23
- Owner: Backend Runtime