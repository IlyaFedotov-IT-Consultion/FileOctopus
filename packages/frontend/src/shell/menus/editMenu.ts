import type { DropdownMenuItem } from "@fileoctopus/ui";
import type { MenuBarProps, MenuHelpers } from "./types";
import { menuShortcut } from "./types";

export function buildEditItems(
  props: MenuBarProps,
  { wrap, sep }: MenuHelpers,
): DropdownMenuItem[] {
  return [
    {
      id: "cut",
      label: "Cut",
      shortcut: menuShortcut("op.cut"),
      disabled: !props.hasSelection,
      onSelect: wrap(props.onCut),
    },
    {
      id: "copy",
      label: "Copy",
      shortcut: menuShortcut("op.copy"),
      disabled: !props.hasSelection,
      onSelect: wrap(props.onCopy),
    },
    {
      id: "paste",
      label: "Paste",
      shortcut: menuShortcut("op.paste"),
      disabled: !props.hasClipboard,
      onSelect: wrap(props.onPaste),
    },
    {
      id: "clear-clipboard",
      label: "Clear File Clipboard",
      disabled: !props.hasClipboard,
      onSelect: wrap(props.onClearClipboard),
    },
    sep("sep-selection"),
    {
      id: "select-all",
      label: "Select All",
      shortcut: menuShortcut("selection.selectAll"),
      onSelect: wrap(props.onSelectAll),
    },
    {
      id: "clear-selection",
      label: "Clear Selection",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onClearSelection),
    },
    {
      id: "invert-selection",
      label: "Invert Selection",
      onSelect: wrap(props.onInvertSelection),
    },
    sep("sep-copy-text"),
    {
      id: "copy-path",
      label: "Copy Full Path",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onCopyPath),
    },
    {
      id: "copy-name",
      label: "Copy File Name",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onCopyName),
    },
    {
      id: "copy-parent-path",
      label: "Copy Parent Folder Path",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onCopyParentPath),
    },
    {
      id: "copy-uri",
      label: "Copy Resource URI",
      disabled: !props.hasSelection,
      onSelect: wrap(props.onCopyResourceUri),
    },
  ];
}
