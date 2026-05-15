import { useState } from "react";
import { DropdownMenu, ToolbarButton } from "@fileoctopus/ui";
import type { ViewMode } from "../panelStore";

export interface OperationToolbarProps {
  selectedCount: number;
  canRename: boolean;
  canPaste: boolean;
  showHidden: boolean;
  viewMode: ViewMode;
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
  viewMode,
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
          <ToolbarAction icon="+D" label="New Folder" />
        </ToolbarButton>
        <ToolbarButton onClick={onCreateFile}>
          <ToolbarAction icon="+F" label="New File" />
        </ToolbarButton>
        <ToolbarButton disabled={!canRename} onClick={onRename}>
          <ToolbarAction icon="Rn" label="Rename" />
        </ToolbarButton>
        <ToolbarButton disabled={selectedCount === 0} onClick={onCopy}>
          <ToolbarAction icon="Cp" label="Copy" />
        </ToolbarButton>
        <ToolbarButton disabled={selectedCount === 0} onClick={onMove}>
          <ToolbarAction icon="Mv" label="Move" />
        </ToolbarButton>
        {canPaste ? (
          <ToolbarButton onClick={onPaste}>
            <ToolbarAction icon="Ps" label="Paste" />
          </ToolbarButton>
        ) : null}
        <ToolbarButton disabled={selectedCount === 0} onClick={onTrash}>
          <ToolbarAction icon="Tr" label="Trash" />
        </ToolbarButton>
        <ToolbarButton onClick={onRefresh}>
          <ToolbarAction icon="Rf" label="Refresh" />
        </ToolbarButton>
      </div>
      <DropdownMenu
        label="More"
        open={overflowOpen}
        onOpenChange={setOverflowOpen}
        align="end"
        items={[
          {
            id: "new-file",
            label: "New File",
            icon: "+F",
            shortcut: "Cmd+N",
            onSelect: onCreateFile,
          },
          {
            id: "rename",
            label: "Rename",
            icon: "Rn",
            shortcut: "F2",
            disabled: !canRename,
            onSelect: onRename,
          },
          {
            id: "cut",
            label: "Cut",
            icon: "Ct",
            shortcut: "Cmd+X",
            disabled: selectedCount === 0,
            onSelect: onCut,
          },
          {
            id: "paste",
            label: "Paste",
            icon: "Ps",
            shortcut: "Cmd+V",
            disabled: !canPaste,
            onSelect: onPaste,
          },
          {
            id: "copy-to",
            label: "Copy To",
            icon: "To",
            separatorBefore: true,
            disabled: selectedCount === 0,
            onSelect: onCopyOperation,
          },
          {
            id: "copy-path",
            label: "Copy Path",
            icon: "Pa",
            disabled: selectedCount === 0,
            onSelect: onCopyPath,
          },
          {
            id: "copy-name",
            label: "Copy Name",
            icon: "Nm",
            disabled: selectedCount === 0,
            onSelect: onCopyName,
          },
          {
            id: "delete",
            label: "Delete Permanently",
            icon: "Del",
            danger: true,
            separatorBefore: true,
            disabled: selectedCount === 0,
            onSelect: onPermanentDelete,
          },
          {
            id: "properties",
            label: "Properties",
            icon: "Info",
            shortcut: "Cmd+I",
            onSelect: onProperties,
          },
          {
            id: "hidden",
            label: showHidden ? "Hide Hidden" : "Show Hidden",
            icon: "Eye",
            shortcut: "Cmd+.",
            checked: showHidden,
            separatorBefore: true,
            onSelect: onToggleHidden,
          },
          {
            id: "view-details",
            label: "Details view",
            icon: "Det",
            checked: viewMode === "details",
            separatorBefore: true,
            onSelect: () => onViewMode("details"),
          },
          {
            id: "view-list",
            label: "List view",
            icon: "Lst",
            checked: viewMode === "list",
            onSelect: () => onViewMode("list"),
          },
          {
            id: "view-icons",
            label: "Icons view",
            icon: "Ico",
            checked: viewMode === "icons",
            onSelect: () => onViewMode("icons"),
          },
          {
            id: "view-columns",
            label: "Columns view",
            icon: "Col",
            checked: viewMode === "columns",
            onSelect: () => onViewMode("columns"),
          },
        ]}
      >
        <ToolbarAction icon="..." label="More" />
      </DropdownMenu>
      <span className="fo-toolbar-meta">{selectedCount} selected</span>
    </div>
  );
}

function ToolbarAction({ icon, label }: { icon: string; label: string }) {
  return (
    <>
      <span className="fo-toolbar-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </>
  );
}
