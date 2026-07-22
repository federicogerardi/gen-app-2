# Gen App 2

AI-powered content generation, built around structured tool workflows.

Each Tool takes your input — a briefing, a topic, a brand voice — and produces ready-to-use content through a deterministic, multi-step pipeline. No black boxes: every generation step is visible, replayable, and traceable.

## What you can do

- Generate landing pages, funnel sequences, YouTube scripts, and full blog articles
- Extract marketing angles and audience personas from your documents
- Analyze SERP results and produce strategic reports
- Build reusable brand assets that feed into every tool automatically

## How it works

You bring the context. The system chains generation steps — extraction, research, writing, refinement — each handled by the right model for the job. Output is versioned, downloadable, and tied to your project workspace.

## Architecture

Gen App 2 is built on two core engineering pillars:

- **Domain-Driven Design** — every concept in the system has a single canonical name and a well-defined boundary. No ambiguity, no drift.
- **XState state machines** — the entire generation pipeline is modeled as explicit states and transitions. You can inspect, debug, and reason about every path the system can take.

## Quick Start

```bash
npm install --workspaces --include-workspace-root
npm run dev
```

```bash
npm run typecheck && npm run test && npm run build
```

## Learn more

- [Documentation Index](docs/index-overview.md) — full docbase navigation
- [Domain Glossary](docs/01-requirements/domain-ubiquitous-language-glossary.md) — canonical vocabulary
- [Governance Rules](docs/07-governance/documentation-ddd-ul-governance.md) — how we keep the codebase coherent