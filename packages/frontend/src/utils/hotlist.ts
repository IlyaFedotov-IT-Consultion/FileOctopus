export interface HotlistEntry {
  id: string;
  label: string;
  uri: string;
  shortcut?: number;
}

export function parseHotlistEntries(json: string): HotlistEntry[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidHotlistEntry);
  } catch {
    return [];
  }
}

export function serializeHotlistEntries(entries: HotlistEntry[]): string {
  return JSON.stringify(entries);
}

function isValidHotlistEntry(obj: unknown): obj is HotlistEntry {
  if (typeof obj !== "object" || obj === null) return false;
  const e = obj as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.label === "string" &&
    typeof e.uri === "string" &&
    (e.shortcut === undefined || typeof e.shortcut === "number")
  );
}

export function createHotlistEntry(
  label: string,
  uri: string,
  shortcut?: number,
): HotlistEntry {
  return {
    id: `hotlist-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    label,
    uri,
    shortcut,
  };
}
