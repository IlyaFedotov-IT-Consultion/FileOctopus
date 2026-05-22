import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { FileTable } from "../src/pane/FileTable";

afterEach(cleanup);

function makeEntry(index: number) {
  return {
    uri: `local:///tmp/item-${index}`,
    name: `item-${index}`,
    kind: "file" as const,
    size: 0,
    isHidden: false,
    isSymlink: false,
    providerId: "local",
    canRead: true,
    canList: false,
    canWrite: false,
    canDelete: false,
    canRename: false,
  };
}

function renderIconsTable(count: number) {
  const entries = Array.from({ length: count }, (_, i) => makeEntry(i));
  return render(
    <div style={{ width: 400, height: 500 }}>
      <FileTable
        entries={entries}
        currentUri="local:///tmp"
        loadState="loaded"
        rowHeight={20}
        selectedId={null}
        selectedIds={[]}
        focusedId={null}
        sortField="name"
        sortDirection="asc"
        viewMode="icons"
        onSelect={vi.fn()}
        onEntrySelect={vi.fn()}
        onMove={vi.fn()}
        onSort={vi.fn()}
        onActivate={vi.fn()}
        onEntryActivate={vi.fn()}
        onContextMenu={vi.fn()}
      />
    </div>,
  );
}

describe("icons view virtualization", () => {
  it("does not mount all entries for a large directory", () => {
    renderIconsTable(1000);
    const rows = document.querySelectorAll(".fo-row");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(200);
  });

  it("keeps mounted DOM nodes bounded for 10k entries", () => {
    renderIconsTable(10000);
    const rows = document.querySelectorAll(".fo-row");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(200);
  });
});
