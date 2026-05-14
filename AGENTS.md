# Repository Guidelines

## Project Structure & Module Organization

FileOctopus is a Tauri v2 desktop file manager with Rust owning privileged filesystem logic and React TypeScript owning the UI. The root Rust workspace is defined in `Cargo.toml`; crates live in `crates/`, including `vfs`, `fs-core`, `app-ipc`, `config`, `jobs`, `platform`, `telemetry`, and `test-support`. The desktop shell is in `apps/desktop-tauri/`, with React entry files in `src/` and Tauri Rust code in `src-tauri/`. Shared TypeScript packages live in `packages/frontend`, `packages/ui`, and `packages/ts-api`. Architecture records are in `docs/adr/`; do not add new docs unless requested.

## Build, Test, and Development Commands

- `pnpm install`: install workspace dependencies using pnpm 10.26.2.
- `pnpm bootstrap`: run `scripts/bootstrap.sh`.
- `pnpm dev`: build `@fileoctopus/frontend` and start the Tauri desktop app.
- `pnpm build`: build all pnpm packages with declared build scripts.
- `pnpm typecheck`: run TypeScript checks across apps and packages.
- `pnpm lint`: run ESLint for `apps/**/*.ts(x)` and `packages/**/*.ts(x)`.
- `pnpm test`: run package tests, currently Vitest where configured.
- `pnpm rust:check`, `pnpm rust:test`, `pnpm rust:fmt`, `pnpm rust:clippy`: run Rust workspace checks used by CI.

## Coding Style & Naming Conventions

Use Rust 2021 and TypeScript ES modules. Keep Rust formatted with `cargo fmt`; `rustfmt.toml` sets Unix newlines and `max_width = 100`. TypeScript uses ESLint flat config with `@eslint/js` and `typescript-eslint`. Follow existing naming: Rust crates use kebab-case directories, Rust modules use snake_case, React components use PascalCase, and package names use the `@fileoctopus/*` scope. Do not add comments unless explicitly requested.

## Testing Guidelines

Prefer new tests under a `tests/` folder in the relevant crate or package, for example `crates/vfs/tests/...` or `packages/ts-api/tests/client.test.ts`. Keep Vitest test names as `*.test.ts` and Rust integration tests as descriptive snake_case files. Run `pnpm test` and `pnpm rust:test` before submitting changes; also run typecheck, lint, fmt, and clippy when touching related code. Target 85%+ coverage for changed behavior.

## Commit & Pull Request Guidelines

Current history uses Conventional Commit prefixes such as `feat:` and `chore:`. Keep commits small and imperative, for example `feat: add vfs provider registry`. Pull requests should complete the repository template: summary, tests, and security impact. Link issues when relevant, include screenshots for UI changes, and note any filesystem, IPC, or permission boundary changes. CODEOWNERS currently assigns review to `@ilyafedotov`.
