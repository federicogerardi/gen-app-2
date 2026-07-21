---
status: approved
version: 1.0.0
last-reviewed: 2026-07-18
next-review-date: 2026-08-18
owner: Domain Architecture
type: tool-development-plan
goal: Consolidated restyling plan to transition from a project-centric UX to a workspace-centric UX in our DDD-based application.
---

# UX Transformation Plan: From Project-Centric to Workspace-First (Refined)

This document defines the technical strategy and detailed steps to consolidate the application around the user-facing concept of **Workspace** (which projects the technical entity `Project` at the DB/API level) and ensure a cumulative knowledge flow based on **Sessions** (GenerationSession) and **Assets** (durable in the Workspace), hiding the ad-hoc navigation of individual raw Artifacts (reserving it for administrators only).

## 🗺️ Routing Map: Current → Target

```
CURRENT                                  TARGET
──────────────────────────────────────   ──────────────────────────────────────
/dashboard                           →  /dashboard                 (stays, copy updated)
/dashboard/projects                  →  → redirect /workspaces
/dashboard/projects/new              →  → redirect /workspaces    (replaced by inline dialog in /workspaces)
/dashboard/projects/:id              →  → redirect /workspaces/:id

/workspaces                          →  /workspaces               (stays, enhanced)
/workspaces/:id                      →  /workspaces/:id           (stays, enhanced)
/workspaces/:id/assets               →  /workspaces/:id/assets    (stays, populated)
/workspaces/:id/tools/:key           →  /workspaces/:id/tools/:key (stays, unchanged)
  —                                   →  /workspaces/:id/sessions  ★ NEW (WorkspaceSessionsPage)

/artifacts                           →  /admin/artifacts          (moved, admin only)
/artifacts/:artifactId               →  /admin/artifacts/:artifactId

/sessionsummary/*                    →  /sessionsummary/*         (unchanged)
/admin/*                             →  /admin/*                  (unchanged, + /admin/artifacts)
/tools/:toolKey                      →  → redirect /workspaces (via LegacyToolRedirect)
/*                                   →  → /workspaces             (unchanged)
```

---

## 📦 BLOCK A — Removing Projects from FE Navigation

### A1. Implementation Steps
1. **`navigation-metadata.ts`** (`apps/frontend/src/app/runtime/navigation-metadata.ts`):
   - Remove the `{ to: '/dashboard/projects', ... }` entry from the static `NAVIGATION_ITEMS` array.
2. **`app-router.tsx`** (`apps/frontend/src/app/routing/app-router.tsx`):
   - Replace the `/dashboard/projects` and `/dashboard/projects/new` routes with `<Navigate to="/workspaces" replace />`.
   - Create an inline redirect component `ProjectRedirect`:
     ```tsx
     const ProjectRedirect = () => {
       const { id } = useParams<{ id: string }>();
       return <Navigate to={`/workspaces/${id}`} replace />;
     };
     ```
   - Map the `/dashboard/projects/:id` route to render `<ProjectRedirect />`.
3. **`DashboardPage.tsx`** (`apps/frontend/src/features/dashboard/pages/DashboardPage.tsx`):
   - Change the empty state CTA link (`to="/dashboard/projects/new"`) to `to="/workspaces"`.
   - Update the "Projects" Card link (`to="/dashboard/projects"`) to `to="/workspaces"`.
   - Update the "Tools" Card link (`to="/tools"`) to `to="/workspaces"`.
4. **`system.ts`** (`apps/frontend/src/app/copy/system.ts`):
   - Replace all user-facing references to "Progetto" (Project) with "Workspace" to align the interface with the *Frontend UI Ubiquitous Language Spec*.

### A2. QA Scenario
- **Tool**: Browser (Chrome/Firefox/Safari)
- **Steps**:
  1. Log in as a standard user.
  2. Verify that the "Projects" item has disappeared from the sidebar navigation and "Workspaces" is present.
  3. Manually type `/dashboard/projects` in the address bar. Verify that you are redirected to `/workspaces`.
  4. Manually type `/dashboard/projects/proj-123`. Verify that you are redirected to `/workspaces/proj-123`.
- **Expected Result**: No visible links to `/dashboard/projects` in the viewport; all legacy URLs correctly redirect to the corresponding new workspace paths.

---

## 📦 BLOCK B — Workspace Status Management (Active/Archived)

### B1. Backend (Database, Models, and Repositories)
1. **DB Migration**: Create `packages/infra-db/migrations/20260718_000027_project_status.sql`:
   ```sql
   ALTER TABLE projects ADD COLUMN status VARCHAR NOT NULL DEFAULT 'active';
   ALTER TABLE projects ADD CONSTRAINT projects_status_check CHECK (status IN ('active', 'archived'));
   ```
2. **Kysely Types** (`apps/backend/src/lib/adapters/postgres-kysely.types.ts`):
   - Update `ProjectsTable` by adding `status: Generated<'active' | 'archived'>`.
3. **BE Types** (`apps/backend/src/lib/types/projects.ts`):
   - Update `ProjectSummary` and `ProjectDetail` to include `status: 'active' | 'archived'`.
   - Update `ProjectRow` to include `status: string` (or `status: 'active' | 'archived'`).
   - Update `mapProjectRowToSummary` and `mapProjectRowToDetail` mapping `status: (row.status as 'active' | 'archived') ?? 'active'`.
   > **Advisor Note (Description Persistence Gap)**: Currently, the database table does not have a `description` column. `ProjectSummary` in FE includes a description which is currently lost in DB and mapped as `description: ''`. This discrepancy does not block the implementation but is highlighted for consistency.
4. **Repository Interface and Implementations**:
   - In `ProjectQueryRepository` (`postgres-redis.interfaces.ts`), add:
     ```typescript
     updateProjectForUser(
       userId: string,
       projectId: string,
       input: { name?: string; status?: 'active' | 'archived' }
     ): Promise<ProjectDetail | null>;
     ```
   - In `PostgresProjectQueryRepository` (`postgres.project-query.repository.ts`):
     - **Critical**: Add `'status'` to the list of columns in `.select(...)` inside the `listProjectsByUser`, `getProjectByIdForUser`, and `createProjectForUser` methods.
     - Implement `updateProjectForUser` using Kysely's `updateTable('projects')` filtered by `user_id` and `id`, returning the updated record using `.returning(...)`.
   - In `ProjectQueryRepositoryStub` (`postgres-redis.stub.ts`):
     - Update `StubProjectRecord` to contain `status: 'active' | 'archived'`.
     - Set `status: 'active'` as default in `createProjectForUser`.
     - Implement `updateProjectForUser` to modify the in-memory record status.

### B2. Backend Handlers and Routes
1. **`projects-handlers.ts`** (`apps/backend/src/lib/runtime/auth-http/projects/projects-handlers.ts`):
   - Add the `handleProjectUpdate` handler:
     - Require session principal and query repositories.
     - Validate the JSON payload with Zod:
       ```typescript
       const updateProjectSchema = z.object({
         name: z.preprocess(val => typeof val === 'string' ? val : undefined, optionalTrimmedString()),
         status: z.enum(['active', 'archived']).optional(),
       });
       ```
     - Call `queries.projects.updateProjectForUser(principal.user.id, projectId, parsedData)`. If null, return a `404` error.
     - Touch the session. Return a `200` success response with `{ project }`.
2. **`projects-routes.ts`** (`apps/backend/src/lib/runtime/auth-http/projects/projects-routes.ts`):
   - Register the route:
     ```typescript
     {
       method: 'PUT',
       pattern: /^\/api\/projects\/([^/]+)$/,
       handler: async (request, response, projectId) => {
         await projectsHandlers.handleProjectUpdate(request, response, decodeURIComponent(projectId ?? ''));
       },
     },
     ```

### B3. Backend Unit Tests
- Add a test in `apps/backend/src/lib/tests/runtime.auth-http.test.ts` under the projects suite:
  ```typescript
  test('auth HTTP runtime supports PUT /api/projects/:id to toggle project status', async () => {
    // Log in, create a project as in "supports /api/projects endpoints"
    // Send a PUT request to /api/projects/:id with body { status: 'archived' }
    // Assert statusCode === 200 and project.status === 'archived'
  });
  ```
  Run with: `node --import tsx --test apps/backend/src/lib/tests/runtime.auth-http.test.ts`

### B4. Frontend (Client API and UX)
1. **`projects-client.ts`** (`apps/frontend/src/features/projects/runtime/projects-client.ts`):
   - Update `ProjectSummary` with `status: 'active' | 'archived'`.
   - Implement `updateProject(id, patch)` which executes a `PUT` request to `/api/projects/:id`.
2. **`WorkspacesListPage.tsx`** (`apps/frontend/src/features/workspace/pages/WorkspacesListPage.tsx`):
   - Render a differentiated visual style for archived workspaces (60% opacity, grey background, and "Archived" badge).
   - Add "Archive Workspace" and "Reactivate Workspace" contextual actions that invoke `updateProject` and trigger an SWR cache revalidation.
3. **`WorkspaceDashboard.tsx`** (`apps/frontend/src/features/workspace/pages/WorkspaceDashboard.tsx`):
   - If the loaded workspace has `status === 'archived'`:
     - Render a sticky warning banner at the top: "This workspace is archived. Reactivate to continue working." with a "Reactivate" CTA.
     - Disable or hide the primary "Start generating" CTA and all tool generation capabilities.

### B5. QA Scenario
- **Tool**: Browser Developer Tools (Console/Network) + Browser UI.
- **Steps**:
  1. Navigate to `/workspaces` and click the context menu of an active workspace card. Select "Archive Workspace".
  2. Verify visually that the card appears greyed out with reduced opacity.
  3. Click the card to enter the dashboard of that workspace. Verify the warning banner appears at the top notifying the archived status.
  4. Verify that all generation action buttons ("Start generating" / "Avvia generazione") are hidden or disabled.
  5. Click "Reactivate" in the warning banner. Verify the banner disappears and CTAs return to active state.
- **Expected Result**: The interface dynamically adapts to the archival status, enabling or disabling workflows in a deterministic manner.

---

## 📦 BLOCK C — Workspace Creation via Inline Dialog

### C1. Implementation Steps
1. **`WorkspacesListPage.tsx`**:
   - Remove the legacy link pointing to `/dashboard/projects/new`.
   - Add a static **"+ New Workspace"** button in the TopBar.
   - Create an inline `CreateWorkspaceDialog` component (or import it) using MUI's `Dialog`, `DialogTitle`, `DialogContent`, `TextField` (for `name` and `description`), and `DialogActions`.
   - Use `zod` for client-side form validation (requiring `name` to be non-empty).
   - Handle form submission by calling the `createProject({ name, description })` API from the frontend client.
   - Upon success, trigger SWR's `mutate()` on the workspace list query to refresh the list without reloading the page, and close the dialog.
2. **`app-router.tsx`**:
   - Remove the legacy `/dashboard/projects/new` route completely.

### C2. QA Scenario
- **Tool**: Browser UI.
- **Steps**:
  1. Navigate to `/workspaces`.
  2. Click the "+ New Workspace" button. Verify that the MUI modal opens.
  3. Try to submit the form without entering a name. Verify that a required field validation error is rendered.
  4. Enter the name "Test Workspace Refined" and a description, then click "Create".
- **Expected Result**: The modal closes, the workspace list revalidates in the background via SWR and displays the new workspace "Test Workspace Refined" without a full page reload.

---

## 📦 BLOCK D — WorkspaceSessionsPage (Workspace Sessions)

### D1. Implementation Steps
1. **Create the page**: `apps/frontend/src/features/workspace/pages/WorkspaceSessionsPage.tsx`
   - Create the file and export the `WorkspaceSessionsPage` component.
   - Retrieve `workspaceId` using `useParams()`.
   - Use `useProjectDetailQuery` to fetch the workspace name (`project?.name`).
   - Render the page layout with breadcrumbs and mount `<SessionsListingSection title="Workspace Sessions" fixedProjectId={workspaceId} fixedProjectName={project?.name} />`.
2. **`app-router.tsx`**:
   - Register the route:
     ```tsx
     {
       path: 'sessions',
       element: <Suspense fallback={<PageLoader />}><WorkspaceSessionsPage /></Suspense>,
     }
     ```
     as a child of `:workspaceId` inside the `/workspaces` path.
3. **Dashboard Integration** (`WorkspaceDashboard.tsx`):
   - Import and render `<RecentActivityPanel workspaceId={workspaceId} />`.
   - In `RecentActivityPanel.tsx` (`apps/frontend/src/features/workspace/ui/dashboard/RecentActivityPanel.tsx`), add a footer link at the bottom of the list of the last 5 activities:
     ```tsx
     <div className="dashboard-panel__footer" style={{ marginTop: 12, paddingLeft: 16 }}>
       <Link to={`/workspaces/${workspaceId}/sessions`} style={{ textDecoration: 'none', color: '#1976d2', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
         View all sessions →
       </Link>
     </div>
     ```

### D2. QA Scenario
- **Tool**: Browser UI.
- **Steps**:
  1. Navigate to `/workspaces/:workspaceId`.
  2. Verify that the "Recent Activity" panel (RecentActivityPanel) is visible and lists recent sessions.
  3. Click the "View all sessions →" link in the panel footer.
  4. Verify that you are navigated to `/workspaces/:workspaceId/sessions` and that a paginated table of sessions for this workspace is rendered.
- **Expected Result**: Seamless transition from the workspace dashboard to the complete list of historical sessions associated with it.

---

## 📦 BLOCK E — Resolving Gaps in the Workspace Dashboard

### E1. Implementation Steps
1. **`useWorkspaceContext.ts`** (`apps/frontend/src/features/workspace/runtime/useWorkspaceContext.ts`):
   - Modify the `gaps` derivation in the hook to support dashboard mode (`hasToolKey === false`):
     ```typescript
     import { ASSET_TYPES, TOOL_ASSET_CONTRACTS, type ToolKey } from '@gen-app-2/contracts';
     
     // Replace the 'gaps' logic in the return statement or inside useMemo
     const derivedGaps = useMemo(() => {
       if (hasToolKey) {
         return (assetsQuery.gaps || []).map(g => ({
           assetType: g.assetType,
           canBeProducedBy: g.canBeProducedBy,
         }));
       }
       
       // Dashboard mode: compare ASSET_TYPES to those present in groupedByType
       return ASSET_TYPES.filter(type => {
         const hasAssets = groupedByType[type] && groupedByType[type].length > 0;
         return !hasAssets;
       }).map(type => {
         // Identify which tools produce this asset type
         const producers = (Object.keys(TOOL_ASSET_CONTRACTS) as ToolKey[]).filter(key =>
           TOOL_ASSET_CONTRACTS[key].produces.includes(type)
         );
         return {
           assetType: type,
           canBeProducedBy: producers,
         };
       }).filter(gap => gap.canBeProducedBy.length > 0);
     }, [hasToolKey, assetsQuery.gaps, groupedByType]);
     ```
   - Replace the `gaps: (assetsQuery.gaps || [])...` line in the returned object with `gaps: derivedGaps`.

### E2. QA Scenario
- **Tool**: Browser Developer Tools / UI.
- **Steps**:
  1. Create a new, completely empty workspace (i.e., with zero assets).
  2. Enter the workspace dashboard.
  3. Verify that tool recommendations in "Foundation Tools" and "Available Tools" are visible and correctly indicate their producer tools (e.g., `brief-generator` for the `brief` asset, `tov-generator` for `brand-voice`), since gaps are now dynamically calculated without an active toolKey.
- **Expected Result**: Knowledge gaps are correctly inferred client-side on the empty dashboard, providing smart recommendations for the user on which tool to start first.

---

## 📦 BLOCK F — Moving `/artifacts` to `/admin/artifacts`

### F1. Implementation Steps
1. **`app-router.tsx`**:
   - Move the `/artifacts` and `/artifacts/:artifactId` routes inside the administrator routes section (under the `AdminLayout` wrapper).
   - Under the admin layout, define:
     ```tsx
     {
       path: 'artifacts',
       children: [
         { index: true, element: <Suspense fallback={<PageLoader />}><ArtifactsPage /></Suspense> },
         { path: ':artifactId', element: <Suspense fallback={<PageLoader />}><ArtifactDetailPage /></Suspense> },
       ]
     }
     ```
2. **`navigation-metadata.ts`**:
   - Update the admin navigation menu to point the "Artifacts" link to `/admin/artifacts`.
3. **`ArtifactDetailPage.tsx`** and **`ArtifactsPage.tsx`**:
   - Replace all back-links and literal navigation references pointing to `/artifacts` with `/admin/artifacts`.

### F2. QA Scenario
- **Tool**: Administrator Login vs. Standard User Login.
- **Steps**:
  1. Log in as a standard user (`member`). Manually navigate to `/admin/artifacts` and verify that access is denied (redirect or authorization error).
  2. Log in as an `admin`. Open the admin panel and verify that the "Artifacts" item is visible and fully functional.
- **Expected Result**: Individual raw historical artifacts are inaccessible to non-administrator users, ensuring a clean workspace-first UX.

---

## 📦 BLOCK G — Populating `ProjectAssetsPage`

### G1. Implementation Steps
1. **`ProjectAssetsPage.tsx`** (`apps/frontend/src/features/workspace/pages/ProjectAssetsPage.tsx`):
   - Use `useWorkspaceContext(workspaceId)` to retrieve `assets`, `groupedByType`, and `refetch`.
   - Import `ASSET_TYPE_LABELS` from `toolAssetRegistry`.
   - Iterate over all supported `ASSET_TYPES`:
     - If assets exist in `groupedByType` for a given type, render the asset list with details (label, quality score, status, actions to view or download).
     - If no assets exist, render `<CreateAssetPrompt />` passing:
       - `assetType={type}`
       - `label={ASSET_TYPE_LABELS[type]}`
       - `projectId={workspaceId}`
       - `onCreateAction={refetch}`
       - `isRequired={false}`
       - `producerTool={getProducerToolsForAsset(type)[0] || null}`

### G2. QA Scenario
- **Tool**: Browser UI.
- **Steps**:
  1. Navigate to the workspace assets tab (`/workspaces/:workspaceId/assets`).
  2. For missing asset types, verify that the manual paste text or file upload prompt (CreateAssetPrompt) or the link to generate it using its producer tool is correctly rendered.
  3. Upload a plain `.txt` file to simulate manual insertion of a "Brief" asset.
- **Expected Result**: The asset is successfully created, and the asset library table immediately updates to display the new item, removing the prompt for that asset type.
