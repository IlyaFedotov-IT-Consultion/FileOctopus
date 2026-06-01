import { useState, useCallback, useEffect, useRef } from "react";
import { DropdownMenu, type DropdownMenuItem } from "@fileoctopus/ui";
import type { MenuBarProps, MenuHelpers, MenuId } from "./menus/types";
import { MENU_ORDER, MENU_MNEMONICS } from "./menus/types";
import { buildFileItems } from "./menus/fileMenu";
import { buildEditItems } from "./menus/editMenu";
import { buildViewItems } from "./menus/viewMenu";
import { buildGoItems } from "./menus/goMenu";
import { buildToolsItems } from "./menus/toolsMenu";
import { buildWindowItems } from "./menus/windowMenu";
import { buildHelpItems } from "./menus/helpMenu";

export type { MenuBarProps } from "./menus/types";

export function MenuBar(props: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const menubarRef = useRef<HTMLDivElement>(null);

  const closeAll = useCallback(() => setOpenMenu(null), []);

  const handleHover = useCallback(
    (id: MenuId) => {
      if (openMenu !== null && openMenu !== id) {
        setOpenMenu(id);
      }
    },
    [openMenu],
  );

  useEffect(() => {
    if (openMenu === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAll();
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const idx = MENU_ORDER.indexOf(openMenu);
        const next =
          event.key === "ArrowRight"
            ? MENU_ORDER[(idx + 1) % MENU_ORDER.length]
            : MENU_ORDER[(idx - 1 + MENU_ORDER.length) % MENU_ORDER.length];
        setOpenMenu(next);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu, closeAll]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey) return;
      const key = event.key.toUpperCase();
      for (const id of MENU_ORDER) {
        if (MENU_MNEMONICS[id] === key) {
          event.preventDefault();
          setOpenMenu(id);
          return;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const wrap = (fn: () => void) => () => {
    closeAll();
    fn();
  };

  const wrapArg = (fn: (arg: string) => void, arg: string) => () => {
    closeAll();
    fn(arg);
  };

  const sep = (id: string): DropdownMenuItem => ({
    id,
    label: "",
    separatorBefore: true,
    onSelect: () => {},
  });

  const helpers: MenuHelpers = { wrap, wrapArg, sep };

  const fileItems = buildFileItems(props, helpers);
  const editItems = buildEditItems(props, helpers);
  const viewItems = buildViewItems(props, helpers);
  const goItems = buildGoItems(props, helpers);
  const toolsItems = buildToolsItems(props, helpers);
  const windowItems = buildWindowItems(props, helpers);
  const helpItems = buildHelpItems(props, helpers);

  const menus: { id: MenuId; label: string; items: DropdownMenuItem[] }[] = [
    { id: "file", label: "File", items: fileItems },
    { id: "edit", label: "Edit", items: editItems },
    { id: "view", label: "View", items: viewItems },
    { id: "go", label: "Go", items: goItems },
    { id: "tools", label: "Tools", items: toolsItems },
    { id: "window", label: "Window", items: windowItems },
    { id: "help", label: "Help", items: helpItems },
  ];

  return (
    <div ref={menubarRef} className="fo-menubar" role="menubar">
      {menus.map((menu) => (
        <DropdownMenu
          key={menu.id}
          label={menu.label}
          open={openMenu === menu.id}
          items={menu.items}
          onOpenChange={(open) => {
            if (open) {
              setOpenMenu(menu.id);
            } else {
              closeAll();
            }
          }}
          align="start"
          triggerClassName="fo-menubar-trigger"
        >
          <span
            className="fo-menubar-trigger-inner"
            role="menuitem"
            onMouseEnter={() => handleHover(menu.id)}
          >
            {underlineMnemonic(menu.label, MENU_MNEMONICS[menu.id])}
          </span>
        </DropdownMenu>
      ))}
    </div>
  );
}

function underlineMnemonic(label: string, mnemonic: string): React.ReactNode {
  const idx = label.toUpperCase().indexOf(mnemonic);
  if (idx === -1) return label;
  return (
    <>
      {label.slice(0, idx)}
      <u>{label[idx]}</u>
      {label.slice(idx + 1)}
    </>
  );
}
