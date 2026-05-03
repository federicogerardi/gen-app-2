#!/usr/bin/env bash
# Validates that any docs/**/*.md file just written has required frontmatter fields.
# Exits 0 (allow) always — prints warnings only so the agent sees them without blocking.
# Required fields: status, version, owner
set -euo pipefail

REQUIRED_FIELDS=("status" "version" "owner")
DOCS_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null)/docs"

# Collect files passed via TOOL_OUTPUT env var (comma-separated paths) or fall back to recent git-modified docs
if [[ -n "${TOOL_OUTPUT:-}" ]]; then
  IFS=',' read -ra FILES <<< "$TOOL_OUTPUT"
else
  mapfile -t FILES < <(git -C "$DOCS_ROOT/.." diff --name-only HEAD 2>/dev/null | grep '^docs/.*\.md$' || true)
fi

WARN=0
for FILE in "${FILES[@]}"; do
  # Normalise path
  [[ "$FILE" == /* ]] || FILE="$(git -C "$DOCS_ROOT/.." rev-parse --show-toplevel)/$FILE"
  [[ -f "$FILE" ]] || continue
  [[ "$FILE" == *.md ]] || continue
  [[ "$FILE" == */docs/* ]] || continue

  # Check frontmatter block exists
  if ! head -1 "$FILE" | grep -q '^---'; then
    echo "⚠️  FRONTMATTER WARNING: $FILE — missing opening '---' block"
    WARN=1
    continue
  fi

  for FIELD in "${REQUIRED_FIELDS[@]}"; do
    if ! awk '/^---/{f++} f==1 && /^'"$FIELD"':/' "$FILE" | grep -q .; then
      echo "⚠️  FRONTMATTER WARNING: $FILE — missing required field '$FIELD'"
      WARN=1
    fi
  done
done

if [[ $WARN -eq 0 ]]; then
  echo "✅ Frontmatter OK — all checked docs/ files have required fields."
fi

exit 0
