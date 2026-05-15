import type { FileEntryDto } from "@fileoctopus/ts-api";
import { cx } from "@fileoctopus/ui";
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { isPaneLoading, type PaneLoadState } from "../paneTypes";
import type { SortField, ViewMode } from "../panelStore";
import { fileIconGlyph, formatDate, formatSize } from "./fileTableUtils";

const overscan = 8;
const URI_MIME = "application/x-fileoctopus-uri";

export interface FileTableProps {
  entries: FileEntryDto[];
  loadState: PaneLoadState;
  rowHeight: number;
  selectedId: string | null;
  selectedIds: string[];
  focusedId: string | null;
  sortField: SortField;
  sortDirection: string;
  viewMode: ViewMode;
  onSelect: (entryId: string | null) => void;
  onEntrySelect: (entryId: string, mode: "single" | "toggle" | "range") => void;
  onMove: (delta: number) => void;
  onSort: (field: SortField) => void;
  onActivate: () => void;
  onEntryActivate: (entry: FileEntryDto | null) => void;
  onContextMenu: (
    event: MouseEvent<HTMLElement>,
    entry: FileEntryDto | null,
  ) => void;
}

export function FileTable({
  entries,
  loadState,
  rowHeight,
  selectedId,
  selectedIds,
  focusedId,
  sortField,
  sortDirection,
  viewMode,
  onSelect,
  onEntrySelect,
  onMove,
  onSort,
  onActivate,
  onEntryActivate,
  onContextMenu,
}: FileTableProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const viewportHeight = viewportRef.current?.clientHeight ?? 420;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const visibleEntries = entries.slice(startIndex, startIndex + visibleCount);
  const totalHeight = entries.length * rowHeight;
  const loading = isPaneLoading(loadState);

  useEffect(() => {
    if (!focusedId || !viewportRef.current) {
      return;
    }

    const index = entries.findIndex((entry) => entry.uri === focusedId);

    if (index < 0) {
      return;
    }

    const top = index * rowHeight;
    const bottom = top + rowHeight;
    const viewTop = viewportRef.current.scrollTop;
    const viewBottom = viewTop + viewportRef.current.clientHeight;

    if (top < viewTop) {
      viewportRef.current.scrollTop = top;
    } else if (bottom > viewBottom) {
      viewportRef.current.scrollTop = bottom - viewportRef.current.clientHeight;
    }
  }, [entries, focusedId, rowHeight]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        onMove(-1);
        break;
      case "ArrowDown":
        event.preventDefault();
        onMove(1);
        break;
      case "PageUp":
        event.preventDefault();
        onMove(-Math.max(1, Math.floor(viewportHeight / rowHeight)));
        break;
      case "PageDown":
        event.preventDefault();
        onMove(Math.max(1, Math.floor(viewportHeight / rowHeight)));
        break;
      case "Home":
        event.preventDefault();
        onMove(-entries.length);
        break;
      case "End":
        event.preventDefault();
        onMove(entries.length);
        break;
      case "Enter":
        event.preventDefault();
        onActivate();
        break;
      default:
        break;
    }
  }

  return (
    <div
      className={cx(
        "fo-table-shell",
        `fo-view-${viewMode}`,
        loading && entries.length > 0 && "fo-table-shell-busy",
      )}
      onContextMenu={(event) => onContextMenu(event, null)}
    >
      {viewMode === "details" ? (
        <div className="fo-table-header" role="row">
          <ColumnHeader
            field="name"
            active={sortField === "name"}
            direction={sortDirection}
            onSort={onSort}
          >
            Name
          </ColumnHeader>
          <ColumnHeader
            field="size"
            active={sortField === "size"}
            direction={sortDirection}
            onSort={onSort}
          >
            Size
          </ColumnHeader>
          <ColumnHeader
            field="modified"
            active={sortField === "modified"}
            direction={sortDirection}
            onSort={onSort}
          >
            Modified
          </ColumnHeader>
          <ColumnHeader
            field="type"
            active={sortField === "type"}
            direction={sortDirection}
            onSort={onSort}
          >
            Type
          </ColumnHeader>
        </div>
      ) : null}
      <div
        ref={viewportRef}
        className="fo-table-viewport"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        {loading && entries.length === 0 ? (
          <FileListSkeleton rowHeight={rowHeight} viewMode={viewMode} />
        ) : entries.length === 0 ? null : (
          <div className="fo-table-spacer" style={{ height: totalHeight }}>
            {visibleEntries.map((entry, offset) => (
              <FileRow
                key={entry.uri}
                entry={entry}
                top={(startIndex + offset) * rowHeight}
                rowHeight={rowHeight}
                viewMode={viewMode}
                selected={entry.uri === selectedId}
                multiSelected={selectedIds.includes(entry.uri)}
                focused={entry.uri === focusedId}
                onSelect={onSelect}
                onEntrySelect={onEntrySelect}
                onEntryActivate={onEntryActivate}
                onContextMenu={onContextMenu}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ColumnHeaderProps {
  field: SortField;
  active: boolean;
  direction: string;
  children: ReactNode;
  onSort: (field: SortField) => void;
}

function ColumnHeader({
  field,
  active,
  direction,
  children,
  onSort,
}: ColumnHeaderProps) {
  const ariaSort: "none" | "ascending" | "descending" =
    active && direction === "asc"
      ? "ascending"
      : active && direction === "desc"
        ? "descending"
        : "none";

  return (
    <button
      type="button"
      className={cx(
        "fo-column-button",
        active && "fo-column-button-active",
        active && `fo-column-button-${direction}`,
      )}
      aria-sort={ariaSort}
      onClick={() => onSort(field)}
    >
      <span className="fo-column-label">{children}</span>
      {active ? (
        <span className="fo-column-sort" aria-hidden="true">
          {direction === "asc" ? "▲" : "▼"}
        </span>
      ) : null}
    </button>
  );
}

interface FileListSkeletonProps {
  rowHeight: number;
  viewMode: ViewMode;
}

function FileListSkeleton({ rowHeight, viewMode }: FileListSkeletonProps) {
  const rows = viewMode === "icons" ? 8 : 12;

  if (viewMode === "icons") {
    return (
      <div className="fo-file-skeleton fo-file-skeleton-icons" aria-busy="true">
        {Array.from({ length: rows }, (_, index) => (
          <div className="fo-file-skeleton-card" key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className="fo-file-skeleton" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          className="fo-file-skeleton-row"
          key={index}
          style={{ height: rowHeight }}
        />
      ))}
    </div>
  );
}

interface FileRowProps {
  entry: FileEntryDto;
  top: number;
  rowHeight: number;
  viewMode: ViewMode;
  selected: boolean;
  multiSelected: boolean;
  focused: boolean;
  onSelect: (entryId: string | null) => void;
  onEntrySelect: (entryId: string, mode: "single" | "toggle" | "range") => void;
  onEntryActivate: (entry: FileEntryDto | null) => void;
  onContextMenu: (
    event: MouseEvent<HTMLElement>,
    entry: FileEntryDto | null,
  ) => void;
}

function FileRow({
  entry,
  top,
  rowHeight,
  viewMode,
  selected,
  multiSelected,
  focused,
  onSelect,
  onEntrySelect,
  onEntryActivate,
  onContextMenu,
}: FileRowProps) {
  const typeLabel =
    entry.kind === "directory"
      ? "Folder"
      : entry.extension
        ? entry.extension.toUpperCase()
        : "File";

  return (
    <div
      role="row"
      aria-selected={selected || multiSelected}
      className={cx(
        "fo-row",
        selected || multiSelected ? "fo-row-selected" : "",
        focused ? "fo-row-focused" : "",
      )}
      style={{
        transform: viewMode === "icons" ? undefined : `translateY(${top}px)`,
        height: viewMode === "icons" ? undefined : rowHeight,
      }}
      onClick={(event) => {
        const mode = event.shiftKey
          ? "range"
          : event.metaKey || event.ctrlKey
            ? "toggle"
            : "single";

        if (mode === "single") {
          onSelect(entry.uri);
        } else {
          onEntrySelect(entry.uri, mode);
        }
      }}
      onDoubleClick={() => onEntryActivate(entry)}
      draggable
      onDragStart={(event: DragEvent<HTMLDivElement>) => {
        event.dataTransfer.setData(URI_MIME, entry.uri);
        event.dataTransfer.setData("application/x-fileoctopus-name", entry.name);
        event.dataTransfer.effectAllowed = "move";
      }}
      onContextMenu={(event) => {
        event.stopPropagation();
        onContextMenu(event, entry);
      }}
    >
      <span className="fo-row-name">
        <span className="fo-row-icon" aria-hidden="true">
          {fileIconGlyph(entry)}
        </span>
        <span className="fo-row-text" title={entry.name}>
          {entry.name}
        </span>
      </span>
      {viewMode === "details" || viewMode === "list" ? (
        <>
          <span>{formatSize(entry.size)}</span>
          <span>{formatDate(entry.modifiedAt)}</span>
          <span>{typeLabel}</span>
        </>
      ) : null}
    </div>
  );
}
