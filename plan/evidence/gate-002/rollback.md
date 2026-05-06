# Phase 2 Gate-002 Rollback Plan
# Date: 2026-05-06

## Scope
Reverse Phase 2 implementation: remove packages/contracts package directory, restore original state.

## Preconditions
- No Phase 2.5+ operations have been executed (imports not yet wired)
- packages/contracts/ remains in its created state

## Rollback Commands

### Step 1: Remove packages/contracts
```bash
rm -rf packages/contracts
```

### Step 2: Verify packages directory is empty or contains only domain/
```bash
ls -la packages/
```
(Should show: `domain/` only)

### Step 3: Clean npm cache (optional)
```bash
npm cache clean --force
npm install
```

### Step 4: Delete evidence directory (optional)
```bash
rm -rf plan/evidence/gate-002
```

## Expected Post-Rollback State
- `packages/contracts/` directory removed
- Backend continues to import from local `src/lib/runtime/request-contract.ts`, `stream-contract.ts`
- Frontend continues to import from local `frontend/src/features/generation/contracts/backend-stream.ts`
- Repository ready for alternative contract consolidation strategy or clean restart

## Validation Commands (Post-Rollback)
```bash
# Verify contracts package removed
$ ls -la packages/ | grep -E "contracts" || echo "Removed"

# Verify backend still works with local contract definitions
$ npm --workspace apps/backend run typecheck 2>&1 | grep -i "error" || echo "No errors"

# Verify git status reflects only removal
$ git status
```

## Execution Notes
- **Time Required**: < 1 minute
- **Manual Intervention**: None (all commands are automated)
- **Rollback Point**: Can be executed at any time before Phase 2.5 import wiring
- **Reversible**: Yes — can re-apply Phase 2 after rollback without data loss
