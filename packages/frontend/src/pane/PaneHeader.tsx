import type { MouseEvent } from "react";
import { Icons, ToolbarButton } from "@fileoctopus/ui";
import { toolbarCommandMeta } from "../commands/toolbarConfig";
import { PathBar } from "./PanePathBar";

interface PaneHeaderProps {
  uri: string;
  pathError: string | null;
  pathFocusToken: number;
  onNavigate: (uri: string) => void;
  onBreadcrumbContextMenu?: (path: string, event: MouseEvent) => void;
  onOpenTerminal?: () => void;
  terminalDisabled?: boolean;
}

export function PaneHeader({
  uri,
  pathError,
  pathFocusToken,
  onNavigate,
  onBreadcrumbContextMenu,
  onOpenTerminal,
  terminalDisabled = false,
}: PaneHeaderProps) {
  const terminalMeta = toolbarCommandMeta("op.openTerminal");

  return (
    <header className="fo-panel-header">
      <div className="fo-panel-title-row">
        <PathBar
          value={uri}
          error={pathError}
          focusToken={pathFocusToken}
          onSubmit={onNavigate}
          onBreadcrumbContextMenu={onBreadcrumbContextMenu}
        />
      </div>
      {onOpenTerminal ? (
        <div
          className="fo-panel-header-actions"
          role="group"
          aria-label="Pane actions"
        >
          <ToolbarButton
            className="fo-panel-terminal-btn"
            disabled={terminalDisabled}
            title={terminalMeta.tooltip}
            aria-label={terminalMeta.label}
            onClick={(event) => {
              event.stopPropagation();
              onOpenTerminal();
            }}
          >
            {Icons.terminal()}
          </ToolbarButton>
        </div>
      ) : null}
    </header>
  );
}
