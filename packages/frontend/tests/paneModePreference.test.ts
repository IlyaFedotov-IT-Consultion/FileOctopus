import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePaneModePreference } from "../src/hooks/usePaneModePreference";
import type { TerminalSession } from "../src/terminal/terminalSlice";

afterEach(cleanup);

const runningRightSession = {
  id: "right-1",
  uri: "local:///work",
  label: "work",
  status: "running",
  paneId: "right",
} satisfies TerminalSession;

function makeParams(
  overrides: Partial<Parameters<typeof usePaneModePreference>[0]> = {},
) {
  return {
    preferences: { confirmClosePaneWithTerminal: true },
    terminalSessions: [],
    updatePreference: vi.fn(async () => undefined),
    setClosePaneTerminalConfirmOpen: vi.fn(),
    ...overrides,
  } satisfies Parameters<typeof usePaneModePreference>[0];
}

describe("usePaneModePreference", () => {
  it("updates paneMode immediately when switching to dual pane", () => {
    const params = makeParams();
    const { result } = renderHook(() => usePaneModePreference(params));

    act(() => {
      result.current.requestPaneModeChange("dual");
    });

    expect(params.updatePreference).toHaveBeenCalledWith("paneMode", "dual");
    expect(params.setClosePaneTerminalConfirmOpen).not.toHaveBeenCalled();
  });

  it("prompts before hiding the right pane when it has a running terminal session", () => {
    const params = makeParams({ terminalSessions: [runningRightSession] });
    const { result } = renderHook(() => usePaneModePreference(params));

    act(() => {
      result.current.requestPaneModeChange("single");
    });

    expect(params.updatePreference).not.toHaveBeenCalled();
    expect(params.setClosePaneTerminalConfirmOpen).toHaveBeenCalledWith(true);
  });

  it("applies the pending paneMode change when confirmed", () => {
    const params = makeParams({ terminalSessions: [runningRightSession] });
    const { result } = renderHook(() => usePaneModePreference(params));

    act(() => {
      result.current.requestPaneModeChange("single");
      result.current.confirmClosePaneWithTerminal();
    });

    expect(params.updatePreference).toHaveBeenCalledWith("paneMode", "single");
  });

  it("uses confirmation handling for settings paneMode changes", () => {
    const params = makeParams({ terminalSessions: [runningRightSession] });
    const { result } = renderHook(() => usePaneModePreference(params));

    act(() => {
      result.current.handleSettingsPreferenceChange("paneMode", "single");
    });

    expect(params.updatePreference).not.toHaveBeenCalled();
    expect(params.setClosePaneTerminalConfirmOpen).toHaveBeenCalledWith(true);
  });

  it("updates non-paneMode settings directly", () => {
    const params = makeParams();
    const { result } = renderHook(() => usePaneModePreference(params));

    act(() => {
      result.current.handleSettingsPreferenceChange("theme", "dark");
    });

    expect(params.updatePreference).toHaveBeenCalledWith("theme", "dark");
  });
});
