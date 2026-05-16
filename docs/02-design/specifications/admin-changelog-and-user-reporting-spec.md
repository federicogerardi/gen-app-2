---
status: draft
version: 1.0
last-reviewed: 2026-05-16
owner: Frontend Platform Team
---

# Admin Changelog And User Reporting Feature Spec

## 1. Purpose

Define a DDD-first feature proposal for:
- admin publication of user-facing changelog entries
- user submission of reports/requests with canonical categories
- optional GitHub issue publication for reports in category `issue`

This spec is terminology-first and architecture-ready. It does not introduce runtime implementation changes.

## 2. Canonical Vocabulary (Proposed)

The following terms are introduced as provisional and governed by DDD-065:
- `ProductChangelog`
- `UserReport`
- `UserReportCategory` = `issue` | `feature-request` | `other`
- `UserReportStatus` = `submitted` | `triaged` | `github-published` | `closed`
- `GitHubIssueLink`
- `IssuePublicationPolicy`
- `FeedbackCenterMachine` (Frontend/UI XState application-service concept)

### 2.1 Naming Anti-Drift Rules

- Persist only canonical category values from `UserReportCategory`.
- Normalize input aliases (`bug`, `problem`, `ticket`, `request`) to canonical values at boundary.
- Keep `UserReport` as source of truth even when GitHub publication succeeds.
- Treat `GitHubIssueLink` as external projection attached to local report.

## 3. Bounded Context Ownership

### 3.1 Frontend/UI

Owns:
- `ProductChangelog` authoring/read UX
- `UserReport` submission and admin triage UX
- `FeedbackCenterMachine` UI orchestration
- `IssuePublicationPolicy` invocation and channel-consistent feedback presentation

### 3.2 Auth

Owns:
- role gate via `AuthSessionPrincipal` / `AuthUserRole`

Role policy:
- `admin`: publish changelog, triage reports, trigger GitHub publication
- `member`: submit reports and read published changelog

## 4. UI Archetype Classification (Mandatory)

Every screen in scope is classified using canonical UI archetypes.

### 4.1 Data Table View

- Admin Changelog Listing (published entries)
- Admin User Report Inbox (triage/escalation queue)

Conventions:
- deterministic table states (`loading`, `empty`, `error`)
- row actions follow canonical table action pattern
- status tags for `UserReportStatus`

### 4.2 Tool Workspace Page

- User Report Submission Page

Implementation constraint:
- If this page is implemented as `Tool Workspace Page`, it must use canonical `ToolPageTemplate` composition under `apps/frontend/src/features/tools/`; otherwise it must be reclassified before implementation.

Panel mapping:
- Setup Panel: category, title, message, optional contact context
- Workflow Panel: submission status, validation feedback, escalation outcome preview

Feedback channel mapping remains canonical:
- `inline-action`: validation and submit failures
- `page-state`: list query states
- `global`: cross-page mutation confirmation/error

## 5. Functional Scope

### 5.1 Admin: ProductChangelog publication

Capabilities:
- create draft changelog entry
- publish entry to users
- list previously published entries

Minimum fields:
- `title`
- `body`
- `publishedAt`
- `publishedBy`

### 5.2 User: UserReport submission

Capabilities:
- submit report with canonical category
- receive immediate submission outcome

Minimum fields:
- `category: UserReportCategory`
- `title`
- `description`
- `createdBy`
- `createdAt`

### 5.3 Admin: UserReport triage and optional escalation

Capabilities:
- update status from `submitted` to `triaged`/`closed`
- publish to GitHub only when `category = issue`
- store resulting `GitHubIssueLink` when publication succeeds

Failure contract:
- local `UserReport` record must remain persisted even when GitHub publication fails
- failed external publish must not drop local triage context

## 6. XState Concept Draft

## 6.1 Machine Boundary

Canonical machine concept: `FeedbackCenterMachine` (provisional).

Intent:
- provide one deterministic orchestration boundary for changelog publication and user reporting flows
- enforce role-gated transitions and category-gated escalation

## 6.2 Hierarchical State Model (XState v5)

Top-level states:
- `bootstrapping`
- `ready`

Nested states under `ready`:
- `ready.idle`
- `ready.reportSubmitting`
- `ready.reportSubmitSuccess`
- `ready.reportSubmitFailure`
- `ready.changelogPublishing`
- `ready.changelogPublishSuccess`
- `ready.changelogPublishFailure`
- `ready.reportTriaging`
- `ready.reportTriageSuccess`
- `ready.reportTriageFailure`
- `ready.issuePublishing`
- `ready.issuePublishSuccess`
- `ready.issuePublishFailure`

Rationale:
- Removes ambiguous shared terminal states (`success`/`failure`) across unrelated intents.
- Keeps outcome states operation-scoped, deterministic, and easy to map to `FeedbackChannel`.

## 6.3 Ready-To-Implement Machine Skeleton (v5)

```ts
import { and, assign, fromPromise, setup } from 'xstate';

export const feedbackCenterMachine = setup({
	types: {
		context: {} as {
			principalRole: 'admin' | 'member' | null;
			activeReportCategory: 'issue' | 'feature-request' | 'other' | null;
			activeReportId: string | null;
			draftReportTitle: string;
			draftReportDescription: string;
			lastError: string | null;
			lastIssueUrl: string | null;
		},
		events: {} as
			| { type: 'CONTEXT_READY'; role: 'admin' | 'member' }
			| { type: 'REPORT_SUBMIT_REQUESTED' }
			| { type: 'CHANGELOG_PUBLISH_REQUESTED' }
			| { type: 'REPORT_TRIAGE_REQUESTED'; reportId: string }
			| { type: 'ISSUE_PUBLISH_REQUESTED'; reportId: string }
			| { type: 'ACK_SUCCESS' }
			| { type: 'RESET_TO_IDLE' },
		input: {} as {
			role: 'admin' | 'member';
		}
	},
	guards: {
		isAdmin: ({ context }) => context.principalRole === 'admin',
		isIssueCategory: ({ context }) => context.activeReportCategory === 'issue',
		hasRequiredSubmissionFields: ({ context }) => (
			context.draftReportTitle.trim().length > 0 &&
			context.draftReportDescription.trim().length > 0 &&
			context.activeReportCategory !== null
		)
	},
	actors: {
		submitReport: fromPromise(async ({ input }) => input),
		publishChangelog: fromPromise(async ({ input }) => input),
		triageReport: fromPromise(async ({ input }) => input),
		publishIssue: fromPromise(async ({ input }) => input)
	}
}).createMachine({
	id: 'feedbackCenterMachine',
	initial: 'bootstrapping',
	context: ({ input }) => ({
		principalRole: input.role,
		activeReportCategory: null,
		activeReportId: null,
		draftReportTitle: '',
		draftReportDescription: '',
		lastError: null,
		lastIssueUrl: null
	}),
	states: {
		bootstrapping: {
			on: {
				CONTEXT_READY: {
					target: 'ready.idle',
					actions: assign({
						principalRole: ({ event }) => event.role
					})
				}
			}
		},
		ready: {
			initial: 'idle',
			states: {
				idle: {
					on: {
						REPORT_SUBMIT_REQUESTED: {
							guard: 'hasRequiredSubmissionFields',
							target: 'reportSubmitting'
						},
						CHANGELOG_PUBLISH_REQUESTED: {
							guard: 'isAdmin',
							target: 'changelogPublishing'
						},
						REPORT_TRIAGE_REQUESTED: {
							guard: 'isAdmin',
							target: 'reportTriaging',
							actions: assign({ activeReportId: ({ event }) => event.reportId })
						},
						ISSUE_PUBLISH_REQUESTED: [
							{
								guard: and(['isAdmin', 'isIssueCategory']),
								target: 'issuePublishing',
								actions: assign({ activeReportId: ({ event }) => event.reportId })
							},
							{
								target: 'issuePublishFailure',
								actions: assign({
									lastError: () => 'Issue publication is allowed only for admin reports in category issue.'
								})
							}
						]
					}
				},
				reportSubmitting: {
					invoke: {
						src: 'submitReport',
						input: ({ context }) => ({
							title: context.draftReportTitle,
							description: context.draftReportDescription,
							category: context.activeReportCategory
						}),
						onDone: {
							target: 'reportSubmitSuccess',
							actions: assign({ lastError: () => null })
						},
						onError: {
							target: 'reportSubmitFailure',
							actions: assign({ lastError: ({ event }) => String(event.error) })
						}
					}
				},
				reportSubmitSuccess: {
					on: { ACK_SUCCESS: { target: 'idle', reenter: true } }
				},
				reportSubmitFailure: {
					on: { RESET_TO_IDLE: { target: 'idle', reenter: true } }
				},
				changelogPublishing: {
					invoke: {
						src: 'publishChangelog',
						input: () => ({}),
						onDone: {
							target: 'changelogPublishSuccess',
							actions: assign({ lastError: () => null })
						},
						onError: {
							target: 'changelogPublishFailure',
							actions: assign({ lastError: ({ event }) => String(event.error) })
						}
					}
				},
				changelogPublishSuccess: {
					on: { ACK_SUCCESS: { target: 'idle', reenter: true } }
				},
				changelogPublishFailure: {
					on: { RESET_TO_IDLE: { target: 'idle', reenter: true } }
				},
				reportTriaging: {
					invoke: {
						src: 'triageReport',
						input: ({ context }) => ({ reportId: context.activeReportId }),
						onDone: {
							target: 'reportTriageSuccess',
							actions: assign({ lastError: () => null })
						},
						onError: {
							target: 'reportTriageFailure',
							actions: assign({ lastError: ({ event }) => String(event.error) })
						}
					}
				},
				reportTriageSuccess: {
					on: { ACK_SUCCESS: { target: 'idle', reenter: true } }
				},
				reportTriageFailure: {
					on: { RESET_TO_IDLE: { target: 'idle', reenter: true } }
				},
				issuePublishing: {
					invoke: {
						src: 'publishIssue',
						input: ({ context }) => ({ reportId: context.activeReportId }),
						onDone: {
							target: 'issuePublishSuccess',
							actions: assign({
								lastIssueUrl: ({ event }) => String(event.output),
								lastError: () => null
							})
						},
						onError: {
							target: 'issuePublishFailure',
							actions: assign({ lastError: ({ event }) => String(event.error) })
						}
					}
				},
				issuePublishSuccess: {
					on: { ACK_SUCCESS: { target: 'idle', reenter: true } }
				},
				issuePublishFailure: {
					on: { RESET_TO_IDLE: { target: 'idle', reenter: true } }
				}
			}
		}
	}
});
```

## 6.4 Core Events And Deterministic Guards

Core events:
- `CONTEXT_READY`
- `REPORT_SUBMIT_REQUESTED`
- `CHANGELOG_PUBLISH_REQUESTED`
- `REPORT_TRIAGE_REQUESTED`
- `ISSUE_PUBLISH_REQUESTED`
- `ACK_SUCCESS`
- `RESET_TO_IDLE`

Deterministic guards:
- `isAdmin`: allow changelog publish, triage, and issue publication only for admin principal
- `isIssueCategory`: allow issue publication only when `UserReportCategory = issue`
- `hasRequiredSubmissionFields`: enforce report form completeness before dispatch

Guard policy:
- `ISSUE_PUBLISH_REQUESTED` must be accepted only when `isAdmin && isIssueCategory`.
- Category mismatch must transition to operation-scoped failure state, not a generic machine failure.

## 6.5 Reenter Policy (v5)

- XState v5 transitions are internal by default.
- Use `reenter: true` for retry/reset transitions that must re-run `entry`, restart invokes, or reinitialize local operation state.
- Apply `reenter: true` on failure -> idle recovery transitions for each operation branch.

## 6.6 Invoke Policy (fromPromise)

- All async boundaries must be implemented with actor logic creators.
- Use `fromPromise` for:
	- submit report request
	- publish changelog request
	- triage report request
	- publish GitHub issue request (conditional)
- Keep side effects outside `assign`; `assign` is only for deterministic context updates.

## 6.7 Always Transition Policy

- `always` is reserved for deterministic non-visual normalization only.
- Success-to-idle flow in this feature must use explicit `ACK_SUCCESS` to preserve frontend observability and deterministic QA assertions.
- Never use unguarded `always` transitions that can create loops.

## 6.8 Test Hooks And Verification Contract

Runtime hooks:
- instantiate with `createActor(feedbackCenterMachine)`
- inspect current state with `actor.getSnapshot()`
- compute pure next snapshots with `getNextSnapshot(...)` for transition tests outside runtime

Minimum test matrix:
- role gate: member cannot publish changelog/triage/publish issue
- category gate: non-`issue` report cannot publish to GitHub
- recovery: every operation failure can return to `ready.idle` with reenter path
- persistence safety: GitHub publish failure keeps local `UserReport` status recoverable (`submitted` or `triaged`)
- success acknowledgement behavior: each `ready.*Success` state must require explicit `ACK_SUCCESS` before returning to `ready.idle`

Feedback channel output:
- map operation-scoped outcomes to canonical `FeedbackChannel` without cross-operation ambiguity

## 6.9 Event-By-Event Transition Table (PR/QA)

| Event | Allowed Source State(s) | Guard(s) | Target State | Invoke/Action Boundary | Expected QA Outcome |
| --- | --- | --- | --- | --- | --- |
| `CONTEXT_READY` | `bootstrapping` | none | `ready.idle` | `assign(principalRole)` | machine exits bootstrap deterministically |
| `REPORT_SUBMIT_REQUESTED` | `ready.idle` | `hasRequiredSubmissionFields` | `ready.reportSubmitting` | invoke `submitReport` (`fromPromise`) | submit starts only with complete payload |
| `onDone(submitReport)` | `ready.reportSubmitting` | none | `ready.reportSubmitSuccess` | `assign(lastError = null)` | success branch reached, no generic success state |
| `onError(submitReport)` | `ready.reportSubmitting` | none | `ready.reportSubmitFailure` | `assign(lastError)` | operation-scoped failure captured |
| `CHANGELOG_PUBLISH_REQUESTED` | `ready.idle` | `isAdmin` | `ready.changelogPublishing` | invoke `publishChangelog` (`fromPromise`) | member cannot enter publish branch |
| `onDone(publishChangelog)` | `ready.changelogPublishing` | none | `ready.changelogPublishSuccess` | `assign(lastError = null)` | changelog publish success is isolated |
| `onError(publishChangelog)` | `ready.changelogPublishing` | none | `ready.changelogPublishFailure` | `assign(lastError)` | changelog publish failure is isolated |
| `REPORT_TRIAGE_REQUESTED` | `ready.idle` | `isAdmin` | `ready.reportTriaging` | `assign(activeReportId)` + invoke `triageReport` (`fromPromise`) | triage is admin-only |
| `onDone(triageReport)` | `ready.reportTriaging` | none | `ready.reportTriageSuccess` | `assign(lastError = null)` | triage success remains operation-scoped |
| `onError(triageReport)` | `ready.reportTriaging` | none | `ready.reportTriageFailure` | `assign(lastError)` | triage failure remains operation-scoped |
| `ISSUE_PUBLISH_REQUESTED` | `ready.idle` | `isAdmin && isIssueCategory` | `ready.issuePublishing` | `assign(activeReportId)` + invoke `publishIssue` (`fromPromise`) | publish issue allowed only for admin + `issue` |
| `ISSUE_PUBLISH_REQUESTED` (guard fail) | `ready.idle` | `!isAdmin \|\| !isIssueCategory` | `ready.issuePublishFailure` (target policy) | `assign(lastError)` | category/role mismatch is explicit and testable |
| `onDone(publishIssue)` | `ready.issuePublishing` | none | `ready.issuePublishSuccess` | `assign(lastIssueUrl, lastError = null)` | external issue link is persisted in context |
| `onError(publishIssue)` | `ready.issuePublishing` | none | `ready.issuePublishFailure` | `assign(lastError)` | local report continuity preserved on GitHub failure |
| `ACK_SUCCESS` | `ready.*Success` | none | `ready.idle` (`reenter: true`) | explicit acknowledgement transition | success states remain observable before normalization |
| `RESET_TO_IDLE` | `ready.*Failure` | none | `ready.idle` (`reenter: true`) | reenter transition | retry path re-runs entry/invoke setup deterministically |

QA notes:
- Validate both accepted and rejected `ISSUE_PUBLISH_REQUESTED` paths.
- Assert that no event routes to shared generic terminal nodes.
- Assert that each success branch requires explicit `ACK_SUCCESS`.
- Assert that each failure branch is recoverable via `RESET_TO_IDLE`.

## 6.10 UX States-To-Copy (Frontend Review Fast Track)

| Machine State | Feedback Channel | User-Facing Copy (EN) | CTA Label | CTA Event |
| --- | --- | --- | --- | --- |
| `ready.reportSubmitSuccess` | `global` | Report submitted successfully. | Back to form | `ACK_SUCCESS` |
| `ready.reportSubmitFailure` | `inline-action` | We could not submit your report. Please check required fields and try again. | Try again | `RESET_TO_IDLE` |
| `ready.changelogPublishSuccess` | `global` | Changelog entry published successfully. | Back to changelog | `ACK_SUCCESS` |
| `ready.changelogPublishFailure` | `inline-action` | Changelog publication failed. Please retry. | Retry publish | `RESET_TO_IDLE` |
| `ready.reportTriageSuccess` | `global` | Report triaged successfully. | Back to inbox | `ACK_SUCCESS` |
| `ready.reportTriageFailure` | `inline-action` | Report triage failed. Please retry. | Retry triage | `RESET_TO_IDLE` |
| `ready.issuePublishSuccess` | `global` | GitHub issue published successfully. | Open issue link | `ACK_SUCCESS` |
| `ready.issuePublishFailure` | `inline-action` | GitHub issue publication failed. The local report is still available. | Retry issue publish | `RESET_TO_IDLE` |

Localized UI copy is intentionally kept out of the domain section and is maintained in Appendix A: UI localization note (non-domain).

Copy governance notes:
- Keep failure copy action-oriented and local (`inline-action`) when user can recover from the same screen.
- Keep success copy concise and ephemeral (`global`) with one clear acknowledgement path.
- Do not expose raw transport/internal errors in UI copy; map technical errors to user-readable messages.

## 7. API Contract Draft (Terminology-Level)

Provisional endpoint naming proposal:
- `POST /api/user-reports`
- `GET /api/admin/user-reports`
- `PATCH /api/admin/user-reports/{reportId}`
- `POST /api/admin/user-reports/{reportId}/publish-issue`
- `POST /api/admin/changelog`
- `GET /api/changelog`

No route is canonical until implementation approval.

## 7.1 Persistence Contract (PR-Ready)

### 7.1.1 Canonical Persistent Entities

| Entity | Storage Shape | Notes |
| --- | --- | --- |
| `ProductChangelog` | table `product_changelogs` | Admin-authored user-facing changelog entries (`draft`/`published`) |
| `UserReport` | table `user_reports` | User-submitted reports with canonical category and lifecycle status |
| `GitHubIssueLink` | table `user_report_github_links` (1:1 with `user_reports`) | External issue projection attached to local report |

### 7.1.2 Required Columns And Constraints

`product_changelogs`:
- `id` (PK)
- `title` (not null)
- `body` (not null)
- `status` with check constraint in (`draft`, `published`)
- `created_by_user_id` FK -> `users(id)`
- `published_by_user_id` FK -> `users(id)` nullable
- `published_at` nullable; required by application rule when `status = 'published'`
- `created_at`, `updated_at`

`user_reports`:
- `id` (PK)
- `category` with check constraint in (`issue`, `feature-request`, `other`)
- `status` with check constraint in (`submitted`, `triaged`, `github-published`, `closed`)
- `title` (not null)
- `description` (not null)
- `created_by_user_id` FK -> `users(id)`
- `triaged_by_user_id` FK -> `users(id)` nullable
- `triaged_at` nullable
- `closed_at` nullable
- `created_at`, `updated_at`

`user_report_github_links`:
- `user_report_id` PK + FK -> `user_reports(id)` (1:1)
- `repository` (not null)
- `issue_number` (not null)
- `issue_url` (not null)
- `published_by_user_id` FK -> `users(id)`
- `published_at` (not null)
- unique constraint on (`repository`, `issue_number`)

### 7.1.3 Persistence Invariants

- Canonical category/status values must be enforced at DB layer via check constraints.
- `UserReport.category` synonyms (`bug`, `problem`, `ticket`, `request`) must never be persisted as primary values.
- GitHub publication must not overwrite local report identity; `GitHubIssueLink` is additive projection.
- `user_report_github_links.user_report_id` enforces max one GitHub issue link per report.

### 7.1.4 Transactional Rules

- Triage update: status transition + triage metadata update in one transaction.
- Publish issue: (1) insert `GitHubIssueLink`, (2) update `UserReport.status = 'github-published'`, (3) update timestamps in one transaction.
- External GitHub failure must rollback link/status mutation and preserve local `UserReport` recoverability (`submitted` or `triaged`).

### 7.1.5 Indexing Contract (Frontend/Admin UX)

- `user_reports(status, created_at desc)` for admin inbox paging.
- `user_reports(category, status, created_at desc)` for triage filtering.
- `product_changelogs(status, published_at desc)` for changelog listing.
- `product_changelogs(created_at desc)` for admin draft workflow.

## 8. Naming Audit Report

Resolved by this proposal:
- `bug` vs `problem` vs `issue` -> canonical `UserReportCategory = issue`
- `feature` vs `feature request` -> canonical `feature-request`
- `request` vs `report` -> canonical persisted entity `UserReport`
- `announcement` vs `changelog` -> canonical `ProductChangelog`

Allowed as UI copy only (not persisted as canonical values):
- bug
- problem
- ticket
- request
- announcement

## 9. Acceptance Criteria

- Canonical terms from DDD-065 are reused consistently across docs and implementation plans.
- UI screens are classified only as `Tool Workspace Page` or `Data Table View`.
- Category values are deterministic and normalized at boundary.
- GitHub publication remains conditional on `isIssueCategory` guard.
- Local report persistence survives any GitHub publish failure.

## 10. Evidence Sources

- Admin role gate behavior: `apps/frontend/src/features/admin/routing/admin-guard.tsx:7-9`
- Existing admin handler surface: `apps/backend/src/lib/runtime/auth-http/admin-handlers.ts:3-13`
- Canonical feedback channel model in runtime: `apps/frontend/src/app/runtime/feedback-channel-map.ts:1-25`
- Canonical UI archetypes and feedback matrix: `docs/02-design/specifications/frontend-ui-ubiquitous-language-spec.md`
- Canonical role terms: `docs/01-requirements/domain-ubiquitous-language-glossary.md`

## Appendix A. UI localization note (non-domain)

- EN copy table in Section 6.10 remains the source-of-truth for product semantics.
- The IT table below is a localized companion for frontend/UI review and must stay semantically equivalent to EN.

| Machine State | Feedback Channel (IT) | Localized Copy (IT) | CTA Label (IT) | CTA Event |
| --- | --- | --- | --- | --- |
| `ready.reportSubmitSuccess` | `global` | Segnalazione inviata con successo. | Torna al modulo | `ACK_SUCCESS` |
| `ready.reportSubmitFailure` | `inline-action` | Impossibile inviare la segnalazione. Controlla i campi richiesti e riprova. | Riprova | `RESET_TO_IDLE` |
| `ready.changelogPublishSuccess` | `global` | Voce di changelog pubblicata con successo. | Torna al changelog | `ACK_SUCCESS` |
| `ready.changelogPublishFailure` | `inline-action` | Pubblicazione del changelog non riuscita. Riprova. | Riprova pubblicazione | `RESET_TO_IDLE` |
| `ready.reportTriageSuccess` | `global` | Segnalazione triagiata con successo. | Torna alla inbox | `ACK_SUCCESS` |
| `ready.reportTriageFailure` | `inline-action` | Triage della segnalazione non riuscito. Riprova. | Riprova triage | `RESET_TO_IDLE` |
| `ready.issuePublishSuccess` | `global` | Issue GitHub pubblicata con successo. | Apri issue | `ACK_SUCCESS` |
| `ready.issuePublishFailure` | `inline-action` | Pubblicazione della issue GitHub non riuscita. La segnalazione locale resta disponibile. | Riprova pubblicazione issue | `RESET_TO_IDLE` |
