import { describe, expect, it } from "vitest";
import { isEditableTarget, isTerminalInputContext } from "../src/shortcuts";

describe("terminal keyboard context", () => {
  it("treats xterm helper textarea as editable", () => {
    const host = document.createElement("div");
    host.className = "fo-terminal-view-host";
    const xtermRoot = document.createElement("div");
    xtermRoot.className = "xterm";
    const textarea = document.createElement("textarea");
    textarea.className = "xterm-helper-textarea";
    xtermRoot.append(textarea);
    host.append(xtermRoot);
    document.body.append(host);

    textarea.focus();
    expect(isTerminalInputContext()).toBe(true);
    expect(isEditableTarget(textarea)).toBe(true);

    host.remove();
  });
});
