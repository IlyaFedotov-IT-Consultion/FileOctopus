import { afterEach, describe, expect, it } from "vitest";
import { createInitialState, activeTab, panelReducer } from "../src/panelStore";
import {
  storedColumnWidths,
  persistColumnWidths,
  storedVisibleColumns,
  persistVisibleColumns,
  type VisibleColumns,
} from "../src/pane/columnWidths";

afterEach(() => {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.indexOf("fileoctopus.") === 0) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
});

describe("per-pane sort persistence", () => {
  it("persists sort independently per pane", () => {
    let state = createInitialState("local:///left", "local:///right");

    // Default sort is name/asc, so setting "size" for left → asc
    state = panelReducer(state, {
      type: "setSort",
      panelId: "left",
      field: "size",
    });

    // Setting "modified" for right → asc
    state = panelReducer(state, {
      type: "setSort",
      panelId: "right",
      field: "modified",
    });

    expect(activeTab(state.panels.left).sort.field).toBe("size");
    expect(activeTab(state.panels.left).sort.direction).toBe("asc");
    expect(activeTab(state.panels.right).sort.field).toBe("modified");
    expect(activeTab(state.panels.right).sort.direction).toBe("asc");

    const leftSort = localStorage.getItem("fileoctopus.sort.left");
    const rightSort = localStorage.getItem("fileoctopus.sort.right");
    expect(leftSort).not.toBeNull();
    expect(rightSort).not.toBeNull();

    const leftParsed = JSON.parse(leftSort!);
    const rightParsed = JSON.parse(rightSort!);
    expect(leftParsed.field).toBe("size");
    expect(rightParsed.field).toBe("modified");
  });

  it("toggling sort direction only affects the target pane", () => {
    let state = createInitialState("local:///left", "local:///right");

    // Default is name/asc; set left to size/asc
    state = panelReducer(state, {
      type: "setSort",
      panelId: "left",
      field: "size",
    });

    // Set right to size/asc
    state = panelReducer(state, {
      type: "setSort",
      panelId: "right",
      field: "size",
    });

    // Toggle left again → size/desc
    state = panelReducer(state, {
      type: "setSort",
      panelId: "left",
      field: "size",
    });

    expect(activeTab(state.panels.left).sort.direction).toBe("desc");
    expect(activeTab(state.panels.right).sort.direction).toBe("asc");
  });
});

describe("per-pane viewMode persistence", () => {
  it("persists viewMode independently per pane", () => {
    let state = createInitialState("local:///left", "local:///right");

    state = panelReducer(state, {
      type: "setViewMode",
      panelId: "left",
      viewMode: "list",
    });

    state = panelReducer(state, {
      type: "setViewMode",
      panelId: "right",
      viewMode: "icons",
    });

    expect(activeTab(state.panels.left).viewMode).toBe("list");
    expect(activeTab(state.panels.right).viewMode).toBe("icons");

    expect(localStorage.getItem("fileoctopus.viewMode.left")).toBe("list");
    expect(localStorage.getItem("fileoctopus.viewMode.right")).toBe("icons");
  });

  it("changing left viewMode does not affect right", () => {
    let state = createInitialState("local:///left", "local:///right");

    state = panelReducer(state, {
      type: "setViewMode",
      panelId: "left",
      viewMode: "list",
    });

    state = panelReducer(state, {
      type: "setViewMode",
      panelId: "left",
      viewMode: "details",
    });

    expect(activeTab(state.panels.right).viewMode).toBe("details");
    expect(localStorage.getItem("fileoctopus.viewMode.left")).toBe("details");
    expect(localStorage.getItem("fileoctopus.viewMode.right")).toBeNull();
  });
});

describe("per-pane showHidden persistence", () => {
  it("persists showHidden independently per pane", () => {
    let state = createInitialState("local:///left", "local:///right");

    state = panelReducer(state, {
      type: "toggleHidden",
      panelId: "left",
    });

    expect(activeTab(state.panels.left).showHidden).toBe(true);
    expect(activeTab(state.panels.right).showHidden).toBe(false);

    expect(localStorage.getItem("fileoctopus.showHidden.left")).toBe("true");
    expect(localStorage.getItem("fileoctopus.showHidden.right")).toBeNull();
  });
});

describe("per-pane column widths persistence", () => {
  it("storedColumnWidths reads per-pane keys", () => {
    persistColumnWidths(
      { name: 300, extension: 60, size: 90, modified: 150, kind: 120 },
      "left",
    );
    persistColumnWidths(
      { name: 200, extension: 50, size: 70, modified: 130, kind: 100 },
      "right",
    );

    const leftWidths = storedColumnWidths("left");
    const rightWidths = storedColumnWidths("right");

    expect(leftWidths.name).toBe(300);
    expect(rightWidths.name).toBe(200);
  });

  it("storedVisibleColumns reads per-pane keys", () => {
    persistVisibleColumns(["name", "size"] as VisibleColumns, "left");
    persistVisibleColumns(
      ["name", "extension", "modified"] as VisibleColumns,
      "right",
    );

    const leftCols = storedVisibleColumns("left");
    const rightCols = storedVisibleColumns("right");

    expect(leftCols).toEqual(["name", "size"]);
    expect(rightCols).toEqual(["name", "extension", "modified"]);
  });
});

describe("hydratePreferences with per-pane values", () => {
  it("hydrates per-pane preferences from localStorage", () => {
    localStorage.setItem("fileoctopus.viewMode.left", "list");
    localStorage.setItem("fileoctopus.viewMode.right", "icons");
    localStorage.setItem("fileoctopus.showHidden.left", "true");
    localStorage.setItem("fileoctopus.showHidden.right", "false");

    let state = createInitialState("local:///left", "local:///right");

    state = panelReducer(state, {
      type: "hydratePreferences",
      showHidden: true,
      viewMode: "details",
    });

    expect(activeTab(state.panels.left).viewMode).toBe("list");
    expect(activeTab(state.panels.right).viewMode).toBe("icons");
    expect(activeTab(state.panels.left).showHidden).toBe(true);
    expect(activeTab(state.panels.right).showHidden).toBe(false);
  });

  it("falls back to global preferences when per-pane values are absent", () => {
    let state = createInitialState("local:///left", "local:///right");

    state = panelReducer(state, {
      type: "hydratePreferences",
      showHidden: true,
      viewMode: "list",
    });

    expect(activeTab(state.panels.left).viewMode).toBe("list");
    expect(activeTab(state.panels.right).viewMode).toBe("list");
    expect(activeTab(state.panels.left).showHidden).toBe(true);
    expect(activeTab(state.panels.right).showHidden).toBe(true);
  });
});
