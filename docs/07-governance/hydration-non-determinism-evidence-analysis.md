---
status: evidence-audit
version: 1.1
reviewed-on: 2026-05-20 (DDD-075 added)
finding-anchor: architecture-weaknesses-code-review-2026-05-18.md (CRITICAL)
---

# Hydration Non-Determinism vs. Requested Briefing — Evidence Analysis

## Executive Summary
The `tools-hydrate-handlers.ts` endpoint resolves a `resolvedBriefingId` from the request payload but **does not use it during candidate ranking**. The ranking considers only `sourceExtractionArtifactId` (exact match) and recency (updatedAt); briefing context is discarded. This violates the domain contract that `ExtractionContext` and `Briefing` are semantically paired concepts (DDD-007, DDD-038).

---

## Evidence Trail

### 1. Resolution Phase: `resolvedBriefingId` IS Computed

**File**: [apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts](apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L95)  
**Lines**: 95, 144, 148

```typescript
// Line 95: Initial resolution from request body
let resolvedBriefingId = typeof body.resolvedBriefingId === 'string' ? body.resolvedBriefingId.trim() || null : null;

// ...

// Lines 100-130: If sourceArtifactId is an extraction artifact
if (artifact.artifactType === 'extraction') {
  const briefingId = (typeof artifact.input.briefingId === 'string' && artifact.input.briefingId.trim())
    ? artifact.input.briefingId.trim()
    : artifact.artifactId;
  
  // ...

  // Line 144: Update resolvedBriefingId if not already set
  resolvedBriefingId = resolvedBriefingId ?? briefingId;
}

// Lines 131-142: If sourceArtifactId is NOT an extraction artifact
else {
  const artifactBriefingId = typeof artifact.input.briefingId === 'string' ? artifact.input.briefingId.trim() || null : null;
  const artifactExtractionArtifactId = typeof artifact.input.extractionArtifactId === 'string' ? artifact.input.extractionArtifactId.trim() || null : null;
  
  // Line 148: Update resolvedBriefingId from the artifact
  resolvedBriefingId = resolvedBriefingId ?? artifactBriefingId;
  sourceExtractionArtifactId = sourceExtractionArtifactId ?? artifactExtractionArtifactId;
}
```

**Status**: ✅ `resolvedBriefingId` IS resolved and carried through the handler flow.

---

### 2. Ranking Phase: `resolvedBriefingId` Is IGNORED

**File**: [apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts](apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L148-L180)  
**Lines**: 148-180 (candidate sorting) + 182 (candidate selection)

```typescript
// Lines 159-164: Query all extraction artifacts for the project
const candidates = await queries.artifacts.listArtifactsByUser(principal.user.id, {
  type: 'extraction',
  status: 'completed',
  projectId,
});

// Lines 170-178: Sort candidates — PROBLEM IS HERE
const ranked = [...candidates].sort((a, b) => {
  // Check if candidate matches sourceExtractionArtifactId (exact match)
  const aIsSource = sourceExtractionArtifactId != null && a.artifactId === sourceExtractionArtifactId ? 1 : 0;
  const bIsSource = sourceExtractionArtifactId != null && b.artifactId === sourceExtractionArtifactId ? 1 : 0;
  
  // Rank by exact match first
  if (aIsSource !== bIsSource) {
    return bIsSource - aIsSource;
  }
  
  // Then by recency (updatedAt) — NO briefingId COMPARISON
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
});

// Line 182: Select the highest-ranked candidate
const best = ranked[0]!;
```

**Status**: ❌ **Ranking ignores `resolvedBriefingId` completely.** Only two criteria are considered:
1. Does the artifact match `sourceExtractionArtifactId`? (binary: 0 or 1)
2. How recent is the artifact? (Date comparison)

**Missing Criterion**: Filter or rank by `resolvedBriefingId` coherence.

---

### 3. Debug Log: `resolvedBriefingId` Is Logged but Unused

**File**: [apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts](apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L195-L210)  
**Lines**: 195-210

```typescript
debugLog('[auth-http] hydrate ranked extraction artifact resolved', {
  sourceArtifactId,
  sourceExtractionArtifactId,
  resolvedBriefingId,                // ← LOGGED but not used in ranking
  rankedCandidateCount: ranked.length,
  selectedArtifactId: bestDetail.artifactId,
  projectId,
  briefingId: bestDetail.input.briefingId || bestDetail.artifactId,  // ← Selected artifact's briefingId
  normalizedTextLength: normalizedText.trim().length,
  extractionPayloadKeys: Object.keys(extractionPayload).length,
  parsedFormat,
});
```

**Status**: ⚠️ The debug log logs the `resolvedBriefingId` **input**, but the selected artifact's `briefingId` **output** may be semantically unrelated.

---

### 4. Domain Contract Violation

**Reference**: [docs/01-requirements/domain-ubiquitous-language-glossary.md](docs/01-requirements/domain-ubiquitous-language-glossary.md) (ExtractionContext definition)

**Glossary Entry**: ExtractionContext is defined as:
> The structured payload extracted from a `BriefingFile` by the backend `ExtractionChain`. [...] Source of authority: BE `ExtractionChain`; FE type definition in `frontend-stream.machine.ts` is a projection/consumer type.

**Semantic Coupling** (DDD-038, DDD-021):
- `ExtractionContext` and `Briefing` are **canonical paired concepts**.
- Before dispatch, `GenerationRequest.input` must carry:
  - Non-empty `briefingText`
  - Structured `extractionPayload` corresponding to that briefing
  - Consistent `briefingId` that identifies the source briefing

**Risk**: Hydration returns an extraction context from `briefing_A` when the request specified `briefing_B`, leading to semantic incoherence and wrong generation context.

---

### 5. Concrete Failure Scenario

**Precondition**:
- Project has two extraction artifacts:
  - Artifact A: `briefingId='brief_marketing'`, `updatedAt='2026-05-10'`
  - Artifact B: `briefingId='brief_sales'`, `updatedAt='2026-05-20'` (more recent)

**Request**:
```json
POST /api/tools/hydrate
{
  "projectId": "proj-001",
  "resolvedBriefingId": "brief_marketing",
  "sourceExtractionArtifactId": null
}
```

**Expected Behavior** (correct):
1. `resolvedBriefingId = 'brief_marketing'` is resolved
2. Ranking filters/prioritizes Artifact A (matching briefing)
3. Response carries extraction context from Artifact A

**Actual Behavior** (broken):
1. `resolvedBriefingId = 'brief_marketing'` is resolved
2. Ranking ignores briefing and returns Artifact B (most recent)
3. Response carries extraction context from Artifact B (`brief_sales`)
4. Frontend receives hydration for wrong briefing
5. GenerationRequest is executed with incoherent context

**Impact**: User intends generation for `marketing` domain; system generates for `sales` domain.

---

## Root Cause Analysis

### Why the Bug Exists

1. **Incomplete Specification**: The ranking algorithm was written to prioritize `sourceExtractionArtifactId` (explicit artifact reference) and recency as tiebreaker. No `resolvedBriefingId` filtering logic was added.

2. **Fallback Logic Oversight**: The endpoint was designed to handle **fallback** hydration when no explicit artifact ID is provided. The fallback case was not extended to consider briefing coherence.

3. **DDD Boundary Gap**: The domain contract (ExtractionContext ↔ Briefing pairing) was not enforced at the API boundary. The handler treats briefing as optional context rather than a required ranking criterion.

---

## Scope of Affected Code Paths

| Path | Affected | Severity | Notes |
| --- | --- | --- | --- |
| `/api/tools/hydrate` with explicit `resolvedBriefingId` | ✅ YES | HIGH | Briefing intent is ignored during fallback ranking |
| `/api/tools/hydrate` with explicit `sourceExtractionArtifactId` | ✅ Partially | MEDIUM | If the specified artifact has a different `briefingId`, semantic mismatch is silent |
| Artifact-driven relaunch (artifact detail hydration) | ✅ YES | HIGH | HydrationResult completeness gate may accept incoherent context |
| Session recovery with multiple briefings | ✅ YES | CRITICAL | Session that evolved across multiple briefings may relaunch with wrong context |

---

## Cross-References

### Domain Glossary & Decisions
- **DDD-007**: `ExtractionContext` canonical term definition
- **DDD-021**: `ExtractionContext` completeness enforcement at step dispatch
- **DDD-038**: `HydrationResult` completeness contract (incomplete without briefing alignment)
- **DDD-042**: ExtractionContext schema and tone semantics (briefing-derived tone must not be conflated)
- **DDD-051, DDD-052**: `SessionSummary` and `SessionArtifactGroup` multi-briefing session support

### Related Architecture Documents
- [architecture-weaknesses-code-review-2026-05-18.md](architecture-weaknesses-code-review-2026-05-18.md) — CRITICAL finding
- [domain-bounded-context-map.md](../02-design/domain-bounded-context-map.md) — ExtractionContext pairing constraint

---

## Remediation Checklist

**Status**: DDD-075 approved 2026-05-20. Documentation gate cleared. Ready for implementation planning.

- [x] **DDD Governance Gate (COMPLETED 2026-05-20)**: Decision entry `DDD-075: Hydration Briefing Coherence Requirement` registered in [domain-naming-decision-log.md](domain-naming-decision-log.md). Glossary updated with ranking semantics cross-reference.

- [ ] **Tier 1 Correctness Fix**: Modify `tools-hydrate-handlers.ts` ranking to filter candidates by `resolvedBriefingId` coherence before applying `sourceExtractionArtifactId` and recency ranking (per DDD-075).
  - If `resolvedBriefingId` is set, only candidates where `artifact.input.briefingId === resolvedBriefingId` (or fallback `artifact.artifactId` for legacy) are eligible.
  - If no eligible candidate exists, return 404 with explicit reason code (e.g., `no_extraction_for_briefing`).
  - If `resolvedBriefingId` is null, fall through to existing recency-based ranking (backward compat).

- [ ] **Validation Gate**: Add semantic validation in the response payload to verify `briefingId` coherence before returning hydration.

- [ ] **Test Coverage**: Add integration test covering:
  1. Project with multiple extraction artifacts for different briefings (filter by resolvedBriefingId).
  2. Explicit `resolvedBriefingId` request filtering to correct artifact.
  3. Fallback scenario when only one briefing exists.
  4. Legacy artifact without explicit `briefingId` (fallback to artifactId).
  5. Session multi-briefing resume with regenerate intent.

- [x] **Documentation**: [domain-naming-decision-log.md](domain-naming-decision-log.md) updated with `DDD-075: Hydration Briefing Coherence Requirement` decision entry.

---

## Validation Status

| Aspect | Status | Evidence |
| --- | --- | --- |
| `resolvedBriefingId` resolved | ✅ | Lines 95, 144, 148 |
| `resolvedBriefingId` used in ranking | ❌ | Lines 170-178 (absent from sort logic) |
| `resolvedBriefingId` logged | ✅ | Line 203 (debug output) |
| Domain contract (pairing) defined | ✅ | DDD-007, DDD-038, DDD-042 |
| Manifestable in production | ✅ | Multi-briefing fallback scenario |

---

## Conclusion

**The finding is CONFIRMED.** `resolvedBriefingId` is computed but not used during candidate selection. This is a correctness bug with measurable impact on multi-briefing sessions and artifact relaunch scenarios. Remediation requires filtering candidates by briefing coherence before applying recency ranking.

**Severity**: CRITICAL (domain correctness violation)  
**Effort**: Low (targeted ranking logic modification + test coverage)  
**Blocker**: Should be resolved before expanding session reuse or multi-briefing support features.
