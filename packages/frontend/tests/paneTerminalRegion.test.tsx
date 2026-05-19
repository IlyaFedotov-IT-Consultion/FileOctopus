import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createFileOctopusClient } from "@fileoctopus/ts-api";
import { StubTerminalProvider } from "../src/app/providers/TerminalProvider";
import { PaneTerminalRegion } from "../src/pane/PaneTerminalRegion";

vi.mock("../src/terminal/TerminalView", () => ({
  TerminalView: () => <div data-testid="terminal-view-mock" />,
}));

describe("PaneTerminalRegion", () => {
  it("only renders sessions belonging to this pane", () => {
    const client = createFileOctopusClient();
    render(
      <StubTerminalProvider>
        <PaneTerminalRegion
          paneId="left"
          sessions={[
            {
              id: "a",
              uri: "local:///x",
              label: "x",
              status: "running",
              paneId: "left",
            },
            {
              id: "b",
              uri: "local:///y",
              label: "y",
              status: "running",
              paneId: "right",
            },
            {
              id: "c",
              uri: "local:///z",
              label: "z",
              status: "running",
              paneId: "rail",
            },
          ]}
          activeSessionId="a"
          client={client}
          panelActive
          onSwitch={() => undefined}
          onClose={() => undefined}
          onNewSession={() => undefined}
          onSessionExited={() => undefined}
        />
      </StubTerminalProvider>,
    );
    expect(screen.getByText("x")).toBeTruthy();
    expect(screen.queryByText("y")).toBeNull();
    expect(screen.queryByText("z")).toBeNull();
  });

  it("mounts a terminal view for the active session", () => {
    const client = createFileOctopusClient();
    render(
      <StubTerminalProvider>
        <PaneTerminalRegion
          paneId="left"
          sessions={[
            {
              id: "a",
              uri: "local:///x",
              label: "x",
              status: "running",
              paneId: "left",
            },
          ]}
          activeSessionId="a"
          client={client}
          panelActive
          onSwitch={() => undefined}
          onClose={() => undefined}
          onNewSession={() => undefined}
          onSessionExited={() => undefined}
        />
      </StubTerminalProvider>,
    );
    expect(screen.getAllByTestId("terminal-view-mock").length).toBeGreaterThan(
      0,
    );
  });
});
