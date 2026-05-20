import type { ReactNode } from "react";
import type { FileOctopusClient } from "@fileoctopus/ts-api";
import type { PanelId } from "../panelStore";
import { TerminalTabBar } from "../terminal/TerminalTabBar";
import { TerminalView } from "../terminal/TerminalView";
import type { TerminalSession } from "../terminal/terminalSlice";
import { sessionsForPane } from "../terminal/terminalSlice";

export interface PaneTerminalRegionProps {
  paneId: PanelId;
  sessions: TerminalSession[];
  activeSessionId: string | null;
  client: FileOctopusClient;
  panelActive: boolean;
  onSwitch: (sessionId: string) => void;
  onClose: (sessionId: string) => void;
  onNewSession: () => void;
  onSessionExited: (sessionId: string, exitCode?: number | null) => void;
  tabBarActions?: ReactNode;
}

export function PaneTerminalRegion({
  paneId,
  sessions,
  activeSessionId,
  client,
  panelActive,
  onSwitch,
  onClose,
  onNewSession,
  onSessionExited,
  tabBarActions,
}: PaneTerminalRegionProps) {
  const paneSessions = sessionsForPane(sessions, paneId);
  if (paneSessions.length === 0) {
    return null;
  }

  const resolvedActiveId =
    activeSessionId &&
    paneSessions.some((session) => session.id === activeSessionId)
      ? activeSessionId
      : (paneSessions[paneSessions.length - 1]?.id ?? null);

  return (
    <div
      className="fo-pane-terminal-inner"
      role="region"
      aria-label={`Pane ${paneId} terminal`}
    >
      <TerminalTabBar
        sessions={paneSessions}
        activeSessionId={resolvedActiveId}
        onSwitch={onSwitch}
        onClose={onClose}
        onNew={onNewSession}
        actions={tabBarActions}
      />
      <div className="fo-pane-terminal-views">
        {paneSessions.map((session) => (
          <div
            key={session.id}
            className="fo-pane-terminal-view-wrap"
            hidden={session.id !== resolvedActiveId}
          >
            {session.id.startsWith("pending-") ? (
              <div className="fo-empty-inline">Starting shell…</div>
            ) : (
              <TerminalView
                client={client}
                sessionId={session.id}
                active={panelActive && session.id === resolvedActiveId}
                onExit={(exitCode) => onSessionExited(session.id, exitCode)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
