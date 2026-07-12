# AGENTS

## Purpose
Fast-start instructions for AI coding agents. Every line answers: "Would an agent likely miss this without help?"

## Mandatory Read Order (Before Any Edit)
1. [Domain Ubiquitous Language Glossary](docs/01-requirements/domain-ubiquitous-language-glossary.md)
2. [Domain Bounded Context Map](docs/02-design/domain-bounded-context-map.md)
3. [Domain Naming Decision Log](docs/07-governance/domain-naming-decision-log.md)

If touching UI code: [Frontend UI Ubiquitous Language Spec](docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md)

Do not introduce non-canonical domain terms anywhere (code, tests, docs, PR notes, comments). New terms require a `DDD-NNN` entry in the decision log first.

## Documentation Frontmatter
Every file under `docs/` MUST start with a YAML frontmatter block delimited by `---` lines. No exceptions, including archived files (keep frontmatter valid for tooling even when content freezes).

**Required fields** (all documents):
- `status` — one of `active` | `approved` | `draft` | `archived`
- `version` — semver-style document version
- `last-reviewed` — ISO date `YYYY-MM-DD`
- `next-review-date` — ISO date `YYYY-MM-DD`
- `owner` — team or role responsible for the document

**Common optional fields** (use when relevant):
- `date_created` — ISO date, original creation date
- `title` — explicit display title (otherwise inferred from H1)
- `type` — document kind (e.g. `code-review`, `ui-governance-spec`, `adr`)
- `tags` — YAML list of topical tags for search/indexing
- `goal` — short statement of objective (for plans/templates)

On any content change: bump `version`, refresh `last-reviewed`, push `next-review-date`, and update `owner` if ownership changed. Reference template: [docs/99-reference/templates/tool-development-plan-template.md](docs/99-reference/templates/tool-development-plan-template.md).

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
