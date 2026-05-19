import { useCallback, useEffect, useRef } from "react";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";
import {
  clearStoredToolbarEntries,
  DEFAULT_TOOLBAR_ENTRIES,
  normalizeToolbarEntries,
  parseToolbarEntriesJson,
  readStoredToolbarEntries,
  toolbarEntriesFromPreference,
  type ToolbarEntry,
} from "../commands/toolbarConfig";

async function migrateLegacyToolbarEntries(
  preferences: UserPreferencesDto | null,
  updatePreference: (key: string, value: string) => Promise<void>,
): Promise<void> {
  if (preferences?.toolbarEntries?.trim()) {
    return;
  }
  if (typeof window === "undefined") {
    return;
  }
  const legacyRaw = window.localStorage.getItem("fileoctopus.toolbarEntries");
  if (!legacyRaw) {
    return;
  }
  const legacyEntries = parseToolbarEntriesJson(legacyRaw);
  if (!legacyEntries) {
    clearStoredToolbarEntries();
    return;
  }
  await updatePreference("toolbarEntries", JSON.stringify(legacyEntries));
  clearStoredToolbarEntries();
}

export function useToolbarConfig(
  preferences: UserPreferencesDto | null,
  updatePreference: (key: string, value: string) => Promise<void>,
) {
  const migratedRef = useRef(false);
  const entries = toolbarEntriesFromPreference(preferences?.toolbarEntries);

  useEffect(() => {
    if (migratedRef.current || !preferences) {
      return;
    }
    migratedRef.current = true;
    void migrateLegacyToolbarEntries(preferences, updatePreference);
  }, [preferences, updatePreference]);

  const saveEntries = useCallback(
    async (next: ToolbarEntry[]) => {
      const normalized = normalizeToolbarEntries(next);
      await updatePreference("toolbarEntries", JSON.stringify(normalized));
      clearStoredToolbarEntries();
    },
    [updatePreference],
  );

  const resetEntries = useCallback(async () => {
    await saveEntries([...DEFAULT_TOOLBAR_ENTRIES]);
  }, [saveEntries]);

  return {
    entries,
    saveEntries,
    resetEntries,
  };
}

export function resolveToolbarEntriesForTests(
  preferences: UserPreferencesDto | null,
): ToolbarEntry[] {
  const fromPrefs = parseToolbarEntriesJson(preferences?.toolbarEntries);
  if (fromPrefs) {
    return fromPrefs;
  }
  return readStoredToolbarEntries();
}
