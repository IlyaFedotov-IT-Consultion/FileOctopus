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
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? element.clientWidth;
      setTier(resolveToolbarOverflowTier(width));
    });

    observer.observe(element);
    setTier(resolveToolbarOverflowTier(element.clientWidth));

    return () => observer.disconnect();
  }, [containerRef]);

  return tier;
}
