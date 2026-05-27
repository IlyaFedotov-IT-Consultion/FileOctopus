import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SettingsEditor } from "../src/components/settings/SettingsEditor";
import type { UserPreferencesDto } from "@fileoctopus/ts-api";

function makePrefs(
  overrides: Partial<UserPreferencesDto> = {},
): UserPreferencesDto {
  return {
    theme: "system",
    density: "comfortable",
    defaultViewMode: "details",
    showHiddenFiles: false,
    sidebarWidth: 280,
    splitRatio: 0.5,
    activityPanelVisible: false,
    activityPanelWidth: 320,
    confirmDelete: true,
    confirmPermanentDelete: false,
    useTrashByDefault: true,
    defaultConflictPolicy: "ask",
    accentColor: "blue",
    fontScale: "1",
    iconScale: "1",
    confirmOverwrite: true,
    sidebarVisible: true,
    statusBarVisible: true,
    toolbarVisible: true,
    toolbarEntries: "[]",
    paneMode: "dual",
    paneDirection: "horizontal",
    jobDrawerBehavior: "manual",
    showAdvancedCopyOptions: false,
    paneTerminalHeightLeft: 0.35,
    paneTerminalHeightRight: 0.35,
    paneTerminalDefaultOpen: false,
    terminalCdOnNavigate: false,
    confirmClosePaneWithTerminal: true,
    terminalShell: "",
    terminalArgs: "",
    rememberLastUsedPanes: true,
    diagnosticsExportPath: "/tmp/fileoctopus-diagnostics.zip",
    customShortcuts: "",
    fileTypeColorRules: "",
    layoutProfiles: "",
    columnPresets: "",
    tabSessions: "",
    logLevel: "warn",
    experimentalFeatures: false,
    cacheSizeLimit: 256,
    fileOperationThreads: 4,
    networkConnectionTimeout: 30,
    networkAutoReconnect: true,
    networkDefaultProtocol: "sftp",
    networkSshKeyPath: "",
    editorFontFamily: "monospace",
    editorFontSize: 14,
    editorTabSize: 4,
    editorWordWrap: true,
    editorAutoSave: false,
    editorSyntaxHighlighting: true,
    editorLineNumbers: true,
    ...overrides,
  };
}

afterEach(cleanup);

describe("SettingsEditor", () => {
  it("renders section heading", () => {
    render(<SettingsEditor preferences={makePrefs()} onChange={vi.fn()} />);
    expect(screen.getByText("Editor")).toBeTruthy();
  });

  it("renders font family field", () => {
    render(<SettingsEditor preferences={makePrefs()} onChange={vi.fn()} />);
    const input = screen.getByLabelText("Font family") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("monospace");
  });

  it("calls onChange when font family changes", () => {
    const onChange = vi.fn();
    render(<SettingsEditor preferences={makePrefs()} onChange={onChange} />);
    const input = screen.getByLabelText("Font family") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Fira Code" } });
    expect(onChange).toHaveBeenCalledWith("editorFontFamily", "Fira Code");
  });

  it("renders font size field", () => {
    render(<SettingsEditor preferences={makePrefs()} onChange={vi.fn()} />);
    const input = screen.getByLabelText("Font size") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("14");
  });

  it("calls onChange when font size changes", () => {
    const onChange = vi.fn();
    render(<SettingsEditor preferences={makePrefs()} onChange={onChange} />);
    const input = screen.getByLabelText("Font size") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "16" } });
    expect(onChange).toHaveBeenCalledWith("editorFontSize", "16");
  });

  it("renders tab size field", () => {
    render(<SettingsEditor preferences={makePrefs()} onChange={vi.fn()} />);
    const input = screen.getByLabelText("Tab size") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("4");
  });

  it("renders word wrap checkbox checked", () => {
    render(<SettingsEditor preferences={makePrefs()} onChange={vi.fn()} />);
    const checkbox = screen.getByLabelText("Word wrap") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("calls onChange when word wrap toggled off", () => {
    const onChange = vi.fn();
    render(<SettingsEditor preferences={makePrefs()} onChange={onChange} />);
    const checkbox = screen.getByLabelText("Word wrap") as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith("editorWordWrap", "false");
  });

  it("renders auto-save checkbox unchecked", () => {
    render(<SettingsEditor preferences={makePrefs()} onChange={vi.fn()} />);
    const checkbox = screen.getByLabelText("Auto-save") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it("renders syntax highlighting checkbox checked", () => {
    render(<SettingsEditor preferences={makePrefs()} onChange={vi.fn()} />);
    const checkbox = screen.getByLabelText(
      "Syntax highlighting",
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("renders line numbers checkbox checked", () => {
    render(<SettingsEditor preferences={makePrefs()} onChange={vi.fn()} />);
    const checkbox = screen.getByLabelText("Line numbers") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("calls onChange when line numbers toggled off", () => {
    const onChange = vi.fn();
    render(<SettingsEditor preferences={makePrefs()} onChange={onChange} />);
    const checkbox = screen.getByLabelText("Line numbers") as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith("editorLineNumbers", "false");
  });
});
