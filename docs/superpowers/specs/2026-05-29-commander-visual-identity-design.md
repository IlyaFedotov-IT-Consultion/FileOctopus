# Commander Visual Identity — Design

**Date:** 2026-05-29
**Status:** Approved
**Scope owner:** @ilyafedotov

## Goal

Give FileOctopus a distinct Norton/Total Commander visual identity and close the
remaining gaps in the function-key bar — without disturbing the existing dark and
light themes. Three coordinated pieces:

1. **Theme registry** — replace the hardcoded `system | light | dark` handling
   with a small data-driven registry so additional themes are additive.
2. **Commander Blue theme** — an opt-in retro skin (classic blue field, cyan
   text, bright cursor bar) applied to core surfaces via token overrides.
3. **Function-key bar completion** — extend the existing `F2–F9` commander bar to
   the full `F1–F10` Norton layout and give it a theme-aware retro skin.

Aesthetic target: **modern-retro** (crisp fonts/spacing kept; retro cues added).
Retro reach: **core surfaces** (panes, rows, headers, breadcrumb, status bar,
commander bar, menu bar). Dialogs/settings inherit the palette but keep modern
layout.

## What already exists (do not rebuild)

- Function-key bar: `shell/ShellStatusBar.tsx` renders `.fo-commander-bar` from
  `COMMANDER_FUNCTION_ITEMS` in `shell/commanderActions.ts` (F2–F9, clickable,
  disabled-aware).
- File-type color coding: `utils/fileTypeColors.ts` + `settings/SettingsColors.tsx`,
  wired through `pane/FileRow.tsx` / `pane/FileTable.tsx`.
- Customizable shortcuts: `commands/defaultBindings.ts` already binds `F1 →
app.shortcuts` and `F2–F9 →` commander actions through `useKeyboardShortcuts.ts`.
- Token architecture (the lever the whole design pulls):
  - `packages/ui/src/tokens.css` — `:root` (light) + `:root[data-theme="dark"]`
    core tokens (`--fo-app-bg`, `--fo-text`, `--fo-accent`, `--fo-panel-bg`, …).
  - `packages/ui/src/components.css` — `:root` (light) + `[data-theme="dark"]`
    for `--fo-tab-*`, `--fo-classic-text`, `--fo-commander-text/-muted`,
    `--fo-tag-*`, `--fo-dialog-border`, `--fo-menu-shadow`.
  - `packages/frontend/src/styles/regions/shell.css` — `--fo-classic-*` under
    `[data-theme="light|dark"] .fo-shell`; commander bar / status bar currently
    use **hardcoded hex** (e.g. `#007acc`, `#2d2d30`, `#3794ff`).

## Component 1 — Theme registry

**New file:** `packages/frontend/src/themeRegistry.ts`

```ts
export interface ThemeDefinition {
  id: string; // value persisted in the `theme` preference + data-theme attr
  label: string; // shown in Settings → Display
  isDark: boolean; // drives color-scheme for native form controls
  selectable: boolean; // "system" is selectable but resolves at runtime
}

export const THEMES: ThemeDefinition[] = [
  { id: "system", label: "System", isDark: false, selectable: true },
  { id: "light", label: "Light", isDark: false, selectable: true },
  { id: "dark", label: "Dark", isDark: true, selectable: true },
  {
    id: "commander-blue",
    label: "Commander Blue",
    isDark: true,
    selectable: true,
  },
];

export function isKnownTheme(id: string): boolean;
export function themeById(id: string): ThemeDefinition | undefined;
```

**Modify `packages/frontend/src/applyPreferences.ts`:**
`applyThemePreference` currently collapses anything that is not `light`/`dark`
to `system`. Change it to: if `isKnownTheme(theme)` and the id is not `system`,
set `data-theme` to that id; otherwise `system`. `system` continues to fall
through to the `prefers-color-scheme` CSS. The `ThemePreference` type widens to
`string` (validated against the registry).

**Modify `packages/frontend/src/components/settings/SettingsDisplay.tsx`:**
render the theme `<select>` options from `THEMES.filter(t => t.selectable)`
instead of three literal `<option>`s.

## Component 2 — Commander Blue theme

Pure token overrides — no structural CSS. Add a `data-theme="commander-blue"`
block to each of the three token layers so every core surface that already reads
a token swaps automatically.

- `packages/ui/src/tokens.css` — `:root[data-theme="commander-blue"]` core
  palette:
  - field/panel: deep classic blue (`--fo-app-bg`, `--fo-panel-bg`,
    `--fo-editor-bg`, `--fo-surface*`).
  - text: light cyan (`--fo-text`), dimmer cyan (`--fo-muted-text`).
  - selection / cursor bar: `--fo-accent-soft` = bright cyan, `--fo-on-accent`
    = dark blue (the classic inverse cursor bar).
  - keep `--fo-success/-warning/-danger` legible on blue.
  - `color-scheme: dark;` for native controls.
    `--fo-tab-*`, `--fo-dialog-border`, `--fo-menu-shadow`, and `--fo-tag-*` also
    live in `tokens.css`, so they are overridden in the same block.
- `packages/frontend/src/styles/regions/shell.css` —
  `:root[data-theme="commander-blue"] .fo-shell` for the `--fo-classic-*` set
  and the new commander/status tokens (Component 3). `--fo-commander-text` /
  `--fo-commander-muted` follow automatically (they reference `--fo-classic-*`).
- `packages/ui/src/components.css` needs **no** change: its only theme-specific
  rules are scoped to `[data-theme="dark"]` and otherwise consume base tokens
  that commander-blue overrides.

**File-type colors caveat:** file-type colors are _user preferences_ applied as
inline text color from JS, not CSS tokens, so they do not auto-retune per theme.
The default row text (cyan) stays legible; users who enable Commander Blue can
retune or disable file-type rules in Settings → Colors. Documented, not solved
in code (out of scope).

## Component 3 — Function-key bar completion + retro skin

**Tokenize the hardcoded hex** in `shell.css` so the bar themes. Define defaults
on `.fo-shell` equal to the _current_ literals (preserves today's light + dark
appearance exactly), then override under `commander-blue`:

```
--fo-statusbar-bg, --fo-path-rail-bg, --fo-path-rail-field-bg,
--fo-path-rail-field-border, --fo-commander-bar-bg, --fo-commander-key-bg,
--fo-commander-key-border, --fo-commander-key-hover-bg,
--fo-commander-keycap-bg, --fo-commander-keycap-fg, --fo-commander-keycap-border
```

**Extend the bar to F1–F10** in `shell/commanderActions.ts`:

- Add `help` and `menu` actions to `createCommanderActions`:
  - `help` → `handleCommandSelect("app.shortcuts")` (the in-app help/shortcuts dialog).
  - `menu` → `handleCommandSelect("app.commandPalette")` (the modern "menu of
    everything"; F10's discoverable-actions role).
- `COMMANDER_FUNCTION_ITEMS` becomes: `F1 Help, F2 Rename, F3 View, F4 Edit,
F5 Copy, F6 Move, F7 New Folder, F8 Delete, F9 Terminal, F10 Menu`.
- `commanderItemDisabled`: `help` and `menu` are always enabled.

**`shell/ShellStatusBar.tsx`:** no logic change (it already maps every item to
`commander[action]()`); only the item count grows.

**`styles/regions/shell.css`:** `.fo-commander-bar` grid changes from
`repeat(8, …)` to `repeat(10, …)`. Keycap retro skin reads the new tokens.

Keyboard: `F1` and `F10` are not in `commanderCommands` (that map is for the
preventDefault-on-editable commander ops). `F1 → app.shortcuts` already resolves
through the normal binding path in `defaultBindings.ts`. `F10` is added to
`defaultBindings.ts` as `app.commandPalette` (additional binding) so the key and
the button agree. (`F10` historically opens the menu; the command palette is the
app's equivalent.)

## Boundaries / invariants

- Frontend + CSS only. No Rust, no IPC, no DTO changes (respects ADR-0002/0003).
- Theme persists through the existing `theme` preference — no schema change.
- Existing dark/light rendering is byte-for-byte preserved (tokenization uses the
  current literals as defaults).

## Testing

- `themeRegistry` unit test: `isKnownTheme`/`themeById` accept registry ids,
  reject unknown.
- `applyThemePreference` test: sets `data-theme="commander-blue"` for that id,
  `"system"` for unknown/`system`.
- Commander bar test: renders 10 buttons including F1 Help and F10 Menu, and
  clicking F1/F10 dispatches `app.shortcuts` / `app.commandPalette`.
- `pnpm typecheck && pnpm lint && pnpm --filter @fileoctopus/frontend test`.

## Out of scope

- Faithful box-drawing borders (break under virtualization).
- Per-theme file-type color palettes.
- Restyling settings/dialog _layout_ (palette inherits; layout stays modern).
