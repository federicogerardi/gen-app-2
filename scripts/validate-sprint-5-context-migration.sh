#!/bin/bash
set -euo pipefail

echo "=== Sprint 5 Context Migration Validation ==="

# 1. Context field count per sub-context (≤15)
DOMAIN_FIELDS=$(rg -c "requestId|userId|projectId|sessionId|toolKey|workflowType|artifactType|artifactId|contentBuffer|failureReason" \
  apps/backend/src/lib/machines/generation-system.context-types.ts | head -1)
RUNTIME_FIELDS=$(rg -c "model|requestInput|idempotencyKey|outputFormat|syntheticResponse|routeType|effectiveModelResolution|mode" \
  apps/backend/src/lib/machines/generation-system.context-types.ts | head -1)
METRICS_FIELDS=$(rg -c "inputTokens|outputTokens|costUsd|_creditCost" \
  apps/backend/src/lib/machines/generation-system.context-types.ts | head -1)

if [ "$DOMAIN_FIELDS" -le 15 ] && [ "$RUNTIME_FIELDS" -le 15 ] && [ "$METRICS_FIELDS" -le 15 ]; then
  echo "✅ Context complexity: ≤15 fields per sub-context"
else
  echo "❌ Context complexity: field limit exceeded"
  exit 1
fi

# 2. Action concern separation (composed enqueueGenerationActions)
COMPOSED_ACTIONS=$(rg -c "enqueueGenerationActions" apps/backend/src/lib/machines/generation-system.actions.ts)
if [ "$COMPOSED_ACTIONS" -ge 4 ]; then
  echo "✅ Composed actions: $COMPOSED_ACTIONS enqueueGenerationActions (≥4 expected: 2 pre-existing + 2 new)"
else
  echo "❌ Composed actions: only $COMPOSED_ACTIONS found (expected ≥4)"
  exit 1
fi

# 3. Accessor usage in guards
ACCESSOR_USAGE=$(rg -c "selectDomainContext|selectRuntimeContext|selectMetricsContext|selectInfraContext|selectErrorContext" \
  apps/backend/src/lib/machines/generation-system.guards.ts 2>/dev/null || echo 0)
if [ "$ACCESSOR_USAGE" -ge 3 ]; then
  echo "✅ Accessor read-side usage in guards: $ACCESSOR_USAGE points"
else
  echo "❌ Accessor read-side usage in guards: $ACCESSOR_USAGE (expected ≥3)"
  exit 1
fi

# 4. Type deprecation layer
DEPRECATION=$(rg -c "@deprecated" apps/backend/src/lib/machines/generation-system.types.ts)
if [ "$DEPRECATION" -ge 1 ]; then
  echo "✅ Type deprecation layer: present"
else
  echo "❌ Type deprecation layer: missing"
  exit 1
fi

# 5. Context decomposition test suite exists
TEST_FILE="apps/backend/src/lib/tests/generation-system.context-decomposition.test.ts"
if [ -f "$TEST_FILE" ]; then
  echo "✅ Context decomposition test suite: exists"
else
  echo "❌ Context decomposition test suite: missing"
  exit 1
fi

# 6. Backend regression (final gate)
echo "Running backend regression..."
npm --workspace apps/backend run typecheck
npm --workspace apps/backend run test
# Expected: 340 test pass (335 baseline + 5 new)

echo "=== Sprint 5 Validation Complete ==="
