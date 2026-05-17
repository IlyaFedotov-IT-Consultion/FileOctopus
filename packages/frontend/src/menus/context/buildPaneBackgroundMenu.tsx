import type { ReactNode } from "react";
import type { PanelId, ViewMode } from "../../panelStore";
import { ContextMenuItem, ContextMenuSeparator } from "./ContextMenuPrimitives";

interface PaneBackgroundMenuParams {
  panelId: PanelId;
  canPaste: boolean;
  showHidden: boolean;
  run: (action: () => void) => void;
  onPaste: (panelId: PanelId) => void;
  onCreateFolder: (panelId: PanelId) => void;
  onCreateFile: (panelId: PanelId) => void;
  onRefresh: (panelId: PanelId) => void;
  onToggleHidden: (panelId: PanelId) => void;
  onViewMode: (panelId: PanelId, viewMode: ViewMode) => void;
  onProperties: (panelId: PanelId, entry: null) => void;
}

export function buildPaneBackgroundMenu({
  panelId,
  canPaste,
  showHidden,
  run,
  onPaste,
  onCreateFolder,
  onCreateFile,
  onRefresh,
  onToggleHidden,
  onViewMode,
  onProperties,
}: PaneBackgroundMenuParams): ReactNode {
  return (
    <>
      <ContextMenuItem
        disabled={!canPaste}
        onClick={() => run(() => onPaste(panelId))}
      >
        Paste
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onCreateFolder(panelId))}>
        New Folder
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onCreateFile(panelId))}>
        New File
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => run(() => onRefresh(panelId))}>
        Refresh
      </ContextMenuItem>
      <ContextMenuItem onClick={() => run(() => onToggleHidden(panelId))}>
        {showHidden ? "Hide Hidden Files" : "Show Hidden Files"}
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => run(() => onViewMode(panelId, "details"))}
      >
        Details View
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => run(() => onProperties(panelId, null))}>
        Current Folder Properties
      </ContextMenuItem>
    </>
  );
}
