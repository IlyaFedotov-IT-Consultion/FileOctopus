import type { ReactNode } from "react";
import { Button, Icons } from "@fileoctopus/ui";

export function ContextMenuItem({
  disabled,
  disabledReason,
  icon,
  label,
  onClick,
  shortcut,
  submenu,
  tone,
  children,
}: {
  disabled?: boolean;
  disabledReason?: string;
  icon?: ReactNode;
  label?: ReactNode;
  onClick: () => void;
  shortcut?: string;
  submenu?: boolean;
  tone?: "default" | "danger";
  children?: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={[
        "fo-context-menu-item",
        submenu ? "fo-context-menu-item--submenu" : null,
        tone === "danger" ? "fo-context-menu-item--danger" : null,
      ]
        .filter(Boolean)
        .join(" ")}
      role="menuitem"
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      aria-disabled={disabled ? true : undefined}
      aria-haspopup={submenu ? "menu" : undefined}
      onClick={onClick}
    >
      <span className="fo-context-menu-item-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="fo-context-menu-item-label">{label ?? children}</span>
      {shortcut ? (
        <span className="fo-context-menu-item-shortcut">{shortcut}</span>
      ) : null}
      {submenu ? (
        <span className="fo-context-menu-item-caret" aria-hidden="true">
          {Icons.chevronRight()}
        </span>
      ) : null}
    </Button>
  );
}

export function ContextMenuSeparator() {
  return <div className="fo-context-menu-separator" role="separator" />;
}

export function ContextMenuSubmenu({
  children,
  icon,
  label,
}: {
  children: ReactNode;
  icon?: ReactNode;
  label: ReactNode;
}) {
  return (
    <div className="fo-context-menu-submenu">
      <ContextMenuItem icon={icon} label={label} onClick={() => {}} submenu />
      <div className="fo-context-submenu" role="menu">
        {children}
      </div>
    </div>
  );
}
