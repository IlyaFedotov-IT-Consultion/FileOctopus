import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";
import {
  hasRunningPaneSessions,
  type TerminalSession,
} from "../terminal/terminalSlice";

type PaneMode = "single" | "dual";

export interface UsePaneModePreferenceParams {
  preferences: UserPreferencesDto | null;
  terminalSessions: TerminalSession[];
  updatePreference: (key: string, value: string) => Promise<void>;
  setClosePaneTerminalConfirmOpen: Dispatch<SetStateAction<boolean>>;
}

export function usePaneModePreference({
  preferences,
  terminalSessions,
  updatePreference,
  setClosePaneTerminalConfirmOpen,
}: UsePaneModePreferenceParams) {
  const pendingPaneModeRef = useRef<PaneMode | null>(null);

  const requestPaneModeChange = useCallback(
    (next: PaneMode) => {
      if (
        next === "single" &&
        preferences?.confirmClosePaneWithTerminal !== false &&
        hasRunningPaneSessions(terminalSessions, "right")
      ) {
        pendingPaneModeRef.current = next;
        setClosePaneTerminalConfirmOpen(true);
        return;
      }
      void updatePreference("paneMode", next);
    },
    [
      preferences?.confirmClosePaneWithTerminal,
      setClosePaneTerminalConfirmOpen,
      terminalSessions,
      updatePreference,
    ],
  );

  const handleSettingsPreferenceChange = useCallback(
    (key: string, value: string) => {
      if (key === "paneMode") {
        requestPaneModeChange(value as PaneMode);
        return;
      }
      void updatePreference(key, value);
    },
    [requestPaneModeChange, updatePreference],
  );

  const confirmClosePaneWithTerminal = useCallback(() => {
    const next = pendingPaneModeRef.current;
    pendingPaneModeRef.current = null;
    if (next) {
      void updatePreference("paneMode", next);
    }
  }, [updatePreference]);

  return {
    requestPaneModeChange,
    handleSettingsPreferenceChange,
    confirmClosePaneWithTerminal,
  };
}
