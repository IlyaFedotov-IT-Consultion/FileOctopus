import { describe, expect, it } from "vitest";
import {
  createInitialTerminalState,
  terminalReducer,
} from "../src/terminal/terminalSlice";

describe("Terminal pane routing", () => {
  it("keeps left and right sessions isolated", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "L1",
        uri: "local:///a",
        label: "a",
        status: "running",
        paneId: "left",
      },
    });
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "R1",
        uri: "local:///b",
        label: "b",
        status: "running",
        paneId: "right",
      },
    });
    expect(state.pane.left.sessionId).toBe("L1");
    expect(state.pane.right.sessionId).toBe("R1");
    expect(state.pane.left.open).toBe(true);
    expect(state.pane.right.open).toBe(true);
  });

  it("closing a left session does not affect right active session", () => {
    let state = createInitialTerminalState();
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "L1",
        uri: "local:///a",
        label: "a",
        status: "running",
        paneId: "left",
      },
    });
    state = terminalReducer(state, {
      type: "addSession",
      session: {
        id: "R1",
        uri: "local:///b",
        label: "b",
        status: "running",
        paneId: "right",
      },
    });
    state = terminalReducer(state, { type: "closeSession", sessionId: "L1" });
    expect(state.pane.right.sessionId).toBe("R1");
    expect(state.pane.left.sessionId).toBeNull();
    expect(state.pane.left.open).toBe(false);
  });

  it("does not switch activity rail segment for pane sessions", () => {
    const next = terminalReducer(createInitialTerminalState(), {
      type: "addSession",
      session: {
        id: "L1",
        uri: "local:///a",
        label: "a",
        status: "running",
        paneId: "left",
      },
    });
    expect(next.segment).toBe("activity");
  });
});
