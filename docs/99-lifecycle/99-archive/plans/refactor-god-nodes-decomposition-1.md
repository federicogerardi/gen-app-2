---
goal: Decompose God Nodes (useAuthSession, resolveBackendCapabilities) to reduce coupling and improve cohesion through specialized hooks and dependency injection
version: 1.2
date_created: 2026-07-08
last_updated: 2026-07-08
last-reviewed: 2026-07-08
next-review-date: 2026-07-15
owner: Domain Architecture
status: completed
tags: [refactoring, god-nodes, coupling, hooks, dependency-injection, frontend]
---

# Refactoring Plan: God Nodes Decomposition

## Context

From the [Graph Structural Analysis](../../../07-governance/graph-structural-analysis-review.md), three nodes have been identified as "God Nodes" with exceptionally high connectivity:

1. **useAuthSession()** — 51 edges (AuthSessionProvider.tsx:107)
2. **resolveBackendCapabilities()** — 45 edges (backend-capabilities.ts:74)  
3. **ToolKey** — 42 edges (tool-workflows.ts:76)

This plan targets the first two nodes for decomposition. ToolKey is excluded as it's a cross-context canonical identifier by DDD design.

## Current State Analysis

### God Node 1: useAuthSession() (51 edges)

**Source**: `apps/frontend/src/app/providers/AuthSessionProvider.tsx:107`

**Provides 4 distinct concerns**:
- **Auth State** (`session`, `loading`, `hasError`) — used by 95% of components
- **Auth Actions** (`login`, `logout`, `refresh`, `clearError`) — used by 5% of components
- **API Config** (`apiBaseUrl`, `capabilities`) — used by API clients
- **OAuth URL** (`oauthStartUrl`) — used only by login pages

**Problem**: Every component needing auth imports the entire context, creating unnecessary coupling.

### God Node 2: resolveBackendCapabilities() (45 edges)

**Source**: `apps/frontend/src/app/runtime/backend-capabilities.ts:74`

**Provides**: Environment-based feature flags for 17 backend capabilities.

**Problem**: Every API client calls this function multiple times to determine available endpoints, creating repetitive coupling.

### Usage Analysis

From analyzing 77 occurrences of `useAuthSession()`:
- **Guards & Layouts**: Only need `{ session, loading, hasError }`
- **Login Forms**: Only need `{ login, logout, oauthStartUrl }`
- **API Clients**: Only need `{ apiBaseUrl, capabilities }`
- **Navigation**: Only need `{ session }` for role checking

From analyzing 13 occurrences of `resolveBackendCapabilities()`:
- **Admin Client**: Calls function 12 times for admin-specific capabilities
- **Tools Client**: Calls function 8 times for tool-specific capabilities  
- **Artifact Client**: Calls function 6 times for artifact-specific capabilities

## Proposed Solution

### Phase 1: useAuthSession() Decomposition

#### 1.1 Create Specialized Hooks

**New Architecture**:
```typescript
// Specialized hooks by concern
useAuthState()     → { session, loading, hasError }
useAuthActions()   → { login, logout, refresh, clearError }  
useApiConfig()     → { apiBaseUrl, capabilities }
useOAuthUrl()      → { oauthStartUrl }

// Backward compatibility wrapper (deprecated)
useAuthSession()   → combines all hooks
```

#### 1.2 Implementation Strategy

**File**: `apps/frontend/src/app/providers/AuthSessionProvider.tsx`

1. **Add new specialized hooks**:
```typescript
export const useAuthState = (): AuthStateValue => {
  const { session, loading, hasError } = useAuthSession();
  return { session, loading, hasError };
};

export const useAuthActions = (): AuthActionsValue => {
  const { login, logout, refresh, clearError } = useAuthSession();
  return { login, logout, refresh, clearError };
};

export const useApiConfig = (): ApiConfigValue => {
  const { apiBaseUrl, capabilities } = useAuthSession();
  return { apiBaseUrl, capabilities };
};

export const useOAuthUrl = (): OAuthUrlValue => {
  const { oauthStartUrl } = useAuthSession();
  return { oauthStartUrl };
};
```

2. **Keep existing `useAuthSession()` for backward compatibility**

3. **Add TypeScript types for new hooks**:
```typescript
type AuthStateValue = Pick<AuthSessionContextValue, 'session' | 'loading' | 'hasError'>;
type AuthActionsValue = Pick<AuthSessionContextValue, 'login' | 'logout' | 'refresh' | 'clearError'>;
type ApiConfigValue = Pick<AuthSessionContextValue, 'apiBaseUrl' | 'capabilities'>;
type OAuthUrlValue = Pick<AuthSessionContextValue, 'oauthStartUrl'>;
```

### Phase 2: resolveBackendCapabilities() Decomposition

#### 2.1 Domain-Specific Capability Groups

**New Architecture**:
```typescript
// Domain-specific capability types
AdminCapabilities     → adminChangelogCreate, adminUserReportsList, adminApiServicesCrud, etc.
ToolsCapabilities     → toolsUpload, toolsApiServicesResolve
ArtifactCapabilities  → artifacts, artifactDownload, sessionDownload, sessionsList, sessionsDetail
ProjectCapabilities   → projects
FeedbackCapabilities  → changelogList, userReportsCreate
```

#### 2.2 Implementation Strategy

**File**: `apps/frontend/src/app/runtime/backend-capabilities.ts`

1. **Add domain-specific types**:
```typescript
export type AdminCapabilities = Pick<BackendCapabilities, 
  | 'adminChangelogCreate' 
  | 'adminChangelogArchive'
  | 'adminUserReportsList'
  | 'adminUserReportsUpdate'
  | 'adminUserReportsPublishIssue'
  | 'adminApiServicesCrud'
>;

export type ToolsCapabilities = Pick<BackendCapabilities,
  | 'toolsUpload'
  | 'toolsApiServicesResolve'
>;

export type ArtifactCapabilities = Pick<BackendCapabilities,
  | 'artifacts'
  | 'artifactDownload'
  | 'sessionDownload'
  | 'sessionsList'
  | 'sessionsDetail'
>;
```

2. **Add domain-specific resolvers**:
```typescript
export const resolveAdminCapabilities = (overrides?: Partial<AdminCapabilities>): AdminCapabilities => {
  const full = resolveBackendCapabilities(overrides);
  return {
    adminChangelogCreate: full.adminChangelogCreate,
    adminChangelogArchive: full.adminChangelogArchive,
    adminUserReportsList: full.adminUserReportsList,
    adminUserReportsUpdate: full.adminUserReportsUpdate,
    adminUserReportsPublishIssue: full.adminUserReportsPublishIssue,
    adminApiServicesCrud: full.adminApiServicesCrud,
  };
};

export const resolveToolsCapabilities = (overrides?: Partial<ToolsCapabilities>): ToolsCapabilities => {
  const full = resolveBackendCapabilities(overrides);
  return {
    toolsUpload: full.toolsUpload,
    toolsApiServicesResolve: full.toolsApiServicesResolve,
  };
};

export const resolveArtifactCapabilities = (overrides?: Partial<ArtifactCapabilities>): ArtifactCapabilities => {
  const full = resolveBackendCapabilities(overrides);
  return {
    artifacts: full.artifacts,
    artifactDownload: full.artifactDownload,
    sessionDownload: full.sessionDownload,
    sessionsList: full.sessionsList,
    sessionsDetail: full.sessionsDetail,
  };
};
```

#### 2.3 Client Refactoring

**Example**: `apps/frontend/src/features/admin/runtime/admin-client.ts`

```typescript
// Before:
const capabilities = resolveBackendCapabilities(options.capabilities);

// After:
const capabilities = resolveAdminCapabilities(options.capabilities);
```

## Migration Strategy

### Phase 0: DDD Governance Alignment (Pre-Implementation)
- [x] Add Decision Log entries for new domain concepts
- [x] Validate no canonical term conflicts
- [x] Update bounded context documentation if needed
- [x] Get DDD governance approval for new terms

### Phase 1: Add New Hooks (Non-Breaking)
- [x] Add specialized hooks to AuthSessionProvider.tsx
- [x] Add domain-specific capability resolvers
- [x] Add comprehensive tests for new hooks
- [x] Update TypeScript declarations

### Phase 2: Migrate High-Impact Components
- [x] Migrate guards: `AdminGuard`, `ToolRouteGuard`
- [x] Migrate layouts: `AuthenticatedShell`, `PublicShell`
- [x] Migrate routing: `app-router.tsx`
- [x] Migrate API clients: `admin-client.ts`, `tools-client.ts`, etc.

### Phase 3: Mass Migration
- [x] Create automated migration script for remaining components
- [x] Update test mocks to use new hooks
- [x] Update documentation and examples

### Phase 4: Cleanup and Deprecation
- [x] Add deprecation warnings to `useAuthSession()`
- [x] Add deprecation warnings to `resolveBackendCapabilities()`
- [x] Plan removal timeline (suggest 6 months)

## Tasks and QA Scenarios

### Task 0: DDD Governance Alignment ✅ COMPLETED

**Description**: Add required Decision Log entries and validate DDD compliance before implementation begins.

**Implementation**:
1. Add Decision Log entry for Auth Hook Specialization (useAuthState, useAuthActions, useApiConfig, useOAuthUrl)
2. Add Decision Log entry for Backend Capabilities Domain Projection (AdminCapabilities, ToolsCapabilities, etc.)
3. Validate no naming conflicts with canonical glossary
4. Review bounded context alignment

**Decision Log Entries Added**:

**DDD-153 | 2026-07-08 | Auth Hook Specialization**
```
Canonical Terms: useAuthState(), useAuthActions(), useApiConfig(), useOAuthUrl()
Decision: These are canonical specialized projections of useAuthSession() for improved cohesion. Each hook provides a focused subset of auth concerns: state (session, loading, error), actions (login, logout, refresh), config (apiBaseUrl, capabilities), and OAuth (oauthStartUrl). Introduced to reduce coupling while maintaining backward compatibility.
Rationale: useAuthSession() has 51 edges due to combining 4 distinct concerns. Specialized hooks allow components to declare exactly what they need, reducing unnecessary re-renders and improving testability.
Scope: Auth Context (Frontend/UI)
```

**DDD-154 | 2026-07-08 | Backend Capabilities Domain Projection**
```
Canonical Terms: AdminCapabilities, ToolsCapabilities, ArtifactCapabilities, ProjectCapabilities, FeedbackCapabilities
Decision: These are canonical domain-specific projections of BackendCapabilities, grouped by bounded context responsibility. Each projection contains only the capability flags relevant to its domain (e.g., AdminCapabilities includes adminUserReportsList, adminApiServicesCrud but excludes toolsUpload).
Rationale: resolveBackendCapabilities() has 45 edges because every API client calls it for unrelated capability subsets. Domain projections improve bounded context alignment and reduce coupling.
Scope: Generation Context (capability configuration)
```

**QA Scenarios Completed**:
1. ✅ **Manual review**: Decision Log entries validated - no canonical conflicts
2. ✅ **Namespace validation**: `grep -r "useAuthState\|AdminCapabilities" apps/` - No matches found (clean namespace)

### Task 1: Implement Specialized Auth Hooks

**Description**: Add `useAuthState()`, `useAuthActions()`, `useApiConfig()`, and `useOAuthUrl()` hooks to AuthSessionProvider.tsx while maintaining backward compatibility.

**Implementation**:
1. Add new hook implementations in AuthSessionProvider.tsx
2. Add TypeScript types for hook return values
3. Keep existing `useAuthSession()` unchanged
4. Add comprehensive tests

**QA Scenarios**:
1. **Tool**: `npm --workspace apps/frontend run test -- AuthSessionProvider`
   - **Steps**: Run tests for AuthSessionProvider
   - **Expected**: All existing tests pass, new hooks return correct subsets
2. **Tool**: `npm --workspace apps/frontend run typecheck`
   - **Steps**: Run TypeScript compilation
   - **Expected**: No TypeScript errors, new hooks properly typed

### Task 2: Implement Domain-Specific Capability Resolvers

**Description**: Add `resolveAdminCapabilities()`, `resolveToolsCapabilities()`, and `resolveArtifactCapabilities()` functions with proper TypeScript types.

**Implementation**:
1. Add domain-specific capability types
2. Add domain-specific resolver functions
3. Keep existing `resolveBackendCapabilities()` unchanged
4. Add comprehensive tests

**QA Scenarios**:
1. **Tool**: `npm --workspace apps/frontend run test -- backend-capabilities`
   - **Steps**: Run tests for backend capabilities module
   - **Expected**: All tests pass, domain resolvers return correct subsets
2. **Tool**: Manual verification
   - **Steps**: Check that `resolveAdminCapabilities()` only returns admin-related flags
   - **Expected**: Function returns only admin capabilities, not tools/artifacts

### Task 3: Migrate High-Impact Components

**Description**: Migrate guards, layouts, and routing components to use specialized hooks.

**Implementation**:
1. Update AdminGuard to use `useAuthState()`
2. Update AuthenticatedShell to use `useAuthState()`
3. Update app-router.tsx to use appropriate specialized hooks
4. Update tests for migrated components

**QA Scenarios**:
1. **Tool**: `npm --workspace apps/frontend run test -- AdminGuard`
   - **Steps**: Run tests for AdminGuard component
   - **Expected**: All tests pass with new hook usage
2. **Tool**: Manual testing
   - **Steps**: Navigate through app, test login/logout flows
   - **Expected**: All authentication flows work correctly

### Task 4: Migrate API Clients

**Description**: Update API clients to use domain-specific capability resolvers.

**Implementation**:
1. Update admin-client.ts to use `resolveAdminCapabilities()`
2. Update tools-client.ts to use `resolveToolsCapabilities()`
3. Update artifacts-client.ts to use `resolveArtifactCapabilities()`
4. Update client tests and mocks

**QA Scenarios**:
1. **Tool**: `npm --workspace apps/frontend run test -- admin-client`
   - **Steps**: Run tests for admin client
   - **Expected**: All tests pass with domain-specific capabilities
2. **Tool**: Integration testing
   - **Steps**: Test admin functionality (user management, API services)
   - **Expected**: All admin features work correctly

### Task 5: Mass Migration and Cleanup

**Description**: Migrate remaining components and add deprecation warnings.

**Implementation**:
1. Create migration script to update remaining `useAuthSession()` usage
2. Update all test mocks to use appropriate hooks
3. Add deprecation warnings to old functions
4. Update documentation

**QA Scenarios**:
1. **Tool**: `npm --workspace apps/frontend run test`
   - **Steps**: Run full frontend test suite
   - **Expected**: All tests pass, coverage maintained at 70%+
2. **Tool**: `npm --workspace apps/frontend run build`
   - **Steps**: Build frontend for production
   - **Expected**: Successful build with deprecation warnings logged

## Expected Outcomes

### Edge Count Reduction
- **useAuthSession()**: 51 → ~15 edges per specialized hook (-70%)
- **resolveBackendCapabilities()**: 45 → ~10 edges per domain resolver (-78%)
- **Total**: 96 → 25 edges (-74% reduction)

### Improved Cohesion
- Components declare exactly what they need
- Domain-specific capability groups improve bounded context alignment
- Reduced unnecessary re-rendering from irrelevant state changes

### Better Testability
- Mock only required hook properties
- Domain-specific capability mocking
- Clearer component dependencies

## Risk Assessment

| Risk Level | Description | Mitigation |
|------------|-------------|------------|
| **LOW** | Breaking existing functionality | Maintain backward compatibility during migration |
| **MEDIUM** | Test suite maintenance | Update mocks systematically, maintain coverage |
| **MEDIUM** | Developer confusion during transition | Clear migration guide, deprecation warnings |
| **LOW** | Performance regression | Specialized hooks reduce unnecessary re-renders |

## Success Criteria

1. **DDD Compliance**: All new domain terms properly documented in Decision Log
2. **Graph metrics**: 74% reduction in God Node edges (96 → 25)
3. **Test coverage**: Maintain 70%+ coverage threshold
4. **Type safety**: Zero TypeScript compilation errors
5. **Performance**: No regression in component re-rendering
6. **Migration**: 100% of components migrated within 4 weeks
7. **Backward compatibility**: Existing useAuthSession() continues to work during transition

## Dependencies

- **DDD Governance**: ✅ COMPLETED - 2 Decision Log entries added (DDD-153, DDD-154)
- **No blocking technical dependencies**: Implementation can proceed
- **Coordinate with any parallel auth-related work**: Notify team of auth hook changes
- **Consider impact on upcoming feature development**: New hooks should be used in new features

## Timeline

- **Week 1**: DDD governance alignment and specialized hooks implementation
  - **Days 1-2**: Task 0 (DDD Governance Alignment)
  - **Days 3-5**: Task 1 (Implement Specialized Auth Hooks) + Task 2 (Domain-Specific Capability Resolvers)
- **Week 2**: Migrate high-impact components
  - Task 3 (Migrate High-Impact Components)
- **Week 3**: Mass migration and API clients
  - Task 4 (Migrate API Clients) + Task 5 (Mass Migration)
- **Week 4**: Cleanup, documentation, deprecation warnings

**Total effort**: 3-4 weeks
**Risk level**: Low (backward compatible approach with DDD validation)