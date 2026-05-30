import { describe, expect, it, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useToolbarOverflowTier } from "../src/hooks/useToolbarOverflowTier";

function createElement(width: number): HTMLDivElement {
  const el = document.createElement("div");
  Object.defineProperty(el, "clientWidth", {
    value: width,
    configurable: true,
  });
  el.getBoundingClientRect = () => ({ width, height: 100 }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

describe("useToolbarOverflowTier", () => {
  let elements: HTMLDivElement[] = [];

  afterEach(() => {
    for (const el of elements) {
      el.remove();
    }
    elements = [];
  });

  it("returns 'full' for wide container (>= 1180)", () => {
    const el = createElement(1200);
    elements.push(el);

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(el);
      return useToolbarOverflowTier(ref);
    });

    expect(result.current).toBe("full");
  });

  it("returns 'comfortable' for medium container (980-1179)", () => {
    const el = createElement(1000);
    elements.push(el);

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(el);
      return useToolbarOverflowTier(ref);
    });

    expect(result.current).toBe("comfortable");
  });

  it("returns 'compact' for narrow container (760-979)", () => {
    const el = createElement(800);
    elements.push(el);

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(el);
      return useToolbarOverflowTier(ref);
    });

    expect(result.current).toBe("compact");
  });

  it("returns 'minimal' for very narrow container (< 760)", () => {
    const el = createElement(500);
    elements.push(el);

    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(el);
      return useToolbarOverflowTier(ref);
    });

    expect(result.current).toBe("minimal");
  });

  it("returns default 'full' when ref is null", () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement | null>(null);
      return useToolbarOverflowTier(ref);
    });

    expect(result.current).toBe("full");
  });
});
