---
status: pre-implementation-audit
version: 1.1
completed-on: 2026-05-20
ddd-gate-completed: 2026-05-20 (DDD-075 approved)
finding-anchor: hydration-non-determinism-evidence-analysis.md
---

# Hydration Non-Determinism: Pre-Implementation Audit

## Executive Summary

**Verdict: Fix is feasible with MEDIUM complexity. Hidden effort lurks in:
1. Test framework maturity (low)
2. FE/BE sync is already good (low risk)
3. Legacy artifact compatibility is fragmented (medium-high risk)**

**Realistic Effort: 6-8 hours implementation + 2-4 hours for legacy artifact edge cases**

---

## ✅ Audit 1: FE/BE Sync on `resolvedBriefingId`

### FE: Hydration Machine Passes `resolvedBriefingId`

**File**: [apps/frontend/src/features/tools/machines/hydration.machine.ts](apps/frontend/src/features/tools/machines/hydration.machine.ts#L130-L150)

```typescript
// Lines 130-150
const res = await fetch(`${apiBaseUrl}/api/tools/hydrate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    projectId,
    ...(sourceArtifactId ? { sourceArtifactId } : {}),
    ...(resolvedBriefingId ? { resolvedBriefingId } : {}),  // ✅ PASSED
    ...(sourceExtractionArtifactId ? { sourceExtractionArtifactId } : {}),
    intent,
  }),
});
```

**Status**: ✅ **FE correctly passes `resolvedBriefingId` when present.**

### BE: Receives `resolvedBriefingId` but Ignores It

**File**: [apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts](apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L95)

```typescript
// Line 95: Parsed from request body
let resolvedBriefingId = typeof body.resolvedBriefingId === 'string' ? body.resolvedBriefingId.trim() || null : null;

// Lines 170-178: IGNORED in ranking
const ranked = [...candidates].sort((a, b) => {
  const aIsSource = sourceExtractionArtifactId != null && a.artifactId === sourceExtractionArtifactId ? 1 : 0;
  const bIsSource = sourceExtractionArtifactId != null && b.artifactId === sourceExtractionArtifactId ? 1 : 0;
  if (aIsSource !== bIsSource) return bIsSource - aIsSource;
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);  // Only recency, no briefing filter
});
```

**Status**: ✅ **FE sends, BE receives. ❌ BE does not use.**

### Impact Assessment

| Scenario | Risk | Notes |
| --- | --- | --- |
| FE-BE contract | LOW | Both have aligned intent; only BE action is missing |
| Resume scenario | HIGH | FE passes `resolvedBriefingId` from prior hydration, BE ignores → wrong context |
| Multi-briefing session | HIGH | Session evolved across briefing A → B, relaunch specifies B, BE returns A (most recent) |

**Verdict**: ✅ **Sync is already in place. Fix is isolated to BE ranking logic.**

---

## ✅ Audit 2: Test Setup Analysis

### Test Framework: Mock HTTP Pattern

**File**: [apps/backend/src/lib/tests/runtime.auth-http.test.ts](apps/backend/src/lib/tests/runtime.auth-http.test.ts#L1-80)

```typescript
// Mock classes are simple and well-structured
class MockIncomingMessage extends EventEmitter {
  method: string;
  url: string;
  headers: Record<string, string>;
  socket: { remoteAddress: string | null };
  
  constructor(options: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string;
    remoteAddress?: string | null;
  }) { /* ... */ }
}

class MockServerResponse extends EventEmitter {
  statusCode = 200;
  writableEnded = false;
  setHeader(name: string, value: string | string[]) { /* ... */ }
  end(chunk?: string) { /* ... */ }
  jsonBody(): Record<string, unknown> { /* ... */ }
}
```

**Status**: ✅ **Mature, minimal, easy to extend.**

### Existing Hydrate Test

**File**: [apps/backend/src/lib/tests/runtime.auth-http.test.ts](apps/backend/src/lib/tests/runtime.auth-http.test.ts#L1873-1950)

```typescript
test('auth HTTP runtime hydrates extraction artifact from fenced JSON payload', async () => {
  // 1. Setup: create user, project
  await repositories.users.createUser({ /* ... */ });
  const project = await projectQueries.createProjectForUser('user-hydrate-001', { /* ... */ });
  
  // 2. Seed artifacts via ArtifactQueryRepositoryStub
  artifactQueries.seed([
    {
      artifactId: 'artifact-extract-fenced-001',
      userId: 'user-hydrate-001',
      projectId: project.id,
      artifactType: 'extraction',
      status: 'completed',
      input: {
        briefingId: 'brief-hydrate-001',  // ✅ Briefing ID present
        briefingText: 'brief fenced text',
      },
      content: '```json\n{"payload":{"offer":"audit","audience":"b2b"}}\n```',
      createdAt: '2026-05-05T10:00:00.000Z',
      updatedAt: '2026-05-05T10:00:00.000Z',
    },
  ]);
  
  // 3. Runtime request
  const hydrateRequest = new MockIncomingMessage({
    method: 'POST',
    url: '/api/tools/hydrate',
    headers: { cookie: cookieHeader },
    body: JSON.stringify({
      projectId: project.id,
      sourceArtifactId: 'artifact-extract-fenced-001',
      intent: 'regenerate',
      // NOTE: No resolvedBriefingId passed ← INCOMPLETE TEST
    }),
  });
  
  // 4. Assert response
  const hydrateResponse = new MockServerResponse();
  await runtime.handleRequest(hydrateRequest as unknown as IncomingMessage, hydrateResponse as unknown as ServerResponse);
  assert.equal(hydrateResponse.statusCode, 200);
  const payload = hydrateResponse.jsonBody();
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.data.hydration.extractionPayload, {
    offer: 'audit',
    audience: 'b2b',
  });
});
```

**Test Coverage Gap**: ❌ **Current test does NOT pass `resolvedBriefingId` → cannot verify ranking fix.**

### ArtifactQueryRepositoryStub: `seed()` Pattern

**File**: [apps/backend/src/lib/adapters/postgres-redis.stub.ts](apps/backend/src/lib/adapters/postgres-redis.stub.ts#L285-350)

```typescript
export class ArtifactQueryRepositoryStub implements ArtifactQueryRepository {
  private readonly artifacts = new Map<string, StubArtifactQueryRecord>();
  
  seed(records: StubArtifactQueryRecord[]): void {
    records.forEach((record) => {
      this.artifacts.set(record.artifactId, record);
    });
  }
  
  async listArtifactsByUser(userId: string, filters: ArtifactListFilters): Promise<ArtifactSummary[]> {
    return [...this.artifacts.values()]
      .filter((artifact) => {
        // Filters applied here
        if (artifact.userId !== userId) return false;
        if (filters.type && artifact.artifactType !== filters.type) return false;
        if (filters.status && artifact.status !== filters.status) return false;
        if (filters.projectId && artifact.projectId !== filters.projectId) return false;
        return true;
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))  // Recency sort
      .map((artifact) => ({
        artifactId: artifact.artifactId,
        userId: artifact.userId,
        // ... other fields ...
      }));
  }
}
```

**Status**: ✅ **Well-structured stub. Easy to seed multi-artifact scenarios.**

### Effort Assessment

| Task | Effort | Notes |
| --- | --- | --- |
| Add Scenario 1: Multi-Briefing Project | 1 hour | Seed 2 extraction artifacts, different briefings, request with resolvedBriefingId |
| Add Scenario 2: No Matching Briefing | 30 min | Seed artifacts, request briefing that doesn't exist, assert 404 |
| Add Scenario 3: Fallback (null resolvedBriefingId) | 30 min | Verify backward compat, recency ranking unchanged |
| Add Scenario 4: Explicit Artifact ID Override | 30 min | Seed multi artifacts, request explicit ID, assert rank priority |
| Add Scenario 5: Session Multi-Briefing Resume | 1 hour | Complex: simulate session evolution, test relaunch coherence |

**Total Test Effort**: ~4 hours (including debug time for integration)

**Verdict**: ✅ **Test setup is straightforward. Framework is minimal but sufficient. Effort is linear, no surprises.**

---

## ✅ Audit 3: Legacy Artifact Compatibility

### Current Fallback Logic

**File**: [apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts](apps/backend/src/lib/runtime/auth-http/tools-hydrate-handlers.ts#L100-150)

```typescript
// Lines 100-130: sourceArtifactId is an extraction artifact
if (artifact.artifactType === 'extraction') {
  const briefingId = (typeof artifact.input.briefingId === 'string' && artifact.input.briefingId.trim())
    ? artifact.input.briefingId.trim()
    : artifact.artifactId;  // ← FALLBACK: use artifact ID as briefing ID if missing
  
  // ... extract payload and text ...
  
  if (hasPayload || hasText) {
    // Direct return
    return { hydration: { ... } };
  }
  
  resolvedBriefingId = resolvedBriefingId ?? briefingId;  // ← Set resolved to computed briefing
}
```

**Legacy Pattern Found**: ⚠️ If `artifact.input.briefingId` is missing or empty, system falls back to using `artifactId` as the briefing ID.

### Search for Legacy Artifacts Without `briefingId`

**Grep Results**: 
- Database: No direct schema migration found (implies old artifacts may lack `briefingId`)
- Code: DDD-038 decision log explicitly mentions:
  > "production evidence (2026-05-05) confirmed that historical extraction artifacts do not store a structured payload, yet their `normalizedText` alone is sufficient for `GenerationRequest` assembly."

**Artifact Creation Points**:

1. **Backend Generation System** (`apps/backend/src/lib/machines/generation-persistence.ts`):
   ```typescript
   briefingId: toOptionalString(context.requestInput.briefingId),  // Can be undefined
   ```

2. **Frontend Briefing Upload** (`apps/frontend/src/features/tools/machines/briefing-upload.machine.ts`):
   ```typescript
   briefingId: input.briefingId,  // May be null if not provided
   ```

### Risk Assessment: Legacy Artifacts

| Case | Likelihood | Impact | Handling |
| --- | --- | --- | --- |
| Artifact with no `input.briefingId` | MEDIUM | Fallback to `artifact.artifactId` as briefing ID | Already in code (line 103) |
| Artifact with empty string `briefingId` | MEDIUM | Same as above | Already handled by `||` check |
| Artifact created before briefing schema | LOW | Old artifacts pre-date briefing tracking | No schema version check found |
| Ranking filter `resolvedBriefingId === artifactId` mismatch | HIGH | If filter uses canonical briefing, but legacy artifact uses artifact ID | **ISSUE**: Proposed fix may reject legacy artifacts |

### Proposed Fix Impact on Legacy Artifacts

**Current Fix Logic**:
```typescript
const eligibleCandidates = resolvedBriefingId 
  ? candidates.filter(c => {
      const cBriefingId = c.input?.briefingId?.trim() || c.artifactId;  // ← Fallback
      return cBriefingId === resolvedBriefingId;  // Filter
    })
  : candidates;
```

**Scenario: Legacy Artifact Compatibility**
- User has artifact A (old): `input.briefingId = undefined`, uses fallback `artifactId='artifact_123'`
- User requests hydration: `resolvedBriefingId = 'brief_marketing'` (canonical term)
- Filter applies: `'artifact_123' !== 'brief_marketing'` → artifact rejected ❌

**Risk**: ⚠️ **Legacy artifacts without canonical `briefingId` may be silently rejected.**

### Recommendation: Safe Backward-Compat Fallback

**Enhanced Filter Logic**:
```typescript
const eligibleCandidates = resolvedBriefingId 
  ? candidates.filter(c => {
      const cBriefingId = c.input?.briefingId?.trim() || c.artifactId;
      
      // Match by canonical briefing ID or by artifact ID (legacy fallback)
      const isExactMatch = cBriefingId === resolvedBriefingId;
      const isLegacyFallback = !c.input?.briefingId && c.artifactId === resolvedBriefingId;
      
      return isExactMatch || isLegacyFallback;
    })
  : candidates;
```

**Or Simpler (Recommended)**:
```typescript
const eligibleCandidates = resolvedBriefingId 
  ? candidates.filter(c => {
      // If artifact has explicit briefingId, use it; otherwise use artifactId (legacy)
      const cBriefingId = c.input?.briefingId?.trim() ?? c.artifactId;
      return cBriefingId === resolvedBriefingId;
    })
  : candidates;
```

The second version is simpler and already implements the fallback pattern that exists in current code.

### Verdict

**Status**: ⚠️ **Legacy artifacts exist. Fix must preserve backward compatibility by using artifact ID as fallback briefing ID.**

**Effort Impact**: +30 min to validate fallback logic + test legacy scenarios.

---

## 📊 Final Effort Recalculation

| Phase | Effort | Risk | Notes |
| --- | --- | --- | --- |
| **Code Fix** | 0.5 h | LOW | Straightforward ranking filter addition |
| **Legacy Compat Validation** | 0.5 h | MEDIUM | Ensure fallback works; add defensive filter |
| **Test Scenarios** | 4 h | LOW | Framework is mature; scenarios are additive |
| **FE/BE Sync Verification** | 0.5 h | LOW | Already in place; no action needed |
| **DDD Documentation** | 1 h | LOW | Decision log entry + glossary update |
| **Integration Testing** | 1 h | MEDIUM | Run full suite, verify no regressions |
| **Code Review Margin** | 1 h | LOW | Small change, straightforward review |
| **TOTAL** | **8-9 hours** | **LOW-MEDIUM** | **Hidden edge cases: legacy artifact filtering** |

---

## 🔴 Hidden Complexity Uncovered

### 1. Legacy Artifact Briefing ID Fallback
- **Discovery**: DDD-038 mentions historical artifacts lack structured payload; code uses `artifactId` as fallback briefing ID
- **Impact**: Filter logic must accept both canonical briefing IDs and artifact ID fallbacks
- **Mitigation**: Use `c.input?.briefingId?.trim() ?? c.artifactId` (already in handler)
- **Status**: ✅ RESOLVED — DDD-075 explicitly documents legacy fallback requirement

### 2. Test Coverage Incompleteness
- **Discovery**: Current hydrate test does NOT pass `resolvedBriefingId`
- **Impact**: New test scenarios required; cannot validate fix without them
- **Mitigation**: Add 5 test scenarios covering multi-briefing, legacy, and fallback cases
- **Status**: ✅ READY — Test infrastructure is mature and scalable

### 3. DDD Alignment Gap
- **Discovery**: No explicit DDD decision on hydration briefing coherence requirement
- **Impact**: ✅ **RESOLVED** — DDD-075 entry created with full ranking semantics specification
- **Mitigation**: ✅ **COMPLETE** — DDD-075 registered in [domain-naming-decision-log.md](domain-naming-decision-log.md)
- **Status**: ✅ **RESOLVED (2026-05-20)** — DDD-075 entry approved with full governance detail

---

## ✅ Audit Conclusion

| Audit | Status | Finding |
| --- | --- | --- |
| **FE/BE Sync** | ✅ PASS | FE sends `resolvedBriefingId` correctly; BE simply ignores it. Fix is isolated. |
| **Test Setup** | ✅ PASS | Framework is minimal and mature. Test effort is ~4 hours, no surprises. |
| **Legacy Compat** | ✅ RESOLVED | Legacy artifacts use artifactId as fallback briefing ID. Filter logic documented in DDD-075. |
| **DDD Governance** | ✅ **COMPLETED (2026-05-20)** | DDD-075 entry approved. Documentation gate cleared. Ready for implementation. |

**Overall Readiness**: ✅ **GREEN — Fix is feasible. Proceed to implementation planning.**

**Status Gate**: All pre-implementation audits clear. **No blockers remain.**

**Realistic Timeline**: 8-9 hours (code + tests + docs + integration)

**Go-Forward Checklist**:
- [x] DDD-075 decision entry created and approved
- [x] Glossary updated with ranking semantics
- [x] Cross-references aligned (DDD-007 ↔ DDD-038 ↔ DDD-075)
- [ ] **NEXT**: Create implementation plan (`plan/hydration-briefing-coherence-fix-1.md`)
- [ ] Implement ranking filter with backward-compat fallback
- [ ] Add 5 test scenarios (multi-briefing, fallback, legacy, explicit ID, session resume)
- [ ] Run full backend test suite + integration tests
- [ ] Code review + merge

---

## Appendix: Code References

| Component | File | Lines | Status |
| --- | --- | --- | --- |
| FE Hydration Request | `hydration.machine.ts` | 130-150 | ✅ Passes `resolvedBriefingId` |
| BE Hydration Handler | `tools-hydrate-handlers.ts` | 95, 170-178 | ❌ Ignores in ranking |
| BE Legacy Fallback | `tools-hydrate-handlers.ts` | 103 | ✅ Uses `artifactId` fallback |
| Test Mock Framework | `runtime.auth-http.test.ts` | 1-80 | ✅ Mature, minimal |
| Existing Hydrate Test | `runtime.auth-http.test.ts` | 1873-1950 | ⚠️ Incomplete (no `resolvedBriefingId`) |
| Artifact Stub | `postgres-redis.stub.ts` | 285-350 | ✅ Well-structured, `seed()` ready |
| DDD Decision (Related) | `domain-naming-decision-log.md` | DDD-038 | 📋 Provides context |
