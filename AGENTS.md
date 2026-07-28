# AGENTS

## Purpose
Fast-start instructions for AI coding agents. Every line answers: "Would an agent likely miss this without help?"

## Mandatory Read Order (Before Any Edit)
1. [Domain Ubiquitous Language Glossary](docs/01-requirements/domain-ubiquitous-language-glossary.md)
2. [Domain Bounded Context Map](docs/02-design/domain-bounded-context-map.md)
3. [Domain Naming Decision Log](docs/07-governance/domain-naming-decision-log.md)

If touching UI code: [Frontend UI Ubiquitous Language Spec](docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md)

**If creating or editing LLM prompt templates** (any `.md` file under `apps/backend/src/lib/runtime/tool-prompts/`): [Prompt Template Standards](docs/03-development/prompt-template-standards.md) — mandatory structure, language policy, anti-hallucination blocks, chain awareness, persona rules, feedback instructions, placeholder documentation.

Do not introduce non-canonical domain terms anywhere (code, tests, docs, PR notes, comments). New terms require a `DDD-NNN` entry in the decision log first.

## Documentation Governance

> Canonical governance document: [docs/07-governance/documentation-ddd-ul-governance.md](docs/07-governance/documentation-ddd-ul-governance.md). Rules here are the agent-facing summary.

### Frontmatter (Mandatory)
Every file under `docs/` MUST start with a YAML frontmatter block delimited by `---` lines. No exceptions, including archived files. Double frontmatter blocks (two `---`-delimited sections) are forbidden — use one block only.

**Required fields** (all documents):
- `status` — strictly lowercase, one of: `active` | `approved` | `draft` | `archived` | `implemented` | `completed` | `accepted`. Never quoted (`'active'`), never title-case (`Active`), never uppercase (`Completed`), never free-form (`Target (post-unification)`). If the document is superseded, use `archived` and add a `superseded-by` field pointing to the replacement.
- `version` — `X.Y` format (major.minor, e.g. `1.0`, `2.3`, `4.15`). Do not use `X.Y.Z` unless the document explicitly governs a versioned artifact that requires three-segment semver.
- `last-reviewed` — ISO date `YYYY-MM-DD`
- `next-review-date` — ISO date `YYYY-MM-DD`, at most 6 months in the future. Never leave expired without update.
- `owner` — team or role responsible for the document

**Required for active non-archive documents only**:
- `date_created` — ISO date, original creation date

**Common optional fields** (use when relevant):
- `title` — explicit display title (otherwise inferred from H1)
- `type` — document kind from the canonical set: `code-review` | `ui-governance-spec` | `adr` | `proposal` | `specification` | `debug-runbook` | `observability-runbook` | `development-guide` | `integration-guide` | `reference` | `template` | `briefing-note` | `project-tracker` | `product-presentation` | `design-review` | `tool-proposal` | `implementation-plan` | `design-proposal` | `ai-first-runtime-spec` | `design-system-guide` | `glossary` | `bounded-context-map` | `decision-log`
- `tags` — YAML list of topical tags for search/indexing
- `goal` — short statement of objective (for plans/templates)
- `implementation_date` — ISO date (for `implemented` proposals)
- `superseded-by` — relative path to replacement document (for `archived` docs)

On any content change: bump `version`, refresh `last-reviewed`, push `next-review-date` (max +6 months), and update `owner` if ownership changed. Reference template: [docs/99-reference/templates/tool-development-plan-template.md](docs/99-reference/templates/tool-development-plan-template.md).

### Language Policy
- **Technical documents** (glossary, BCM, decision log, ADR, specifications, runbooks, code reviews, architecture reviews, reference guides, integration guides, development guides): **English only**.
- **Product documents** (PM briefings, user guides, product presentations): **Italian allowed**.
- **Proposals and implementation plans**: **English preferred**; Italian tolerated if the primary audience is an Italian-speaking PM.
- Never mix languages within the same document body. Document title and section headings must match the body language.
- Frontmatter keys are always English.

### Link Integrity
- Every relative link in a document must resolve to an existing file within the same change set.
- When moving or renaming a file, update all inbound links in the same commit.
- Cross-directory links to `plan/` or other directories outside `docs/` are allowed but must be verified when the document is reviewed.
- Use `../../` relative paths correctly for the document's depth from `docs/` root.

### Document Lifecycle
- **Active**: defines current behavior, contracts, or governance constraints; referenced by a current workflow.
- **Archive** (`docs/99-lifecycle/99-archive/`): superseded, historical, or completed plans. Frontmatter stays valid after archival.
- **Superseded** (`docs/99-lifecycle/99-archive/superseded/`): explicitly replaced by a newer document. Frontmatter must include `superseded-by` field.
- Update `docs/index-overview.md` in the same change when a document status changes.

### Creation Checklist
Before committing a new document under `docs/`:
1. Check canonical DDD terms against glossary + BCM + decision log
2. Verify no existing document already covers the same scope
3. Assign correct section (`01-requirements`, `02-design`, `04-testing`, `07-governance`, `99-reference`, `99-lifecycle`)
4. Fill all required frontmatter fields with canonical values
5. Add `date_created` (for active docs)
6. Add `type` from the canonical set
7. Add relevant `tags`
8. Choose language per policy — stick to it throughout
9. Verify all relative links resolve
10. If applicable, add `> ⚑ DDD Reference` block with links to glossary, BCM, decision log
11. Update `docs/index-overview.md` if the document is in the core navigation path

## Architecture
- **Monorepo**: npm workspaces — `apps/backend`, `apps/frontend`, `packages/contracts`, `packages/domain`, `packages/infra-db`.
- **Backend**: Node.js, XState v5 actors (`GenerationSystem` aggregate root), Kysely typed SQL, pg driver, Redis, Zod validation.
- **Frontend**: React 19, XState v5 (`ToolPage` aggregate root), MUI, Vite, Vitest, SWR.
- **Contracts**: `packages/contracts` is the single authoritative source for FE/BE shared types. Frontend imports via `file:` reference. Compile-time parity guard enforces structural alignment.
- **Domain**: `packages/domain` is framework-agnostic — never import backend/frontend-specific types here.
- **Infra-DB**: `packages/infra-db` owns migrations and seeds. Backend runs them via `tsx scripts/run-sql-dir.ts`.

## Commands

**Install** (from root):
```
npm install --workspaces --include-workspace-root
```

**Full validation** (from root):
```
npm run typecheck    # all workspaces
npm run test         # all workspaces
npm run build        # backend typecheck + frontend build
```

**Backend focused**:
```
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run test        # node --import tsx --test
npm --workspace apps/backend run lint        # stricter: includes noUnused*
npm --workspace apps/backend run go          # migrate + seed + typecheck + test
```

**Frontend focused**:
```
npm --workspace apps/frontend run typecheck
npm --workspace apps/frontend run test       # vitest run
npm --workspace apps/frontend run build      # tsc + vite build
```

**Env-dependent commands** (require `.env.local`):
```
set -a && . ./.env.local && set +a && npm run test:smoke
set -a && . ./.env.local && set +a && npm run backend:go
```

**Running a single backend test**:
```
node --import tsx --test src/lib/tests/<filename>.test.ts
```

**Running a single frontend test**:
```
npm --workspace apps/frontend run test -- <pattern>
```

## Backend Test Runner Quirks
- Uses Node built-in test runner (`node --import tsx --test`), not Jest/Vitest.
- Test files: `apps/backend/src/lib/tests/*.test.ts`.
- Smoke tests (`postgres-redis.smoke.ts`, etc.) require live Postgres + Redis — they are NOT run by `npm run test`. Run via `npm run test:smoke` with env loaded.
- `npm run go` = `db:migrate:minimal && db:seed:minimal && typecheck && test` — the standard full verification for backend changes.

## Frontend Test Runner Quirks
- Vitest with jsdom environment, setup file: `src/test/setup.ts`.
- Coverage thresholds: lines 70%, functions 70%, branches 60%, statements 70%.
- A11y tests (`test:admin-a11y`) run axe against rendered routes.
- MSW (Mock Service Worker) is available for API mocking in tests.
- `vite.config.ts` proxies `/generation`, `/auth`, `/admin/users`, `/api` to backend at `localhost:3000`.

## CI Workflows
- **Backend Gate** (`backend-gate.yml`): typecheck + test. Triggered on changes to `apps/backend/**`, `packages/infra-db/**`, `packages/contracts/**`.
- **Main PR Gate** (`main-pr-gate.yml`): typecheck + test + a11y + build. Triggered on changes to `apps/frontend/**`, `packages/contracts/**`.
- CI uses Node 24, runs `npm ci` (not `npm install`).

## Dependency & Lockfile Safety
If any `package.json` changes, regenerate lockfiles via npm only (never hand-edit lockfiles):
1. `npm install --workspaces --include-workspace-root`
2. `npm ci`
3. `npm ci --workspaces --include-workspace-root`
4. `npm --workspace apps/frontend run build` (verify workspace graph)

## XState Pitfalls
- `useMachine(..., { input })` initializes actor input once; if input props change after mount, sync via event or recreate actor.
- In `assign(...)` with shared params typing, ensure fields share a compatible params shape to avoid TS inference breakage.
- In callback `onDone` branches with custom event typing, explicit event output narrowing/casting may be required when done event is not in local unions.

## React Pitfalls
- Declare constants before `useEffect` if referenced in effect body or dependency array (temporal dead zone runtime error).

## DDD Governance
- Never rename domain concepts without a DDD decision-log entry.
- When unsure about naming, stop and align with canonical terms before coding.
- Keep user-facing copy centralized — no hardcoded UI text in components, hooks, machines, or query helpers.
- Never make control flow depend on rendered copy text; use typed state/reason codes/booleans and map to copy separately.

## Deployment
- **Railway**: Dockerfile-based build. `npm run start` = migrate + start server. Healthcheck at `/health`.
- **Docker**: `npm ci --workspaces --include-workspace-root` then `npm run start`. Exposes port 3000.
- Frontend production serves via `server.mjs` (same-origin proxy to backend).

## Accessibility
For user-facing changes:
- Verify keyboard navigation and visible focus.
- Verify screen-reader labels for interactive controls.
- Verify error messages are actionable and not color-only.

## Useful Entrypoints
- [Root README](README.md)
- [Documentation Index](docs/index-overview.md)
- [Frontend app root](apps/frontend/src/App.tsx)
- [Backend server entry](apps/backend/src/server.ts)
- [Backend adapters](apps/backend/src/lib/adapters/index.ts)
- [Contracts index](packages/contracts/src/index.ts)

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## LLM Wiki

This vault uses the [llm-wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — an LLM incrementally builds and maintains a persistent, interlinked wiki from raw sources rather than re-deriving knowledge on every query.

### Architecture

Three layers:

1. **Raw sources** (`docs/`) — immutable markdown files with frontmatter. LLM reads, never modifies.
2. **The wiki** (`Wiki/`) — LLM-generated, interlinked markdown. Summaries, entity pages, concept pages, synthesis.
3. **This schema** (`AGENTS.md`) — instructions telling the LLM how to maintain the wiki.

### Wiki Directory Structure

```
Wiki/
├── index.md          # content catalog — read this first for any operation
├── log.md            # append-only operation log (grep-parseable: `## [YYYY-MM-DD]`)
├── overview.md       # high-level synthesis of everything
├── sources/          # one summary per ingested doc
├── entities/         # people, tools, packages, workspaces, roles
├── concepts/         # ideas, patterns, techniques, DDD concepts
└── synthesis/        # query answers filed back into wiki
```

### Page Conventions

Every wiki page has:
- `type:` in YAML frontmatter — one of: `source-summary`, `entity`, `concept`, `synthesis`, `index`, `log`, `overview`
- `tags:` with `wiki/` namespace — e.g. `wiki/source`, `wiki/entity`, `wiki/concept`
- `date_created:`, `last-reviewed:`, `next-review-date:` (ISO dates, review within 6 months)
- `owner:` — role or team

Additional frontmatter by page type:
- Source summaries: `source_file:`, `date_ingested:`, `source_version:` (version of source at ingest time; used for stale detection)
- Entity pages: `source_count:`, `entity_type:` (person/tool/package/workspace/role)
- Concept pages: `source_count:`, `confidence:` (high/medium/low)
- Synthesis pages: `query:`, `date_created:`

Content conventions:
- Heavy `[[wikilinks]]` everywhere for Obsidian graph view
- `[key::value]` inline metadata for Dataview queries
- Keep source summaries factual — no interpretation
- Interpretation and analysis go in concept/synthesis pages
- When sources contradict each other, note it in the `## Contradictions` section — never silently overwrite
- The `## Contradictions` section is present on every source summary, defaulting to `None.` when no contradictions exist
- Never modify raw source files under any circumstances
- Wiki pages use English (technical domain), matching the language policy

### Operations

#### Ingest

Process a raw source from `docs/` into the wiki:

1. Read the raw source completely
2. Create a source summary in `Wiki/sources/` with `type: source-summary`
3. Create/update entity pages in `Wiki/entities/` for every distinct entity mentioned
4. Create/update concept pages in `Wiki/concepts/` for every domain concept, pattern, or technique
5. Update `Wiki/index.md` — add to Sources/Entities/Concepts tables, remove from Unprocessed
6. Update `Wiki/overview.md` if the big picture changed
7. Append to `Wiki/log.md` with format: `## [YYYY-MM-DD] ingest | Source Title`

A single ingest typically touches 5-15 wiki pages.

#### Query

Answer questions against the wiki:

1. Read `Wiki/index.md` to find relevant pages
2. Read relevant wiki pages (not raw sources — the wiki should have what you need)
3. Synthesize an answer with wikilinks
4. If the answer is substantial, file it as a new page in `Wiki/synthesis/` with `type: synthesis`
5. Update `Wiki/index.md` and `Wiki/log.md`

#### Lint

Health-check the wiki. Report:
- Orphan pages (no inbound wikilinks)
- Broken wikilinks
- Stale pages (date_updated older than newest relevant source)
- Contradictions between pages
- Concepts mentioned in prose but lacking their own page
- Missing cross-references

### Rules

- Never modify raw source files in `docs/`. They are immutable.
- Always update `Wiki/index.md` and `Wiki/log.md` on every wiki change.
- Keep source summaries factual. Interpretation goes in concept/synthesis pages.
- When sources contradict each other, note it explicitly — never silently overwrite.
- This schema evolves. Update AGENTS.md as we discover what works.

## Obsidian in Development

This project is an Obsidian vault. Use Obsidian as a first-class development tool alongside the codebase.

### When to Use Obsidian vs Code Tools

| Scenario | Tool | Why |
|----------|------|-----|
| Domain concept lookup | `Wiki/` pages or raw `docs/` | Wiki has distilled knowledge; raw docs are authoritative |
| Code-level search (symbols, imports) | grep / graphify | Code navigation, not document navigation |
| Architecture / design questions | `Wiki/index.md` → relevant page | Wiki is a persistent knowledge cache |
| Creating a new doc under `docs/` | Write directly | LLM writes factual docs; Obsidian renders them |
| Navigating document relationships | Graph View / backlinks / [[wikilinks]] | Obsidian native features |
| Checking a doc's frontmatter | `obsidian property:get` or direct read | Fast metadata access without opening the file |
| Searching across all docs | `obsidian search` or grep | Obsidian search understands wikilinks and aliases |

### Obsidian CLI Quick Reference

```
obsidian read file="Note Name"              # read a note by title
obsidian create name="New" content="# Hello" silent
obsidian append file="Note" content="line"
obsidian search query="term" limit=10        # vault-aware search
obsidian property:get name="status" file="Note"
obsidian property:set name="status" value="done" file="Note"
obsidian daily:read                          # today's daily note
```

Use `obsidian` CLI when you need vault-aware operations (aliases, wikilinks, property queries). Use direct file reads for raw content.

### Development Flow with Obsidian

1. **Before coding**: If unsure about domain terms, query the wiki (`Wiki/index.md` → relevant entity/concept page). Fall back to raw `docs/` only if the wiki lacks coverage.

2. **During implementation**: Reference `docs/` source files directly for specs, ADRs, and plans. These are immutable — don't edit them while coding against them.

3. **After design decisions**: If a new domain concept or naming decision emerges, log it in `docs/07-governance/domain-naming-decision-log.md` following existing `DDD-NNN` format before using the term in code.

4. **Wiki maintenance**: After significant doc changes (new ADR, updated spec, new decision), run `ingest` to update the wiki. The wiki is a cache — it must stay current with `docs/`.

### Property Navigation

Documents under `docs/` use frontmatter with canonical fields (`status`, `type`, `version`, `owner`). Use these patterns:
- Find all active proposals: grep `status: active` + `type: proposal`
- Find docs needing review: search for `next-review-date` values in the past
- Identify provisional concepts: look for `status: provisional` in glossary entries

### Graph Integration

The project has two complementary knowledge graphs:
- **Obsidian Graph View** — document-level relationships via [[wikilinks]] and tags. Shows domain concept clusters.
- **graphify** — code-level relationships (symbols, imports, functions). Use for codebase questions.

Use Obsidian graph for architecture/domain questions; use graphify for implementation/code questions.
