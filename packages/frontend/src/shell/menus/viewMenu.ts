import type { DropdownMenuItem } from "@fileoctopus/ui";
import type { MenuBarProps, MenuHelpers } from "./types";

export function buildViewItems(
  props: MenuBarProps,
  { wrap, wrapArg, sep }: MenuHelpers,
): DropdownMenuItem[] {
  return [
    {
      id: "view-details",
      label: "Details View",
      onSelect: wrapArg(props.onViewMode, "details"),
    },
    {
      id: "view-list",
      label: "List View",
      onSelect: wrapArg(props.onViewMode, "list"),
    },
    {
      id: "view-compact",
      label: "Compact View",
      onSelect: wrapArg(props.onViewMode, "compact"),
    },
    {
      id: "view-icons",
      label: "Icons View",
      onSelect: wrapArg(props.onViewMode, "icons"),
    },
    {
      id: "view-columns",
      label: "Columns View",
      onSelect: wrapArg(props.onViewMode, "columns"),
    },
    sep("sep-sort"),
    {
      id: "sort-by",
      label: "Sort By",
      onSelect: () => {},
      children: [
        {
          id: "sort-name",
          label: "Name",
          onSelect: wrapArg(props.onSortBy, "name"),
        },
        {
          id: "sort-type",
          label: "Type",
          onSelect: wrapArg(props.onSortBy, "type"),
        },
        {
          id: "sort-size",
          label: "Size",
          onSelect: wrapArg(props.onSortBy, "size"),
        },
        {
          id: "sort-date-modified",
          label: "Date Modified",
          onSelect: wrapArg(props.onSortBy, "modified"),
        },
        {
          id: "sort-date-created",
          label: "Date Created",
          onSelect: wrapArg(props.onSortBy, "created"),
        },
        {
          id: "sort-extension",
          label: "Extension",
          onSelect: wrapArg(props.onSortBy, "extension"),
        },
        {
          id: "sort-permissions",
          label: "Permissions",
          onSelect: wrapArg(props.onSortBy, "permissions"),
        },
        {
          id: "sort-owner",
          label: "Owner",
          onSelect: wrapArg(props.onSortBy, "owner"),
        },
        {
          id: "sort-asc",
          label: "Ascending",
          separatorBefore: true,
          onSelect: wrapArg(props.onSortDirection, "ascending"),
        },
        {
          id: "sort-desc",
          label: "Descending",
          onSelect: wrapArg(props.onSortDirection, "descending"),
        },
      ],
    },
    sep("sep-appearance"),
    {
      id: "theme-system",
      label: "Theme: System",
      onSelect: wrapArg(props.onTheme, "system"),
    },
    {
      id: "theme-light",
      label: "Theme: Light",
      onSelect: wrapArg(props.onTheme, "light"),
    },
    {
      id: "theme-dark",
      label: "Theme: Dark",
      onSelect: wrapArg(props.onTheme, "dark"),
    },
    sep("sep-density"),
    {
      id: "density-compact",
      label: "Density: Compact",
      onSelect: wrapArg(props.onDensity, "compact"),
    },
    {
      id: "density-comfortable",
      label: "Density: Comfortable",
      onSelect: wrapArg(props.onDensity, "comfortable"),
    },
    {
      id: "density-spacious",
      label: "Density: Spacious",
      onSelect: wrapArg(props.onDensity, "spacious"),
    },
    sep("sep-layout"),
    {
      id: "toggle-sidebar",
      label: "Show Sidebar",
      checked: props.sidebarVisible,
      onSelect: wrap(props.onToggleSidebar),
    },
    {
      id: "toggle-toolbar",
      label: "Show Toolbar",
      checked: props.toolbarVisible,
      onSelect: wrap(props.onToggleToolbar),
    },
    {
      id: "customize-toolbar",
      label: "Customize Button Bar…",
      disabled: !props.toolbarVisible,
      onSelect: wrap(props.onCustomizeToolbar),
    },
    {
      id: "toggle-statusbar",
      label: "Show Status Bar",
      checked: props.statusBarVisible,
      onSelect: wrap(props.onToggleStatusBar),
    },
    {
      id: "toggle-dualpane",
      label: "Dual Pane",
      checked: props.dualPane,
      onSelect: wrap(props.onToggleDualPane),
    },
    {
      id: "toggle-pane-direction",
      label:
        props.paneDirection === "vertical"
          ? "Split: Vertical"
          : "Split: Horizontal",
      disabled: !props.dualPane,
      onSelect: wrap(props.onTogglePaneDirection),
    },
    sep("sep-hidden"),
    {
      id: "toggle-hidden",
      label: "Show Hidden Files",
      checked: props.showHidden,
      shortcut: "Ctrl+.",
      onSelect: wrap(props.onToggleHidden),
    },
    {
      id: "refresh",
      label: "Refresh",
      shortcut: "Ctrl+R",
      separatorBefore: true,
      onSelect: wrap(props.onRefresh),
    },
  ];
}
