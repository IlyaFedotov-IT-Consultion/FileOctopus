# Terminal Configuration Implementation Plan And Current State

**Status:** implementation baseline plus terminal runtime and automation UX slices landed in working tree  
**Created:** 2026-06-01  
**Area:** Embedded terminal configuration, profiles, IPC/API, and settings UI

## Summary

FileOctopus now has the backend and API foundation for advanced terminal
configuration. The implementation adds persisted terminal profiles, profile-aware
terminal spawning, live terminal session metadata, terminal automation helpers,
and a richer Settings -> Terminal UI.

The remaining work is mostly manual product validation and any follow-up polish
found while exercising real terminal workflows.

## Current State

Implemented:

- `crates/config` has a new `TerminalProfileRepository` backed by
  `terminal.sqlite`.
- `app-core` owns the terminal profile repository through `AppState`.
- `terminal-core` tracks session metadata and emits session lifecycle events.
- Tauri terminal commands now include:
  - `terminal.capabilities`
  - `terminal.profilesList`
  - `terminal.profileAdd`
  - `terminal.profileUpdate`
  - `terminal.profileDelete`
  - `terminal.profileSetDefault`
  - `terminal.sessionsList`
  - `terminal.sendText`
  - `terminal.runCommand`
  - `terminal.spawnAndRun`
- Existing `terminal.spawn` remains backward compatible and now accepts optional
  `terminalProfileId`, `env`, `initialCommand`, and `title`.
- `@fileoctopus/ts-api` mirrors all new DTOs, methods, command map entries, and
  event constants.
- Preview transport supports terminal profiles, capabilities, sessions, and
  automation stubs.
- Settings -> Terminal now supports profile editing, launch settings,
  environment variables, initial command, appearance settings, and behavior
  toggles.
- Frontend terminal launch flows now resolve a terminal profile, pass
  `terminalProfileId` to terminal spawn, retain the profile on session state,
  and apply profile appearance/runtime options in `TerminalView`.
- Terminal views now use the xterm search addon and expose search through the
  shared terminal tab bar in pane terminals and the activity rail.
- Terminal tab actions now support inline rename, duplicate, close exited tabs,
  and close other tabs for the visible terminal group.
- Command palette, menu, and customizable toolbar commands now support running a
  prompted command in the active terminal or spawning a terminal in the active
  folder and running a prompted command.
- `docs/architecture/api-reference.md` is updated to match the new command and
  event surface.

Validation completed:

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `cargo fmt --check`
- `cargo check`
- `cargo test`
- `pnpm --filter @fileoctopus/frontend test -- terminalProfileRuntime.test.ts settingsTerminal.test.tsx`
- `pnpm --filter @fileoctopus/frontend typecheck`
- `pnpm --filter @fileoctopus/frontend test -- terminalTabBar.test.tsx terminalProfileRuntime.test.ts settingsTerminal.test.tsx`
- `pnpm --filter @fileoctopus/frontend test -- commands.terminalAutomation.test.ts`

## Important Interfaces

Terminal profiles are hybrid defaults. A profile can represent local shell
behavior or SSH launch behavior while SSH authentication remains owned by
existing network profiles and secret storage.

Profile fields include:

- launch: `scope`, `shell`, `args`, `env`, `workingDirectoryMode`,
  `customCwdUri`, `networkProfileId`, `remoteCwd`, `initialCommand`
- appearance: `fontFamily`, `fontSize`, `lineHeight`, `cursorStyle`,
  `cursorBlink`, `scrollback`, `themeId`, `themeOverrides`
- behavior: `copyOnSelect`, `rightClickAction`, `pasteConfirmation`,
  `linkHandling`
- metadata: `sortOrder`, `isDefault`, `createdAt`, `updatedAt`

Session metadata is emitted through `terminal:session` and can be listed with
`terminal.sessionsList`.

## Remaining Implementation Plan

### Slice 1: Apply Profile Runtime Settings

- Status: implemented.
- Resolved terminal profile metadata is passed into frontend terminal sessions.
- `TerminalView` applies `fontFamily`, `fontSize`, `lineHeight`, `cursorStyle`,
  `cursorBlink`,
  `scrollback`, `themeId`, and `themeOverrides` inside `TerminalView`.
- Existing CSS-derived theme fallback is preserved when no profile is available.
- Tests cover xterm option mapping and theme override parsing.

### Slice 2: Terminal Search And Tab Actions

- Status: implemented.
- Added `@xterm/addon-search` and loaded it in `TerminalView`.
- Added terminal search UI in pane terminals and activity rail terminals.
- Added tab actions: rename, duplicate, close exited, close others.
- Kept tab controls compact and consistent with existing pane/action styling.
- Tests cover rename, duplicate, scoped close actions, and search callbacks.

### Slice 3: Automation Workflows

- Status: implemented.
- Added command-palette, menu, and customizable toolbar actions for running a
  command in a terminal.
- `terminal.spawnAndRun` is used for spawn-and-run workflows.
- `terminal.runCommand` is used for existing session workflows.
- Existing-session command execution activates the frontend terminal session and
  sends `focus: true` to the backend metadata path.
- Tests cover command registry entries, palette entries, prompt fallback, direct
  command invocation, and spawn-and-run dispatch.

### Slice 4: Manual Product Validation

- Run `pnpm dev`.
- Create, update, delete, and set default terminal profiles.
- Open embedded pane terminals and activity rail terminals.
- Verify shell, args, env, initial command, and title behavior.
- Verify SSH terminal launch through a saved network profile when network is
  enabled.
- Verify profile validation and error display for invalid env lines and missing
  profiles.

## Deferred

- Automatic terminal respawn after app restart.
- Persisting terminal scrollback/output history.
- Remote cwd synchronization beyond initial SSH launch behavior.
- Treating terminal automation as persisted operation-history jobs.

## Notes For Next Engineer

- Do not bypass `ResourceUri`; terminal cwd customization should remain
  `local://...` or profile-backed remote context.
- Keep `terminal.write` byte logging redacted.
- Existing `terminalShell` and `terminalArgs` preferences are compatibility
  fallback, not the primary model going forward.
- New IPC additions must continue to update `crates/app-ipc`,
  `packages/ts-api`, `commandMap.ts`, events, Tauri registration, and the API
  reference together.
