# Network Provider Hardening — Overview

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan stage-by-stage. Each stage document is independently reviewable and shippable.

**Goal:** Fix correctness, security, and observability defects in the network (SFTP) provider stack without rewriting the abstraction. Stop reconnecting on every navigation, leak-free profile deletion, real SHA-256 host-key TOFU, server-pushed status events, capability-aware UI, idle reaper, and a baseline test suite.

**Architecture:** Keep the existing `VfsRegistry` / `ConnectionSessionManager` / `RemoteConnector` layering. Tighten the session lifecycle inside `remote-core`, add a status event channel through `app-ipc` to the frontend, replace the broken fingerprint hashing inside `provider-sftp`, and surface capability and status state through `@fileoctopus/ts-api` and `@fileoctopus/frontend`.

**Tech Stack:** Rust 2021 (`tokio`, `async-trait`, `rusqlite`, `ssh2`, `sha2`, `data-encoding`), TypeScript (`@fileoctopus/ts-api`, React 19 in `@fileoctopus/frontend`, Vitest).

---

## Stages

| #   | Stage                                                                  | Tasks | Theme                                                           | Shippable on its own?         |
| --- | ---------------------------------------------------------------------- | ----- | --------------------------------------------------------------- | ----------------------------- |
| 1   | [Connection lifecycle correctness](01-stage-1-connection-lifecycle.md) | 3     | Stop the reconnect storm; clean profile deletion                | Yes                           |
| 2   | [Security hardening](02-stage-2-security-hardening.md)                 | 3     | Real SHA-256 fingerprint + TOFU, validation, error context      | Yes (depends on Stage 1)      |
| 3   | [Reliability](03-stage-3-reliability.md)                               | 3     | Idle reaper, reconnect on transport drop, race lock             | Yes (depends on Stage 1)      |
| 4   | [Observability](04-stage-4-observability.md)                           | 2     | Push status events to the frontend, narrow remote schemes       | Yes (depends on Stages 1 + 3) |
| 5   | [UX polish](05-stage-5-ux-polish.md)                                   | 4     | Confirmation dialog, fingerprint UI, sidebar badges, busy state | Yes (depends on Stages 2 + 4) |
| 6   | [Test coverage + docs](06-stage-6-test-coverage-and-docs.md)           | 2     | `AuthSecrets` tests, API reference update                       | Yes (final)                   |

**Total:** 17 tasks across 6 stages.

---

## Dependency graph

```
Stage 1 (correctness)
  │
  ├─→ Stage 2 (security)  ─────────────┐
  │                                     │
  └─→ Stage 3 (reliability)             │
        │                               │
        └─→ Stage 4 (observability)  ───┤
              │                         │
              ↓                         ↓
              Stage 5 (UX polish) ←─────┘
                │
                ↓
              Stage 6 (tests + docs)
```

Stages 2 and 3 are independent of each other and can be implemented in parallel after Stage 1 lands. Stage 4 needs the `force_connect` split from Stage 1 and benefits from the reaper in Stage 3. Stage 5 needs Stage 4 events and the Stage 2 fingerprint backend. Stage 6 is final cleanup.

---

## Out of scope (follow-up plan)

The bigger architectural changes called out in the [original review](../../../../docs/reviews/2026-05-19-network-provider-review.md) (if present) are deferred:

- Reshaping `RemoteSession` to expose VFS-shaped methods and removing the single `as_any()` downcast that this plan introduces in Stage 2 Task 1 Step 8.
- Adding write operations (mkdir, rename, delete, upload, download) to `SftpProvider`.
- Wiring `crates/fs-core/src/file_ops/*` and `apps/desktop-tauri/src-tauri/src/commands/{fs,folder_size,recursive_search,watch}.rs` to dispatch through `VfsRegistry` instead of calling `to_local_path()`.
- Adding SMB and WebDAV providers.

After these six stages ship, SFTP remains **read-only** — but the read-only experience is correct, observable, and safe, and the foundations for write-op work are in place.

---

## Aggregate file inventory

A single index of every file touched across the six stages. Each stage document repeats only the subset relevant to its tasks.

**Created:**

- `crates/remote-core/tests/session_manager.rs` — incrementally built across Stages 1, 3, 4
- `crates/remote-core/tests/secrets.rs` — Stage 6
- `crates/provider-sftp/tests/fingerprint.rs` — Stage 2
- `packages/frontend/src/components/dialogs/RemoveServerDialog.tsx` — Stage 5
- `packages/frontend/tests/networkNavigation.test.ts` — Stage 1
- `packages/frontend/tests/removeServerDialog.test.tsx` — Stage 5
- `packages/frontend/tests/sidebarNetworkStatus.test.tsx` — Stage 5

**Modified:**

- `crates/remote-core/src/error.rs` — Stage 2
- `crates/remote-core/src/session.rs` — Stages 1, 3, 4
- `crates/remote-core/src/lib.rs` — Stages 3, 4
- `crates/remote-core/Cargo.toml` — Stage 2
- `crates/provider-sftp/Cargo.toml` — Stage 2
- `crates/provider-sftp/src/connector.rs` — Stage 2
- `crates/provider-sftp/src/lib.rs` — Stage 2
- `crates/config/src/network.rs` — Stages 2 (validation), 5 (clear fingerprint method)
- `crates/vfs/src/lib.rs` — Stage 4
- `crates/app-ipc/src/lib.rs` — Stage 4
- `crates/app-core/src/lib.rs` — Stage 3
- `apps/desktop-tauri/src-tauri/src/commands/network.rs` — Stages 1, 5
- `apps/desktop-tauri/src-tauri/src/lib.rs` — Stages 4, 5
- `packages/ts-api/src/types.ts` — Stage 4
- `packages/ts-api/src/clients/network.ts` — Stages 4, 5
- `packages/ts-api/src/commandMap.ts` — Stage 5
- `packages/ts-api/src/index.ts` — Stage 4
- `packages/frontend/src/hooks/useAppInit.ts` — Stage 4
- `packages/frontend/src/hooks/useNavigation.ts` — Stage 1
- `packages/frontend/src/hooks/useEventHandlers.ts` — Stage 1
- `packages/frontend/src/hooks/useNetworkHandlers.ts` — Stages 5
- `packages/frontend/src/components/dialogs/NetworkLocationsDialog.tsx` — Stage 5
- `packages/frontend/src/components/dialogs/ConnectServerDialog.tsx` — Stage 5
- `packages/frontend/src/components/DialogOverlayGroup.tsx` — Stage 5
- `packages/frontend/src/app/providers/ModalsProvider.tsx` — Stage 5
- `packages/frontend/src/app/providers/ShellProvider.tsx` — Stages 4, 5
- `packages/frontend/src/shell/PaneWorkspace.tsx` — Stage 5
- `packages/frontend/src/sidebar/Sidebar.tsx` — Stage 5
- `docs/architecture/api-reference.md` — Stage 6

---

## Coverage map (review item → stage/task)

| Review item                                      | Severity             | Stage / Task                             |
| ------------------------------------------------ | -------------------- | ---------------------------------------- |
| §3a Reconnect storm on every navigation          | High                 | Stage 1 Tasks 1 + 2                      |
| §3c No idle reaper, no liveness probe            | High                 | Stage 3 Tasks 1 + 2                      |
| §3d Connect race                                 | Medium               | Stage 3 Task 3                           |
| §3e Delete leaks live session                    | Medium               | Stage 1 Task 3                           |
| §4a Broken host-key fingerprint + TOFU           | High (security)      | Stage 2 Task 1                           |
| §4b Port / hostname validation                   | Medium               | Stage 2 Task 2                           |
| §4c URI lost in error messages                   | Low                  | Stage 2 Task 3                           |
| §5b No live status updates                       | High (UX)            | Stage 4 Task 2                           |
| §5d Remove server without confirmation           | Medium               | Stage 5 Task 1                           |
| §5e No host-key fingerprint UI                   | Medium (security UX) | Stage 5 Task 2                           |
| §5f No auth-state indicator in sidebar           | Medium               | Stage 5 Task 3                           |
| §5b/§5c No loading feedback for explicit connect | Low                  | Stage 5 Task 4                           |
| §1 SMB / WebDAV vapor                            | Low                  | Stage 4 Task 1                           |
| §7 Zero test coverage                            | Medium               | Stage 6 Task 1 + tests in Stages 1, 3, 4 |

---

## Execution

Each stage document ends with its own commit boundary. Recommended workflow:

1. Implement Stage N.
2. Run the full test matrix: `pnpm typecheck && pnpm lint && pnpm test && pnpm rust:test && pnpm rust:clippy`.
3. Open a PR scoped to that stage's commits.
4. Once merged, start the next stage.

For agentic execution, the recommended sub-skill is **superpowers:subagent-driven-development**: dispatch a fresh subagent per stage, review between stages, fast iteration.
