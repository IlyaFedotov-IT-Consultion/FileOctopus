import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OperationToolbar } from "../src/pane/OperationToolbar";

function createProps(
  overrides: Partial<ComponentProps<typeof OperationToolbar>> = {},
) {
  const noop = vi.fn();
  return {
    selectedCount: 0,
    canRename: false,
    canPaste: false,
    showHidden: false,
    viewMode: "details" as const,
    canGoBack: false,
    canGoForward: false,
    canGoUp: false,
    onBack: noop,
    onForward: noop,
    onUp: noop,
    onRefresh: noop,
    onCommandSearch: noop,
    onCreateFolder: noop,
    onCreateFile: noop,
    onRename: noop,
    onCopy: noop,
    onCut: noop,
    onCopyOperation: noop,
    onMove: noop,
    onPaste: noop,
    onTrash: noop,
    onPermanentDelete: noop,
    onCopyPath: noop,
    onCopyName: noop,
    onProperties: noop,
    onRevealInFileManager: noop,
    onCalculateSize: noop,
    onCompress: noop,
    onExtract: noop,
    onOpenTerminal: noop,
    onChecksum: noop,
    onToggleHidden: noop,
    onSelectAll: noop,
    onViewMode: noop,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("OperationToolbar command search", () => {
  it("opens command palette on click without keeping focus on the trigger", () => {
    const onCommandSearch = vi.fn();
    render(<OperationToolbar {...createProps({ onCommandSearch })} />);

    const input = screen.getByLabelText("Open command palette");
    fireEvent.click(input);

    expect(onCommandSearch).toHaveBeenCalledOnce();
    expect(document.activeElement).not.toBe(input);
  });

  it("opens command palette on Enter without keeping focus on the trigger", () => {
    const onCommandSearch = vi.fn();
    render(<OperationToolbar {...createProps({ onCommandSearch })} />);

    const input = screen.getByLabelText("Open command palette");
    input.focus();
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCommandSearch).toHaveBeenCalledOnce();
    expect(document.activeElement).not.toBe(input);
  });

  it("does not open command palette on focus alone", () => {
    const onCommandSearch = vi.fn();
    render(<OperationToolbar {...createProps({ onCommandSearch })} />);

    const input = screen.getByLabelText("Open command palette");
    fireEvent.focus(input);

    expect(onCommandSearch).not.toHaveBeenCalled();
  });
});
