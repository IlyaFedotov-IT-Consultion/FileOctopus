import { describe, expect, it } from "vitest";
import {
  isToolbarSectionVisible,
  resolveToolbarOverflowTier,
} from "../src/pane/toolbarOverflowTier";

describe("toolbarOverflowTier", () => {
  it("maps toolbar width to overflow tiers", () => {
    expect(resolveToolbarOverflowTier(1400)).toBe("full");
    expect(resolveToolbarOverflowTier(1100)).toBe("comfortable");
    expect(resolveToolbarOverflowTier(900)).toBe("compact");
    expect(resolveToolbarOverflowTier(640)).toBe("minimal");
  });

  it("keeps terminal visible at every overflow tier", () => {
    expect(isToolbarSectionVisible("terminal", "full")).toBe(true);
    expect(isToolbarSectionVisible("terminal", "comfortable")).toBe(true);
    expect(isToolbarSectionVisible("terminal", "compact")).toBe(true);
    expect(isToolbarSectionVisible("terminal", "minimal")).toBe(true);
    expect(isToolbarSectionVisible("archive", "compact")).toBe(false);
    expect(isToolbarSectionVisible("sync", "compact")).toBe(false);
  });

  it("hides settings once the toolbar is no longer full width", () => {
    expect(isToolbarSectionVisible("settings", "full")).toBe(true);
    expect(isToolbarSectionVisible("settings", "comfortable")).toBe(false);
  });
});
