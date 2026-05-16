/**
 * Hash display utilities for on-demand file hash column.
 *
 * HashState values:
 * - undefined: not computed yet
 * - "computing": hash is being calculated
 * - "error": computation failed
 * - string (hex): the SHA-256 hash
 */
export type HashState = undefined | "computing" | "error" | string;

const HASH_DISPLAY_LENGTH = 16;

/**
 * Format a hash state for display in the table column.
 * - undefined → "—"
 * - "computing" → "…"
 * - "error" → "⚠"
 * - hex string → first 16 chars (truncated SHA-256)
 */
export function formatHash(hash: HashState): string {
  if (hash === undefined || hash === "") {
    return "—";
  }
  if (hash === "computing") {
    return "…";
  }
  if (hash === "error") {
    return "⚠";
  }
  return hash.slice(0, HASH_DISPLAY_LENGTH);
}
