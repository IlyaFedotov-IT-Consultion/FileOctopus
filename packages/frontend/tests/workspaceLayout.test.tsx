import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useWorkspaceLayout } from "../src/hooks/useWorkspaceLayout";

function createWorkspaceElement(width: number): HTMLDivElement {
  const el = document.createElement("div");
  // Mock clientWidth
  Object.defineProperty(el, "clientWidth", {
    value: width,
    configurable: true,
  });
  Object.defineProperty(el, "dataset", {
    value: {},
    configurable: true,
  });
  document.body.appendChild(el);
  return el;
}

describe("useWorkspaceLayout", () => {
  let elements: HTMLDivElement[] = [];

  beforeEach(() => {
    elements = [];
  });

  afterEach(() => {
    for (const el of elements) {
      el.remove();
    }
  });

  it("sets data-layout=narrow when width < 820", () => {
    const el = createWorkspaceElement(600);
    elements.push(el);

    renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(el);
      useWorkspaceLayout({
        workspaceRef: ref,
        sidebarWidth: 240,
        activityCollapsed: true,
        activityPanelVisible: false,
        onCollapseActivity: vi.fn(),
      });
      return null;
    });

    expect(el.dataset.layout).toBe("narrow");
  });

  it("sets data-layout=medium when 820 <= width < 1040", () => {
    const el = createWorkspaceElement(900);
    elements.push(el);

    renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(el);
      useWorkspaceLayout({
        workspaceRef: ref,
        sidebarWidth: 240,
        activityCollapsed: true,
        activityPanelVisible: false,
        onCollapseActivity: vi.fn(),
      });
      return null;
    });

    expect(el.dataset.layout).toBe("medium");
  });

  it("sets data-layout=wide when width >= 1040", () => {
    const el = createWorkspaceElement(1400);
    elements.push(el);

    renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(el);
      useWorkspaceLayout({
        workspaceRef: ref,
        sidebarWidth: 240,
        activityCollapsed: true,
        activityPanelVisible: false,
        onCollapseActivity: vi.fn(),
      });
      return null;
    });

    expect(el.dataset.layout).toBe("wide");
  });

  it("sets layoutTier=xs when width < 700", () => {
    const el = createWorkspaceElement(500);
    elements.push(el);

    renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(el);
      useWorkspaceLayout({
        workspaceRef: ref,
        sidebarWidth: 240,
        activityCollapsed: true,
        activityPanelVisible: false,
        onCollapseActivity: vi.fn(),
      });
      return null;
    });

    expect(el.dataset.layoutTier).toBe("xs");
  });

  it("sets layoutTier=sm when 700 <= width < 900", () => {
    const el = createWorkspaceElement(800);
    elements.push(el);

    renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(el);
      useWorkspaceLayout({
        workspaceRef: ref,
        sidebarWidth: 240,
        activityCollapsed: true,
        activityPanelVisible: false,
        onCollapseActivity: vi.fn(),
      });
      return null;
    });

    expect(el.dataset.layoutTier).toBe("sm");
  });

  it("sets layoutTier=md when 900 <= width < 1100", () => {
    const el = createWorkspaceElement(1000);
    elements.push(el);

    renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(el);
      useWorkspaceLayout({
        workspaceRef: ref,
        sidebarWidth: 240,
        activityCollapsed: true,
        activityPanelVisible: false,
        onCollapseActivity: vi.fn(),
      });
      return null;
    });

    expect(el.dataset.layoutTier).toBe("md");
  });

  it("sets layoutTier=lg when 1100 <= width < 1400", () => {
    const el = createWorkspaceElement(1200);
    elements.push(el);

    renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(el);
      useWorkspaceLayout({
        workspaceRef: ref,
        sidebarWidth: 240,
        activityCollapsed: true,
        activityPanelVisible: false,
        onCollapseActivity: vi.fn(),
      });
      return null;
    });

    expect(el.dataset.layoutTier).toBe("lg");
  });

  it("sets layoutTier=xl when width >= 1400", () => {
    const el = createWorkspaceElement(1600);
    elements.push(el);

    renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(el);
      useWorkspaceLayout({
        workspaceRef: ref,
        sidebarWidth: 240,
        activityCollapsed: true,
        activityPanelVisible: false,
        onCollapseActivity: vi.fn(),
      });
      return null;
    });

    expect(el.dataset.layoutTier).toBe("xl");
  });

  it("sets data-workspace=compact when width is insufficient for dual pane", () => {
    // sidebarWidth=240, resizer=4, dualPane=420*2+4=844, rail=44 → required=1132
    // With width=900, 900 < 1132 → compact
    const el = createWorkspaceElement(900);
    elements.push(el);

    renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(el);
      useWorkspaceLayout({
        workspaceRef: ref,
        sidebarWidth: 240,
        activityCollapsed: true,
        activityPanelVisible: false,
        onCollapseActivity: vi.fn(),
      });
      return null;
    });

    expect(el.dataset.workspace).toBe("compact");
  });

  it("sets data-workspace=comfortable when width is sufficient", () => {
    // required = 240 + 4 + 844 + 44 = 1132
    // width=1400 > 1132 → comfortable
    const el = createWorkspaceElement(1400);
    elements.push(el);

    renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(el);
      useWorkspaceLayout({
        workspaceRef: ref,
        sidebarWidth: 240,
        activityCollapsed: true,
        activityPanelVisible: false,
        onCollapseActivity: vi.fn(),
      });
      return null;
    });

    expect(el.dataset.workspace).toBe("comfortable");
  });

  it("calls onCollapseActivity when width insufficient and activity panel open", () => {
    const onCollapse = vi.fn();
    const el = createWorkspaceElement(600);
    elements.push(el);

    renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(el);
      useWorkspaceLayout({
        workspaceRef: ref,
        sidebarWidth: 240,
        activityCollapsed: false,
        activityPanelVisible: true,
        onCollapseActivity: onCollapse,
      });
      return null;
    });

    expect(onCollapse).toHaveBeenCalled();
  });

  it("does not call onCollapseActivity when activity panel is already collapsed", () => {
    const onCollapse = vi.fn();
    const el = createWorkspaceElement(600);
    elements.push(el);

    renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(el);
      useWorkspaceLayout({
        workspaceRef: ref,
        sidebarWidth: 240,
        activityCollapsed: true,
        activityPanelVisible: true,
        onCollapseActivity: onCollapse,
      });
      return null;
    });

    expect(onCollapse).not.toHaveBeenCalled();
  });

  it("does nothing when workspaceRef.current is null", () => {
    const result = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(null);
      useWorkspaceLayout({
        workspaceRef: ref,
        sidebarWidth: 240,
        activityCollapsed: true,
        activityPanelVisible: false,
        onCollapseActivity: vi.fn(),
      });
      return null;
    });

    // Should not throw
    expect(result.result.current).toBeNull();
  });

  it("skips evaluation when clientWidth <= 0", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "clientWidth", { value: 0, configurable: true });
    Object.defineProperty(el, "dataset", { value: {}, configurable: true });
    document.body.appendChild(el);
    elements.push(el);

    renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(el);
      useWorkspaceLayout({
        workspaceRef: ref,
        sidebarWidth: 240,
        activityCollapsed: true,
        activityPanelVisible: false,
        onCollapseActivity: vi.fn(),
      });
      return null;
    });

    // Should not have set any dataset attributes
    expect(el.dataset.layout).toBeUndefined();
  });

  it("returns markActivityPinnedOpen function", () => {
    const el = createWorkspaceElement(1400);
    elements.push(el);

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(el);
      return useWorkspaceLayout({
        workspaceRef: ref,
        sidebarWidth: 240,
        activityCollapsed: true,
        activityPanelVisible: false,
        onCollapseActivity: vi.fn(),
      });
    });

    expect(result.current.markActivityPinnedOpen).toBeInstanceOf(Function);
  });

  it("accounts for expanded activity panel in required width", () => {
    // With activityPanelVisible=true and collapsed=false, rail=320
    // required = 240 + 4 + 844 + 320 = 1408
    // width=1300 < 1408 → compact
    const el = createWorkspaceElement(1300);
    elements.push(el);

    renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(el);
      useWorkspaceLayout({
        workspaceRef: ref,
        sidebarWidth: 240,
        activityCollapsed: false,
        activityPanelVisible: true,
        onCollapseActivity: vi.fn(),
      });
      return null;
    });

    expect(el.dataset.workspace).toBe("compact");
  });
});
