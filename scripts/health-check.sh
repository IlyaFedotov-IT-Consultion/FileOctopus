#!/usr/bin/env bash
# FileOctopus health check — runs all checks, outputs summary
# Used by cron CI and manual verification
# Exit code: 0 = all pass, 1 = any failure

set -euo pipefail
cd "$(dirname "$0")/.."

PASS=0
FAIL=0
RESULTS=""
LOG_DIR="target/health-check"

mkdir -p "$LOG_DIR"

run_check() {
  local name="$1"
  shift
  local slug
  local log_file
  slug="$(printf "%s" "$name" | tr "[:upper:] " "[:lower:]-" | tr -cd "a-z0-9._-")"
  log_file="$LOG_DIR/${slug}.log"
  echo "⏳ $name..."
  if "$@" >"$log_file" 2>&1; then
    echo "   ✅ $name"
    RESULTS="$RESULTS\n✅ $name"
    PASS=$((PASS + 1))
  else
    echo "   ❌ $name (see $log_file)"
    RESULTS="$RESULTS\n❌ $name - $log_file"
    FAIL=$((FAIL + 1))
  fi
}

echo "═══════════════════════════════════════"
echo "  FileOctopus Health Check"
echo "  $(date -Iseconds)"
echo "═══════════════════════════════════════"
echo ""

# 1. Git status
if [ -z "$(git status --short)" ]; then
  echo "✅ Git: working tree clean"
  RESULTS="$RESULTS\n✅ Git: working tree clean"
  PASS=$((PASS + 1))
else
  echo "⚠️  Git: uncommitted changes:"
  git status --short | head -10
  RESULTS="$RESULTS\n⚠️ Git: uncommitted changes"
  PASS=$((PASS + 1))  # not a failure, just informational
fi
echo ""

# 2. TypeScript workspace
run_check "TypeScript workspace (pnpm typecheck)" \
  pnpm typecheck

# 3. Rust
run_check "Rust (cargo check)" \
  cargo check --workspace

# 4. Workspace tests
run_check "Workspace tests (pnpm test)" \
  pnpm test

# 5. Rust tests
run_check "Rust tests" \
  cargo test --workspace

# 6. ESLint
run_check "ESLint" \
  pnpm lint

# 7. E2E (only if Vite dev server is running or can be started)
if curl -sf http://localhost:1420 >/dev/null 2>&1; then
  run_check "E2E (Playwright)" \
    npx playwright test --reporter=list 2>/dev/null
else
  echo "⏭️  E2E: skipped (Vite dev server not running)"
  RESULTS="$RESULTS\n⏭️ E2E: skipped"
fi

echo ""
echo "═══════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed"
echo "═══════════════════════════════════════"
echo -e "$RESULTS"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
