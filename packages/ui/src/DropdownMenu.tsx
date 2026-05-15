import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "./cx";
import { Button } from "./Button";

export interface DropdownMenuItem {
  id: string;
  label: string;
  disabled?: boolean;
  onSelect: () => void;
}

export interface DropdownMenuProps {
  label: string;
  open: boolean;
  items: DropdownMenuItem[];
  onOpenChange: (open: boolean) => void;
  triggerClassName?: string;
  align?: "start" | "end";
  children?: ReactNode;
}

export function DropdownMenu({
  label,
  open,
  items,
  onOpenChange,
  triggerClassName,
  align = "end",
  children,
}: DropdownMenuProps) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onOpenChange, open]);

  return (
    <div ref={rootRef} className={cx("fo-ui-dropdown", align === "start" ? "fo-ui-dropdown--start" : "fo-ui-dropdown--end")}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={triggerClassName}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => onOpenChange(!open)}
      >
        {children ?? label}
      </Button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="fo-ui-dropdown-menu"
          onClick={(event) => event.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="fo-ui-dropdown-item"
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
                onOpenChange(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
