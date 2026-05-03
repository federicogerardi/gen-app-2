---
status: draft
author: Code Review
date: 2026-05-03
scope: artifact-checkpoint-recovery-frontend-sync
tags: [code-review, ddd-alignment, overengineering, duplication]
---

# Checkpoint Recovery Code Review — Overengineering & Duplication Analysis

## Executive Summary

The artifact checkpoint recovery implementation (`scope-artifact-checkpoint-recovery-alignment-1.md` completed 2026-05-03) respects DDD constraints (`ArtifactRelaunch`, `HydrationResult`, `ReadinessSnapshot`) but introduces **3 major vectors of unnecessary complexity**:

1. **Utility function duplication** — `randomId()`, `normalize()` / `normalizeToolKey()`, `readInputString()`
2. **Repeated filtering logic** — 4 near-identical functions in `step-hydration.ts` filtering by tool + project
3. **Access pattern repetition** — `sourceRequest.input?.step` accessed in 6+ locations without abstraction

### Impact Assessment
- **Maintainability**: ⚠️ High — Changes in one location require updates in 3-5 places
- **Bug surface**: ⚠️ High — Silent drift when bugfix applied to one utility but not others
- **Readability**: ⚠️ Medium — Repeated patterns obscure intent
- **DDD Consistency**: ✅ No issues — canonical terms used correctly

---

## Finding 1: Utility Function Duplication

### The Problem

#### `randomId()` — Defined 3 Times

**Location A**: `frontend/src/features/generation/ui/artifact-history.ts:88-93`
```ts
const randomId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}`;
};
```

**Location B**: `frontend/src/features/tools/ui/ToolPageTemplate.tsx:28-33`
```ts
const randomId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}`;
};
```

**Location C**: `frontend/src/features/generation/ui/GenerationForm.tsx:48-53`
```ts
const randomId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}`;
};
```

**Impact**: 3 copies = 1 bug fix needed in 3 places, browser compatibility issues propagate if missed.

---

### Finding 2: String Normalization Duplication

#### `normalize()` Pattern — 3 Variants

**Variant A** — `step-hydration.ts:6-11`
```ts
const normalize = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/_/g, '-');
  return normalized.length > 0 ? normalized : null;
};
```

**Variant B** — `artifact-history.ts:94-99` (named `normalizeToolKey()`)
```ts
const normalizeToolKey = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/_/g, '-');
  return normalized.length > 0 ? normalized : null;
};
```

**Variant C** — `tool-entry-params.ts:28-29`
```ts
const normalized = value.trim();
return normalized.length > 0 ? normalized : null;
```

**Problem**: Same logic, different names, varying levels of normalization (kebab-case conversion).

---

### Finding 3: String Value Reading Pattern — Repeated 5+ Times

**Pattern**: `readInputString()` pattern exists independently in:
- `ToolPageTemplate.tsx:36-42` — reads `artifact?.sourceRequest.input?.[key]`
- `ToolPageTemplate.tsx:217` — `readInputString(sourceArtifact, 'briefingFileName')`
- `GenerationWorkspaceProvider.tsx:118-119` — inline `readInputString(request, 'briefingFileName')`
- `step-hydration.ts` — accesses via `artifact.sourceRequest.input?.step` (no extraction)

**Impact**: 4 different implementations; normalization rules may diverge.

---

## Finding 2: Repeated Filtering Logic in `step-hydration.ts`

### The Problem

Four functions in `step-hydration.ts` repeat the same filtering pattern:

```ts
// Pattern used in 4 functions:
// 1. belongsToTool()
// 2. collectCompletedStepsByTool()
// 3. buildLatestArtifactByStep()
// 4. collectCompletedRunSteps()

const normalizedProjectId = projectId.trim();
if (!normalizedProjectId) return ...;

return filtered
  .filter((artifact) => artifact.projectId === normalizedProjectId && belongsToTool(artifact, toolKey))
  .filter(...)
  .map(...)
```

### Current Implementation

```ts
// Function 1
export const belongsToTool = (artifact, toolKey) => {
  const candidates = [
    normalize(artifact.toolKey),
    normalize(artifact.workflowType),
    normalize(artifact.sourceRequest.toolKey),
    normalize(artifact.sourceRequest.workflowType),
  ];
  return candidates.includes(toolKey);
};

// Function 2
export const collectCompletedStepsByTool = (artifacts, toolKey, projectId) => {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) return new Set();
  return new Set(
    artifacts
      .filter(a => a.projectId === normalizedProjectId && a.status === 'completed' && belongsToTool(a, toolKey))
      .map(a => a.sourceRequest.input?.step)
      .filter(s => typeof s === 'string')
  );
};

// Function 3
export const buildLatestArtifactByStep = (artifacts, toolKey, projectId) => {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) return {};
  const sorted = [...artifacts]
    .filter(a => a.projectId === normalizedProjectId && belongsToTool(a, toolKey))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return sorted.reduce((acc, a) => {
    const step = a.sourceRequest.input?.step;
    if (typeof step !== 'string') return acc;
    if (!acc[step]) acc[step] = a;
    return acc;
  }, {});
};

// Function 4
export const collectCompletedRunSteps = (artifacts, toolKey, projectId, runRequestPrefix) => {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId || !runRequestPrefix.trim()) return new Set();
  return new Set(
    artifacts
      .filter(a => 
        a.projectId === normalizedProjectId 
        && a.status === 'completed'
        && typeof a.requestId === 'string'
        && a.requestId.startsWith(`${runRequestPrefix}:`)
        && belongsToTool(a, toolKey)
      )
      .map(a => a.sourceRequest.input?.step)
      .filter(s => typeof s === 'string')
  );
};
```

### DDD Alignment Check

✅ **Correct**: Uses canonical term `SupportedTool` and respects `ExtractionContext` concept.

❌ **Overengineered**: 4 functions when 1-2 composable helpers would suffice.

---

## Finding 3: Duplicate Checkpoint Selection Logic

### Current Scatter

- `tool-checkpoints.ts:26-37` — `sortCheckpointsForResume()` + `selectBestCheckpointForProject()`
- `GenerationForm.tsx:104-108` — duplicate call and logic
- `tool-ux-state.ts` — derives state but repeats priority logic

### Current Implementation

```ts
// tool-checkpoints.ts (single definition)
const checkpointPriority: Record<ToolCheckpointStatus, number> = {
  generating: 0,
  completed_partial: 1,
  completed: 2,
  failed_hard: 3,
};

export const sortCheckpointsForResume = (checkpoints) => {
  return [...checkpoints].sort((a, b) => {
    const byPriority = checkpointPriority[a.status] - checkpointPriority[b.status];
    if (byPriority !== 0) return byPriority;
    return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
  });
};

export const selectBestCheckpointForProject = (checkpoints, projectId) => {
  const normalizedProjectId = projectId.trim();
  if (normalizedProjectId.length === 0) return null;
  const filtered = checkpoints.filter(c => c.projectId === normalizedProjectId);
  if (filtered.length === 0) return null;
  return sortCheckpointsForResume(filtered)[0] ?? null;
};
```

### Usage in `GenerationForm.tsx`

```ts
const checkpointsForProject = sortCheckpointsForResume(
  checkpoints.filter((checkpoint) => checkpoint.projectId === projectId.trim()),
);
const selectedCheckpoint = selectedCheckpointArtifactId
  ? checkpointsForProject.find((checkpoint) => checkpoint.artifactId === selectedCheckpointArtifactId) ?? null
  : selectBestCheckpointForProject(checkpointsForProject, projectId);
```

**Problem**: `checkpointsForProject` filter + sort repeated; `selectBestCheckpointForProject()` could handle the entire flow in one call.

---

## Finding 4: Repeated `sourceRequest.input?.step` Access

### Locations

1. `step-hydration.ts:42` — `collectCompletedStepsByTool()`
2. `step-hydration.ts:62` — `buildLatestArtifactByStep()`
3. `step-hydration.ts:96` — `collectCompletedRunSteps()`
4. `tool-page.machine.ts:261` — `readArtifactStep()`
5. `tool-page.machine.ts:268` — `readStepDependencyArtifactIdsByStep()`
6. `ToolPageTemplate.tsx:217` — `readInputString(sourceArtifact, ...)`

**DDD Gap**: No canonical abstraction for **step extraction from an artifact's source request**. The concept exists (part of `HydrationResult`) but the accessor pattern is scattered.

---

## Recommendations

### R-001: Extract Utility Functions to `frontend/src/app/runtime/shared-utils.ts`

**Action**:
```ts
// shared-utils.ts
export const generateRequestId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}`;
};

export const normalizeIdentifier = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace(/_/g, '-');
  return normalized.length > 0 ? normalized : null;
};

export const readInputField<T = string>(
  artifact: GenerationArtifact | null,
  key: string,
): T | null => {
  const value = artifact?.sourceRequest.input?.[key];
  if (typeof value === 'string' && (value as unknown) instanceof T) {
    return (value.trim().length > 0 ? value : null) as T;
  }
  return null;
};
```

**Impact**: 1 location, 3 files updated, eliminates 90% of duplication.

---

### R-002: Compose `step-hydration.ts` Helpers with a Single Filter Builder

**Current**:
```ts
// 4 functions with repeated logic
belongsToTool()
collectCompletedStepsByTool()
buildLatestArtifactByStep()
collectCompletedRunSteps()
```

**Proposed**:
```ts
type ArtifactFilterCriteria = {
  projectId?: string;
  toolKey?: SupportedTool;
  status?: 'completed';
  runRequestPrefix?: string;
};

const filterArtifactsForStep = (
  artifacts: GenerationArtifact[],
  criteria: ArtifactFilterCriteria,
): GenerationArtifact[] => {
  return artifacts.filter((a) => {
    if (criteria.projectId && a.projectId !== criteria.projectId.trim()) return false;
    if (criteria.toolKey && !belongsToTool(a, criteria.toolKey)) return false;
    if (criteria.status && a.status !== criteria.status) return false;
    if (criteria.runRequestPrefix) {
      const prefix = criteria.runRequestPrefix.trim();
      if (!a.requestId.startsWith(`${prefix}:`)) return false;
    }
    return true;
  });
};

export const collectCompletedStepsByTool = (
  artifacts,
  toolKey,
  projectId,
) => {
  return new Set(
    filterArtifactsForStep(artifacts, {
      projectId,
      toolKey,
      status: 'completed',
    })
      .map((a) => a.sourceRequest.input?.step)
      .filter((s): s is ToolStep => typeof s === 'string')
  );
};
```

**Impact**: Reduces 4 functions to 1 + 4 callsites, removes ~50% code duplication.

---

### R-003: Unify Step Extraction Pattern

**Current**:
```ts
// Scattered across 6 locations
const step = artifact?.sourceRequest.input?.step;
if (typeof step !== 'string') return null;
```

**Proposed**:
```ts
// step-hydration.ts
export const extractArtifactStep = (artifact: GenerationArtifact | null): ToolStep | null => {
  const step = artifact?.sourceRequest.input?.step;
  return typeof step === 'string' ? (step as ToolStep) : null;
};

// Usage
const step = extractArtifactStep(artifact);
```

**Impact**: 6 callsites consolidated to 1 helper; consistency guaranteed.

---

### R-004: Simplify Checkpoint Selection

**Current**:
```ts
const checkpointsForProject = sortCheckpointsForResume(
  checkpoints.filter((checkpoint) => checkpoint.projectId === projectId.trim()),
);
const selectedCheckpoint = selectedCheckpointArtifactId
  ? checkpointsForProject.find(...) ?? null
  : selectBestCheckpointForProject(checkpointsForProject, projectId);
```

**Proposed**:
```ts
// tool-checkpoints.ts
export const selectCheckpointForProject = (
  checkpoints: ToolCheckpoint[],
  projectId: string,
  preferredCheckpointId?: string,
): ToolCheckpoint | null => {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) return null;
  
  const filtered = checkpoints.filter((c) => c.projectId === normalizedProjectId);
  if (filtered.length === 0) return null;
  
  if (preferredCheckpointId) {
    return filtered.find((c) => c.artifactId === preferredCheckpointId) ?? null;
  }
  
  return sortCheckpointsForResume(filtered)[0] ?? null;
};

// Usage in GenerationForm
const selectedCheckpoint = selectCheckpointForProject(
  checkpoints,
  projectId,
  selectedCheckpointArtifactId || undefined,
);
```

**Impact**: Consolidates 2-4 separate calls into 1 unified API.

---

## DDD Compliance Assessment

✅ **No DDD violations** — all refactoring targets are implementation details, not domain concepts.

- `ArtifactRelaunch` — remains canonical entry concept
- `HydrationResult` — deterministic resolution preserved
- `ReadinessSnapshot` / `ReadinessReasonCode` — canonical reason codes untouched
- `ExtractionContext` — canonical term preserved

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Circular dependencies in shared-utils.ts | Low | Place utilities in `app/runtime/`, import only from features, never reverse. |
| Test coverage regression | Medium | Add unit tests for each consolidated function before removal of originals. |
| Naming confusion post-refactor | Low | Use precise names: `generateRequestId()` not `id()`, `normalizeIdentifier()` not `normalize()`. |

---

## Summary Table

| Category | Issue | Count | Complexity | Fix Effort |
|----------|-------|-------|-----------|-----------|
| Utility duplication | `randomId()` defined 3x | 3 | Low | 1 hour |
| String normalization | `normalize()` variants | 3+ | Low | 1 hour |
| Hydration filtering | Repeated filter logic | 4 | Medium | 2-3 hours |
| Step extraction | `sourceRequest.input?.step` pattern | 6+ | Low | 1 hour |
| Checkpoint selection | Multiple call patterns | 2-4 | Low | 1 hour |
| **Total** | | **18+** | **Medium** | **6-7 hours** |

---

## Acceptance Criteria for Cleanup

- [ ] Single source of truth for `generateRequestId()`, `normalizeIdentifier()`, `readInputField()`
- [ ] `step-hydration.ts` helpers consolidated to ≤2 functions + 1 filter builder
- [ ] `extractArtifactStep()` replaces 6+ inline patterns
- [ ] Checkpoint selection unified to ≤2 API points
- [ ] All tests passing; no regressions vs current state
- [ ] No new DDD drift introduced
