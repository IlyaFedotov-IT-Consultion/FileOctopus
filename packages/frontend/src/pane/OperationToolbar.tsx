import { useState } from "react";
import { DropdownMenu, ToolbarButton } from "@fileoctopus/ui";
import type { ViewMode } from "../panelStore";

export interface OperationToolbarProps {
  selectedCount: number;
  canRename: boolean;
  canPaste: boolean;
  showHidden: boolean;
  onCreateFolder: () => void;
  onCreateFile: () => void;
  onRename: () => void;
  onCopy: () => void;
  onCut: () => void;
  onCopyOperation: () => void;
  onMove: () => void;
  onPaste: () => void;
  onTrash: () => void;
  onPermanentDelete: () => void;
  onCopyPath: () => void;
  onCopyName: () => void;
  onProperties: () => void;
  onRefresh: () => void;
  onToggleHidden: () => void;
  onViewMode: (viewMode: ViewMode) => void;
}

export function OperationToolbar({
  selectedCount,
  canRename,
  canPaste,
  showHidden,
  onCreateFolder,
  onCreateFile,
  onRename,
  onCopy,
  onCut,
  onCopyOperation,
  onMove,
  onPaste,
  onTrash,
  onPermanentDelete,
  onCopyPath,
  onCopyName,
  onProperties,
  onRefresh,
  onToggleHidden,
  onViewMode,
}: OperationToolbarProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);

  return (
    <div className="fo-operation-toolbar" aria-label="File operations">
      <div className="fo-toolbar-group fo-toolbar-primary">
        <ToolbarButton primary onClick={onCreateFolder}>
          New Folder
        </ToolbarButton>
        <ToolbarButton onClick={onCreateFile}>New File</ToolbarButton>
        <ToolbarButton disabled={!canRename} onClick={onRename}>
          Rename
        </ToolbarButton>
        <ToolbarButton disabled={selectedCount === 0} onClick={onCopy}>
          Copy
        </ToolbarButton>
        <ToolbarButton disabled={selectedCount === 0} onClick={onMove}>
          Move
        </ToolbarButton>
        <ToolbarButton disabled={selectedCount === 0} onClick={onTrash}>
          Trash
        </ToolbarButton>
        <ToolbarButton onClick={onRefresh}>Refresh</ToolbarButton>
      </div>
      <DropdownMenu
        label="More"
        open={overflowOpen}
        onOpenChange={setOverflowOpen}
        align="end"
        items={[
          { id: "new-file", label: "New File", onSelect: onCreateFile },
          {
            id: "rename",
            label: "Rename",
            disabled: !canRename,
            onSelect: onRename,
          },
          {
            id: "cut",
            label: "Cut",
            disabled: selectedCount === 0,
            onSelect: onCut,
          },
          {
            id: "paste",
            label: "Paste",
            disabled: !canPaste,
            onSelect: onPaste,
          },
          {
            id: "copy-to",
            label: "Copy To",
            disabled: selectedCount === 0,
            onSelect: onCopyOperation,
          },
          {
            id: "copy-path",
            label: "Copy Path",
            disabled: selectedCount === 0,
            onSelect: onCopyPath,
          },
          {
            id: "copy-name",
            label: "Copy Name",
            disabled: selectedCount === 0,
            onSelect: onCopyName,
          },
          {
            id: "delete",
            label: "Delete Permanently",
            disabled: selectedCount === 0,
            onSelect: onPermanentDelete,
          },
          { id: "properties", label: "Properties", onSelect: onProperties },
          {
            id: "hidden",
            label: showHidden ? "Hide Hidden" : "Show Hidden",
            onSelect: onToggleHidden,
          },
          {
            id: "view-details",
            label: "Details view",
            onSelect: () => onViewMode("details"),
          },
          {
            id: "view-list",
            label: "List view",
            onSelect: () => onViewMode("list"),
          },
          {
            id: "view-icons",
            label: "Icons view",
            onSelect: () => onViewMode("icons"),
          },
          {
            id: "view-columns",
            label: "Columns view",
            onSelect: () => onViewMode("columns"),
          },
        ]}
      />
      <span className="fo-toolbar-meta">{selectedCount} selected</span>
    </div>
  );
}
