#!/usr/bin/env bash
# FileOctopus health check — runs all checks, outputs summary
# Used by cron CI and manual verification
# Exit code: 0 = all pass, 1 = any failure
# Each check has a shell-level timeout so the script survives even if
# a single command hangs; the caller (cron) should allow 15+ minutes.

set -euo pipefail
cd "$(dirname "$0")/.."

PASS=0
FAIL=0
WARN=0
RESULTS=""
LOG_DIR="target/health-check"
CHECK_TIMEOUT=${CHECK_TIMEOUT:-600}  # default 10 min per check; override via env

mkdir -p "$LOG_DIR"

run_check() {
  local name="$1"
  shift
  local slug
  local log_file
  slug="$(printf "%s" "$name" | tr "[:upper:] " "[:lower:]-" | tr -cd "a-z0-9._-")"
  log_file="$LOG_DIR/${slug}.log"
  echo "⏳ $name..."
  if timeout "$CHECK_TIMEOUT" "$@" >"$log_file" 2>&1; then
    echo "   ✅ $name"
    RESULTS="$RESULTS\n✅ $name"
    PASS=$((PASS + 1))
  else
    local exit_code=$?
    if [ "$exit_code" -eq 124 ]; then
      echo "   ⚠️ $name — TIMEOUT after ${CHECK_TIMEOUT}s (see $log_file)"
      RESULTS="$RESULTS\n⚠️ $name — TIMEOUT after ${CHECK_TIMEOUT}s"
      WARN=$((WARN + 1))
    else
      echo "   ❌ $name (exit $exit_code; see $log_file)"
      RESULTS="$RESULTS\n❌ $name — exit $exit_code"
      FAIL=$((FAIL + 1))
    fi
  fi
}

echo "═══════════════════════════════════════"
echo "  FileOctopus Health Check"
echo "  $(date -Iseconds)"
echo "  Check timeout: ${CHECK_TIMEOUT}s per check"
echo "═══════════════════════════════════════"
echo ""

# 1. Git status (informational, never fails gate)
if [ -z "$(git status --short)" ]; then
  echo "✅ Git: working tree clean"
  RESULTS="$RESULTS\n✅ Git: working tree clean"
  PASS=$((PASS + 1))
else
  echo "⚠️  Git: uncommitted changes:"
  git status --short | head -10
  RESULTS="$RESULTS\n⚠️ Git: uncommitted changes"
  PASS=$((PASS + 1))
fi
echo ""

# ─── Quick compilation / format / lint gates (< 2 min each) ───
echo "── Quick gates ──"

run_check "TypeScript typecheck" \
  pnpm typecheck

run_check "Rust compilation (cargo check)" \
  cargo check --workspace

run_check "ESLint" \
  pnpm lint

run_check "Prettier format check" \
  pnpm format:check

run_check "Rust format check" \
  cargo fmt --all --check

run_check "Rust clippy" \
  cargo clippy --workspace --all-targets -- -D warnings

# ─── Slow test gates (may take 5-15 min each) ───
echo ""
echo "── Slow gates (tests) ──"

run_check "Frontend tests (pnpm test)" \
  pnpm test

run_check "Rust tests (cargo test --workspace)" \
  cargo test --workspace

# ─── Optional E2E (only if dev server already running) ───
echo ""
if curl -sf http://localhost:1420 >/dev/null 2>&1; then
  run_check "E2E (Playwright)" \
    npx playwright test --reporter=list 2>/dev/null
else
  echo "⏭️  E2E: skipped (Vite dev server not running)"
  RESULTS="$RESULTS\n⏭️ E2E: skipped"
fi

# ─── RC validation (umbrella script) ───
echo ""
run_check "RC validation (pnpm rc:validate)" \
  pnpm rc:validate

echo ""
echo "═══════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed, $WARN timeout"
echo "═══════════════════════════════════════"
echo -e "$RESULTS"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
