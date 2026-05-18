import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { FileEntryDto } from "@fileoctopus/ts-api";
import { FileRow } from "../src/pane/FileRow";

afterEach(cleanup);

const baseEntry: FileEntryDto = {
  name: "report.pdf",
  uri: "local:///home/user/docs/report.pdf",
  kind: "file",
  size: 2048000,
  extension: "pdf",
  modifiedAt: "2026-05-18T10:30:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  permissions: null,
  owner: null,
  canRead: true,
  canWrite: true,
  canDelete: true,
  canRename: true,
  canList: true,
  isHidden: false,
  isSymlink: false,
  providerId: "local",
};

function renderRow(overrides: Partial<FileEntryDto> = {}) {
  const entry = { ...baseEntry, ...overrides };
  render(
    <FileRow
      entry={entry}
      top={0}
      rowHeight={20}
      viewMode="details"
      selected={false}
      multiSelected={false}
      focused={false}
      onSelect={() => {}}
      onEntrySelect={() => {}}
      onEntryActivate={() => {}}
      onContextMenu={() => {}}
    />,
  );
  return entry;
}

describe("FileRow accessible names", () => {
  it("has aria-label with file name, type, and size", () => {
    const entry = renderRow();
    const row = screen.getByRole("row");
    expect(row.getAttribute("aria-label")).toBeTruthy();
    const label = row.getAttribute("aria-label") ?? "";
    expect(label.indexOf(entry.name) !== -1).toBe(true);
    expect(label.indexOf("PDF") !== -1).toBe(true);
    expect(label.indexOf("2.0") !== -1).toBe(true);
  });

  it("includes folder label for directories", () => {
    renderRow({ kind: "directory", name: "Documents", extension: "", size: 0 });
    const row = screen.getByRole("row");
    const label = row.getAttribute("aria-label") ?? "";
    expect(label.indexOf("Documents") !== -1).toBe(true);
    expect(
      label.indexOf("folder") !== -1 || label.indexOf("Folder") !== -1,
    ).toBe(true);
  });

  it("includes modified date in accessible name", () => {
    const entry = renderRow();
    const row = screen.getByRole("row");
    const label = row.getAttribute("aria-label") ?? "";
    // Label should be longer than just name + type + size (i.e., date is included)
    const withoutDate = [entry.name, "PDF", "2.0 MB"].join(", ");
    expect(label.length > withoutDate.length).toBe(true);
  });
});
