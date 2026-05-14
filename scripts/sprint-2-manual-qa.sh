#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-/tmp/fileoctopus-sprint-2-qa}"

rm -rf "$ROOT"
mkdir -p "$ROOT/source/nested" "$ROOT/destination" "$ROOT/conflicts"
printf 'alpha\n' > "$ROOT/source/alpha.txt"
printf 'nested\n' > "$ROOT/source/nested/beta.txt"
printf 'existing\n' > "$ROOT/conflicts/alpha.txt"

cat <<EOF
Sprint 2 manual QA fixture created at: $ROOT

Use local URI: local://$ROOT

Expected checks:
1. Create folder in $ROOT/destination; duplicate name must show a conflict.
2. Rename a file or folder; invalid names with / or \\ must be blocked.
3. Copy source/alpha.txt to destination; copied bytes must match.
4. Copy source to destination; nested/beta.txt must appear under destination/source.
5. Move a copied item between folders; source must remain intact if the move fails.
6. Copy source/alpha.txt to conflicts; conflict summary must appear before mutation.
7. Default conflict policy must be fail or skip; overwrite must require explicit selection.
8. Start a large copy, cancel it from Activity, and verify no completed event appears later.
9. Move selected items to Trash; confirmation must say Move to Trash.
10. Restart the app and confirm recent operation history is still visible.

Platform notes:
- Linux trash depends on desktop trash support and may fail clearly on minimal environments.
- Windows should move items to Recycle Bin, not permanently delete.
- macOS should move items to Trash, not permanently delete.
EOF
