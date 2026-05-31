import { useEffect, useState, type RefObject } from "react";
import {
  resolveToolbarOverflowTier,
  type ToolbarOverflowTier,
} from "../pane/toolbarOverflowTier";

export function useToolbarOverflowTier(
  containerRef: RefObject<HTMLElement | null>,
): ToolbarOverflowTier {
  const [tier, setTier] = useState<ToolbarOverflowTier>("full");

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    // Always take an initial measurement, even where ResizeObserver is
    // unavailable (e.g. jsdom), so the tier reflects the container width
    // immediately rather than staying at the "full" default.
    setTier(resolveToolbarOverflowTier(element.clientWidth));

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? element.clientWidth;
      setTier(resolveToolbarOverflowTier(width));
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [containerRef]);

  return tier;
}
