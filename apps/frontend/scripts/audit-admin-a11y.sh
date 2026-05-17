#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/apps/frontend"

BASE_URL="${A11Y_BASE_URL:-http://127.0.0.1:4174}"
BACKEND_URL="${A11Y_BACKEND_URL:-http://127.0.0.1:3000}"
ADMIN_EMAIL="${A11Y_ADMIN_EMAIL:-seed-user-001@example.local}"
ADMIN_PASSWORD="${A11Y_ADMIN_PASSWORD:-password123}"
BASE_HOST="$(node -e "const u = new URL(process.argv[1]); process.stdout.write(u.hostname);" "$BASE_URL")"
BASE_PORT="$(node -e "const u = new URL(process.argv[1]); process.stdout.write(u.port || (u.protocol === 'https:' ? '443' : '80'));" "$BASE_URL")"

AXE_RUNNER="$FRONTEND_DIR/scripts/admin-a11y-smoke.mjs"
LHCI_CONFIG="$FRONTEND_DIR/.tmp-lighthouserc.admin.auth.json"
BACKEND_LOG="$FRONTEND_DIR/.tmp-admin-a11y-backend.log"
PREVIEW_LOG="$FRONTEND_DIR/.tmp-admin-a11y-preview.log"
AXE_TMP_DIR=""

cleanup() {
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
  fi
  rm -f "$LHCI_CONFIG"
  if [[ -n "$AXE_TMP_DIR" ]]; then
    rm -rf "$AXE_TMP_DIR"
  fi
}
trap cleanup EXIT

wait_http_200() {
  local url="$1"
  local attempts="${2:-120}"
  local delay="${3:-0.5}"

  for ((i=1; i<=attempts; i+=1)); do
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" "$url" || true)
    if [[ "$code" == "200" || "$code" == "401" ]]; then
      return 0
    fi
    sleep "$delay"
  done

  echo "[a11y] timeout waiting for $url" >&2
  return 1
}

generate_password_hash() {
  node -e "const { randomBytes, scryptSync } = require('crypto'); const pwd = process.argv[1]; const salt = randomBytes(16); const key = scryptSync(pwd, salt, 64); process.stdout.write('scrypt$' + salt.toString('base64') + '$' + key.toString('base64'));" "$1"
}

echo "[a11y] loading backend environment from .env.local"
cd "$REPO_ROOT"
set -a
. ./.env.local
set +a

# Force non-secure cookie for local HTTP audit runtime.
export AUTH_COOKIE_SECURE=false

PASSWORD_HASH="$(generate_password_hash "$ADMIN_PASSWORD")"

echo "[a11y] ensuring admin credentials exist for ${ADMIN_EMAIL}"
/opt/homebrew/opt/libpq/bin/psql "$DATABASE_URL" <<SQL
INSERT INTO users (
  id,
  email,
  role,
  status,
  monthly_quota,
  monthly_used,
  password_hash,
  password_algo,
  created_at,
  updated_at
)
VALUES (
  'seed-user-001',
  '${ADMIN_EMAIL}',
  'admin',
  'active',
  100,
  0,
  '${PASSWORD_HASH}',
  'scrypt-v1',
  NOW(),
  NOW()
)
ON CONFLICT (id)
DO UPDATE SET
  email = EXCLUDED.email,
  role = 'admin',
  status = 'active',
  password_hash = EXCLUDED.password_hash,
  password_algo = 'scrypt-v1',
  updated_at = NOW();
SQL

echo "[a11y] starting backend server on $BACKEND_URL"
npm --workspace apps/backend run start:server >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

wait_http_200 "$BACKEND_URL/auth/session" 180 0.5

echo "[a11y] building frontend static bundle with backend URL"
cd "$FRONTEND_DIR"
VITE_API_BASE_URL="$BACKEND_URL" npm run build:static

echo "[a11y] starting frontend preview server on $BASE_URL"
npm run preview -- --host "$BASE_HOST" --port "$BASE_PORT" >"$PREVIEW_LOG" 2>&1 &
FRONTEND_PID=$!

wait_http_200 "$BASE_URL" 180 0.5

echo "[a11y] obtaining authenticated admin session cookie"
COOKIE_HEADER="$({
  curl -sS -D - -o /dev/null \
    -H 'Content-Type: application/json' \
    -X POST \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
    "$BACKEND_URL/auth/login" \
  | awk 'BEGIN { IGNORECASE=1 } /^Set-Cookie:/ { gsub("\r", ""); split($0, parts, ": "); split(parts[2], cookieParts, ";"); print cookieParts[1]; exit }'
} || true)"

if [[ -z "$COOKIE_HEADER" ]]; then
  echo "[a11y] no auth cookie obtained; verify seed credentials and backend state" >&2
  exit 1
fi

echo "[a11y] running authenticated axe smoke on admin routes"
AXE_TMP_DIR="$(mktemp -d)"
pushd "$AXE_TMP_DIR" >/dev/null
npm pack axe-core@4.11.4 >/dev/null
tar -xzf axe-core-4.11.4.tgz
popd >/dev/null

A11Y_AXE_SOURCE_PATH="$AXE_TMP_DIR/package/axe.min.js"

A11Y_BASE_URL="$BASE_URL" \
A11Y_ADMIN_EMAIL="$ADMIN_EMAIL" \
A11Y_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
A11Y_AXE_SOURCE_PATH="$A11Y_AXE_SOURCE_PATH" \
A11Y_COOKIE_HEADER="$COOKIE_HEADER" \
node "$AXE_RUNNER"

cat > "$LHCI_CONFIG" <<JSON
{
  "ci": {
    "collect": {
      "url": [
        "$BASE_URL/admin",
        "$BASE_URL/admin?lh-route=users",
        "$BASE_URL/admin?lh-route=models",
        "$BASE_URL/admin?lh-route=changelog",
        "$BASE_URL/admin?lh-route=user-reports",
        "$BASE_URL/admin?lh-route=activity"
      ],
      "numberOfRuns": 1,
      "settings": {
        "preset": "desktop",
        "extraHeaders": {
          "Cookie": "$COOKIE_HEADER"
        }
      }
    },
    "assert": {
      "assertions": {
        "categories:accessibility": [
          "error",
          { "minScore": 0.9 }
        ],
        "categories:best-practices": [
          "warn",
          { "minScore": 0.8 }
        ]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
JSON

echo "[a11y] running authenticated lighthouse admin audit"
npx --yes --package @lhci/cli@0.15.1 lhci autorun --config="$LHCI_CONFIG"

echo "[a11y] admin accessibility audits completed"
