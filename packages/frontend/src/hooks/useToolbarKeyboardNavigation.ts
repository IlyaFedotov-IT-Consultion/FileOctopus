import { useEffect, type RefObject } from "react";

function toolbarFocusables(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [role="button"]:not([aria-disabled="true"])',
    ),
  ).filter((element) => element.tabIndex !== -1);
}

function toolbarGroups(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(".fo-toolbar-group"));
}

function groupForElement(
  root: HTMLElement,
  element: HTMLElement,
): HTMLElement | null {
  const group = element.closest(".fo-toolbar-group");
  if (!(group instanceof HTMLElement) || !root.contains(group)) {
    return null;
  }
  return group;
}

function firstFocusableInGroup(group: HTMLElement): HTMLElement | undefined {
  return toolbarFocusables(group)[0];
}

export function useToolbarKeyboardNavigation(
  containerRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "ArrowLeft" &&
        event.key !== "ArrowRight" &&
        event.key !== "Home" &&
        event.key !== "End"
      ) {
        return;
      }

      const focused = document.activeElement;
      if (!(focused instanceof HTMLElement) || !root.contains(focused)) {
        return;
      }

      const items = toolbarFocusables(root);
      const index = items.indexOf(focused);
      if (index === -1) {
        return;
      }

      event.preventDefault();

      if (event.key === "Home") {
        items[0]?.focus();
        return;
      }
      if (event.key === "End") {
        items[items.length - 1]?.focus();
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        const groups = toolbarGroups(root);
        const currentGroup = groupForElement(root, focused);
        if (!currentGroup || groups.length === 0) {
          return;
        }
        const groupIndex = groups.indexOf(currentGroup);
        if (groupIndex === -1) {
          return;
        }
        const delta = event.key === "ArrowRight" ? 1 : -1;
        for (let step = 1; step <= groups.length; step += 1) {
          const nextGroup =
            groups[(groupIndex + delta * step + groups.length) % groups.length];
          const nextFocus = firstFocusableInGroup(nextGroup);
          if (nextFocus) {
            nextFocus.focus();
            return;
          }
        }
        return;
      }

      const delta = event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + delta + items.length) % items.length;
      items[nextIndex]?.focus();
    };

    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [containerRef]);
}
