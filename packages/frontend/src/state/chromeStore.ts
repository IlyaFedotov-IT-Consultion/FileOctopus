import type {
  FileOctopusClient,
  UserPreferencesDto,
} from "@fileoctopus/ts-api";

const STATUS_BAR_KEY = "fileoctopus.statusBarVisible";
const TOOLBAR_KEY = "fileoctopus.toolbarVisible";

function readLegacyChromePreference(key: string): boolean | null {
  try {
    const value = localStorage.getItem(key);
    if (value === null) {
      return null;
    }
    return value === "true";
  } catch {
    return null;
  }
}

function clearLegacyChromePreferences() {
  try {
    localStorage.removeItem(STATUS_BAR_KEY);
    localStorage.removeItem(TOOLBAR_KEY);
  } catch {
    /* ignore */
  }
}

export async function migrateLegacyChromePreferences(
  client: FileOctopusClient,
  preferences: UserPreferencesDto,
): Promise<UserPreferencesDto> {
  const statusLegacy = readLegacyChromePreference(STATUS_BAR_KEY);
  const toolbarLegacy = readLegacyChromePreference(TOOLBAR_KEY);
  if (statusLegacy === null && toolbarLegacy === null) {
    return preferences;
  }

  let next = preferences;
  if (
    statusLegacy !== null &&
    statusLegacy !== (preferences.statusBarVisible !== false)
  ) {
    const response = await client.preferences.set({
      key: "statusBarVisible",
      value: String(statusLegacy),
    });
    next = response.preferences;
  }
  if (
    toolbarLegacy !== null &&
    toolbarLegacy !== (next.toolbarVisible !== false)
  ) {
    const response = await client.preferences.set({
      key: "toolbarVisible",
      value: String(toolbarLegacy),
    });
    next = response.preferences;
  }

  clearLegacyChromePreferences();
  return next;
}
