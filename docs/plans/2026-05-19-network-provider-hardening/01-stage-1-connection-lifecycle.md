# Stage 1 — Connection lifecycle correctness

> **Parent plan:** [00-overview.md](00-overview.md)
> **Prerequisites:** none
> **Unblocks:** Stages 2, 3, 4

**Goal:** Stop reconnecting on every remote navigation. Clean up live sessions when a profile is deleted.

**Why this stage ships on its own:** Three independent correctness fixes; each commit is small and self-contained. The reconnect storm (review §3a) is the single highest-impact bug; this stage alone makes remote browsing usable.

---

## Tasks

1. [Idempotent `network.connect`](#task-1-idempotent-networkconnect-stop-reconnect-storm)
2. [Drop unconditional `network.connect` on every navigation](#task-2-drop-unconditional-networkconnect-on-every-navigation)
3. [Disconnect live session on profile delete](#task-3-disconnect-live-session-on-profile-delete)

---

## Task 1: Idempotent `network.connect` (stop reconnect storm)

**Why:** `ConnectionSessionManager::connect` at `crates/remote-core/src/session.rs:121-174` unconditionally tears down and re-establishes the session even when a fresh one already exists. The frontend calls `client.network.connect` before every remote navigation (`packages/frontend/src/hooks/useNavigation.ts:118-123`, `useEventHandlers.ts:174-179`), so each directory click triggers a full SSH handshake. This is the single highest-impact bug in the review.

**Files:**

- Modify: `crates/remote-core/src/session.rs:121-174`
- Test: `crates/remote-core/tests/session_manager.rs` (create)

- [ ] **Step 1: Add `tests/` directory with a stub connector used by all session-manager tests**

Create `crates/remote-core/tests/session_manager.rs`:

```rust
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use async_trait::async_trait;
use config::{AuthKind, NetworkProfileRepository, NewNetworkProfile};
use platform::SecretStore;
use remote_core::{
    AuthSecrets, ConnectionSessionManager, ConnectionStatus, RemoteConnector, RemoteConnectorRegistry,
    RemoteError, RemoteSession,
};
use tempfile::TempDir;
use tokio::sync::RwLock;

#[derive(Default)]
struct StubSession {
    pings: AtomicUsize,
}

#[async_trait]
impl RemoteSession for StubSession {
    async fn ping(&self) -> Result<(), RemoteError> {
        self.pings.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }

    fn as_any(&self) -> &dyn std::any::Any {
        self
    }
}

#[derive(Default)]
struct StubConnector {
    connects: AtomicUsize,
    disconnects: AtomicUsize,
}

#[async_trait]
impl RemoteConnector for StubConnector {
    fn scheme(&self) -> &'static str {
        "sftp"
    }

    async fn connect(
        &self,
        _profile: &config::NetworkProfile,
        _secrets: &AuthSecrets,
    ) -> Result<Arc<dyn RemoteSession>, RemoteError> {
        self.connects.fetch_add(1, Ordering::SeqCst);
        Ok(Arc::new(StubSession::default()))
    }

    async fn disconnect(&self, _session: Arc<dyn RemoteSession>) -> Result<(), RemoteError> {
        self.disconnects.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }
}

struct Fixture {
    _temp: TempDir,
    profiles: NetworkProfileRepository,
    secrets: SecretStore,
    connector: Arc<StubConnector>,
    registry: Arc<RwLock<RemoteConnectorRegistry>>,
}

impl Fixture {
    fn new() -> Self {
        let temp = TempDir::new().unwrap();
        let profiles =
            NetworkProfileRepository::new(temp.path().join("network.sqlite")).unwrap();
        let secrets = SecretStore::new();
        let connector = Arc::new(StubConnector::default());
        let mut registry = RemoteConnectorRegistry::new();
        registry.register(connector.clone());
        Self {
            _temp: temp,
            profiles,
            secrets,
            connector,
            registry: Arc::new(RwLock::new(registry)),
        }
    }

    fn add_profile(&self) -> String {
        let created = self
            .profiles
            .add(NewNetworkProfile {
                label: "stub".into(),
                scheme: "sftp".into(),
                host: "example.invalid".into(),
                port: 22,
                username: "u".into(),
                auth_kind: AuthKind::Password,
                private_key_path: None,
                default_path: "/".into(),
            })
            .unwrap();
        // Swap to PrivateKey with an empty path so AuthSecrets::load succeeds without
        // hitting the OS keychain (which is absent in headless CI).
        self.profiles
            .update(
                &created.id,
                config::UpdateNetworkProfile {
                    label: created.label,
                    host: created.host,
                    port: created.port,
                    username: created.username,
                    auth_kind: AuthKind::PrivateKey,
                    private_key_path: Some(String::new()),
                    default_path: created.default_path,
                },
            )
            .unwrap()
            .id
    }

    fn manager(&self) -> ConnectionSessionManager {
        ConnectionSessionManager::new(
            self.profiles.clone(),
            self.secrets.clone(),
            self.registry.clone(),
        )
    }
}
```

> **Note for keychain in tests:** `platform::SecretStore::get` may fail in headless CI because the OS keychain is absent. The fixture above sidesteps it by using `AuthKind::PrivateKey` (so `AuthSecrets::load` returns `Ok` with no password). If a follow-up test needs password auth, gate it on `#[cfg(target_os = "macos")]` and `cargo test -- --ignored`.

- [ ] **Step 2: Write failing test for idempotency**

Append to `crates/remote-core/tests/session_manager.rs`:

```rust
#[tokio::test]
async fn connect_is_idempotent_when_session_is_already_alive() {
    let fixture = Fixture::new();
    let profile_id = fixture.add_profile();
    let manager = fixture.manager();

    manager.connect(&profile_id).await.unwrap();
    manager.connect(&profile_id).await.unwrap();
    manager.connect(&profile_id).await.unwrap();

    assert_eq!(
        fixture.connector.connects.load(std::sync::atomic::Ordering::SeqCst),
        1,
        "subsequent connect() calls should reuse the existing session"
    );
}
```

- [ ] **Step 3: Run test, verify it fails**

```bash
cargo test -p remote-core --test session_manager connect_is_idempotent_when_session_is_already_alive
```

Expected: FAIL with `assertion left == right` showing `connects = 3`.

- [ ] **Step 4: Implement idempotency in `ConnectionSessionManager::connect`**

In `crates/remote-core/src/session.rs`, replace the entire `connect` method (starts at line 121) with the following. The split keeps `connect` as the idempotent public entry point and exposes `force_connect` for callers that need to bypass the live-session check (used by the idle reaper and reconnect-on-failure paths in Stage 3).

```rust
    pub async fn connect(&self, profile_id: &str) -> Result<(), RemoteError> {
        if self.session_is_alive(profile_id).await {
            return Ok(());
        }
        self.force_connect(profile_id).await
    }

    async fn session_is_alive(&self, profile_id: &str) -> bool {
        let sessions = self.sessions.read().await;
        let Some(handle) = sessions.get(profile_id) else {
            return false;
        };
        if handle.last_used.elapsed() >= SESSION_IDLE_TIMEOUT {
            return false;
        }
        handle.inner.ping().await.is_ok()
    }

    pub async fn force_connect(&self, profile_id: &str) -> Result<(), RemoteError> {
        let profile = self.profiles.get(profile_id)?;
        let connector = self
            .connectors
            .read()
            .await
            .get(&profile.scheme)
            .ok_or_else(|| RemoteError::UnsupportedScheme {
                scheme: profile.scheme.clone(),
            })?;
        let secrets = match AuthSecrets::load(&self.secrets, &profile) {
            Ok(secrets) => secrets,
            Err(platform::SecretStoreError::NotFound) => {
                let message = match profile.auth_kind {
                    config::AuthKind::Password => crate::MISSING_STORED_PASSWORD.to_string(),
                    config::AuthKind::PrivateKey => {
                        "Private key credentials are unavailable.".to_string()
                    }
                };
                self.mark_error(profile_id, &message).await;
                return Err(RemoteError::AuthenticationFailed { message });
            }
            Err(error) => {
                let message = error.to_string();
                self.mark_error(profile_id, &message).await;
                return Err(error.into());
            }
        };

        match connector.connect(&profile, &secrets).await {
            Ok(session) => {
                let now = Instant::now();
                self.sessions.write().await.insert(
                    profile_id.to_string(),
                    RemoteSessionHandle {
                        profile_id: profile_id.to_string(),
                        connected_at: now,
                        last_used: now,
                        inner: session,
                    },
                );
                self.statuses
                    .write()
                    .await
                    .insert(profile_id.to_string(), ConnectionStatus::Connected);
                let _ = self.profiles.set_connection_state(profile_id, true, None);
                Ok(())
            }
            Err(error) => {
                self.mark_error(profile_id, &error.to_string()).await;
                Err(error)
            }
        }
    }
```

`session_for_profile` (currently at line 191) keeps calling `self.connect(...)` and benefits from the short-circuit. Stage 3 Task 2 will rewrite it to probe via `ping()`.

- [ ] **Step 5: Run idempotency test, verify it passes**

```bash
cargo test -p remote-core --test session_manager connect_is_idempotent_when_session_is_already_alive
```

Expected: PASS.

- [ ] **Step 6: Confirm full crate tests still pass**

```bash
cargo test -p remote-core
cargo clippy -p remote-core --all-targets -- -D warnings
```

Expected: PASS, no warnings.

- [ ] **Step 7: Commit**

```bash
git add crates/remote-core/src/session.rs crates/remote-core/tests/session_manager.rs
git commit -m "fix(remote-core): make ConnectionSessionManager::connect idempotent"
```

---

## Task 2: Drop unconditional `network.connect` on every navigation

**Why:** Even with Task 1 making `connect` cheap when alive, the frontend's `useNavigation.navigatePanel` and `useEventHandlers.navigatePanel` both call `client.network.connect` synchronously before listing. After Task 1 the call is cheap, but it's still a round-trip per click. `SftpProvider::list` already calls `session_for_profile` which performs lazy reconnect (`crates/provider-sftp/src/provider.rs:44`, `crates/remote-core/src/session.rs:191-213`). The frontend's pre-emptive connect is redundant.

**Files:**

- Modify: `packages/frontend/src/hooks/useNavigation.ts:118-135`
- Modify: `packages/frontend/src/hooks/useEventHandlers.ts:174-191`
- Test: `packages/frontend/tests/networkNavigation.test.ts` (create)

- [ ] **Step 1: Write a failing test asserting `navigatePanel` no longer calls `network.connect`**

Create `packages/frontend/tests/networkNavigation.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNavigation } from "../src/hooks/useNavigation";
import { createInitialState, panelReducer } from "../src/panelStore";
import { useReducer, useState } from "react";

function createClientMock() {
  return {
    fs: {
      listStart: vi.fn().mockResolvedValue({
        sessionId: "s1",
        requestId: "r1",
      }),
      standardLocations: vi.fn(),
    },
    network: {
      connect: vi.fn().mockResolvedValue({ ok: true }),
      listProfiles: vi.fn().mockResolvedValue({ profiles: [] }),
      connectionStatus: vi.fn().mockResolvedValue({ statuses: [] }),
    },
    navigation: {
      recordVisit: vi.fn().mockResolvedValue(undefined),
      listFavorites: vi.fn().mockResolvedValue({ favorites: [] }),
      listRecent: vi.fn().mockResolvedValue({ entries: [] }),
      listStarred: vi.fn().mockResolvedValue({ entries: [] }),
    },
    operationHistory: {
      listRecentOperations: vi.fn(),
      clearOperationHistory: vi.fn(),
    },
    diagnostics: { appDataHealth: vi.fn(), exportBundle: vi.fn() },
    getAppInfo: vi.fn(),
  } as unknown as Parameters<typeof useNavigation>[0]["client"];
}

describe("useNavigation remote navigation", () => {
  it("does not call client.network.connect before listing a remote URI", async () => {
    const client = createClientMock();

    function harness() {
      const [state, dispatch] = useReducer(panelReducer, createInitialState());
      const [, setSearch] = useState(null);
      const [, setDialog] = useState(null);
      return useNavigation({
        client,
        state,
        dispatch,
        setSearch,
        setDialog,
        setFavorites: vi.fn(),
        setRecentToday: vi.fn(),
        setRecentWeek: vi.fn(),
        setStarred: vi.fn(),
        setLocations: vi.fn(),
        setNetworkProfiles: vi.fn(),
        setNetworkStatuses: vi.fn(),
        setHistory: vi.fn(),
        setOperationError: vi.fn(),
        setAppInfo: vi.fn(),
        setAppHealth: vi.fn(),
        setDiagnosticsMessage: vi.fn(),
        setExportingDiagnostics: vi.fn(),
        diagnosticsDestination: "",
      });
    }

    const { result } = renderHook(harness);
    await act(async () => {
      await result.current.navigatePanel(
        "left",
        "sftp://550e8400-e29b-41d4-a716-446655440000/",
      );
    });

    expect(client.network.connect).not.toHaveBeenCalled();
    expect(client.fs.listStart).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm --filter @fileoctopus/frontend test -- networkNavigation
```

Expected: FAIL on `expect(client.network.connect).not.toHaveBeenCalled()` — currently called once.

- [ ] **Step 3: Remove the explicit connect from `useNavigation`**

In `packages/frontend/src/hooks/useNavigation.ts`, delete lines 118-135 (the entire `if (isRemoteUri(uri)) { try { await client.network.connect... } catch { ... return; } }` block). The surrounding control flow already handles errors via `startListing`, which sets pane error state from any backend failure.

After deletion, the imports `isRemoteUri` and `profileIdFromRemoteUri` are still used elsewhere in the file (record-visit label branch, line 155); leave them.

- [ ] **Step 4: Same change in `useEventHandlers`**

In `packages/frontend/src/hooks/useEventHandlers.ts`, delete lines 174-191 (the matching `if (isRemoteUri(uri)) { ... }` block) for the same reason.

- [ ] **Step 5: Run test, verify it passes**

```bash
pnpm --filter @fileoctopus/frontend test -- networkNavigation
```

Expected: PASS.

- [ ] **Step 6: Run the full frontend test suite to catch regressions**

```bash
pnpm --filter @fileoctopus/frontend test
pnpm --filter @fileoctopus/frontend lint
pnpm --filter @fileoctopus/frontend typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/frontend/src/hooks/useNavigation.ts \
        packages/frontend/src/hooks/useEventHandlers.ts \
        packages/frontend/tests/networkNavigation.test.ts
git commit -m "fix(frontend): rely on session manager for lazy remote connect"
```

---

## Task 3: Disconnect live session on profile delete

**Why:** `apps/desktop-tauri/src-tauri/src/commands/network.rs:138-151` deletes the DB row and clears secrets but leaves the live `Arc<dyn RemoteSession>` parked in `ConnectionSessionManager.sessions`. The next idle-timeout reconnect (added in Stage 3) would attempt a profile lookup that returns `ProfileNotFound`; in the meantime the SSH socket is still open.

**Files:**

- Modify: `apps/desktop-tauri/src-tauri/src/commands/network.rs:137-151`
- Test: `crates/remote-core/tests/session_manager.rs` (extend)

- [ ] **Step 1: Write a baseline test confirming `disconnect` cleans up**

Append to `crates/remote-core/tests/session_manager.rs`:

```rust
#[tokio::test]
async fn disconnect_drops_session_handle() {
    let fixture = Fixture::new();
    let profile_id = fixture.add_profile();
    let manager = fixture.manager();

    manager.connect(&profile_id).await.unwrap();
    assert_eq!(
        manager.connection_status(&profile_id).await,
        ConnectionStatus::Connected,
    );

    manager.disconnect(&profile_id).await.unwrap();

    assert_eq!(
        manager.connection_status(&profile_id).await,
        ConnectionStatus::Disconnected,
    );
    assert_eq!(
        fixture.connector.disconnects.load(std::sync::atomic::Ordering::SeqCst),
        1,
    );
}
```

- [ ] **Step 2: Run test, verify it passes (validates the baseline guarantee)**

```bash
cargo test -p remote-core --test session_manager disconnect_drops_session_handle
```

Expected: PASS.

- [ ] **Step 3: Replace `network_profile_delete` with an async version that disconnects first**

The current command body at `apps/desktop-tauri/src-tauri/src/commands/network.rs:137-151` is synchronous. Replace it with:

```rust
#[tauri::command]
pub async fn network_profile_delete(
    request: NetworkProfileDeleteRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<OkResponse, IpcError> {
    // Tear down any live session before the profile row disappears, otherwise
    // the session handle is leaked and the idle reaper will try to look up a
    // profile that no longer exists.
    let _ = state.sessions().disconnect(&request.id).await;

    state.network().delete(&request.id).map_err(network_error)?;
    let _ = state
        .secrets()
        .delete(&SecretStore::network_password_key(&request.id));
    let _ = state
        .secrets()
        .delete(&SecretStore::network_passphrase_key(&request.id));

    Ok(OkResponse { ok: true })
}
```

The function signature changes from `pub fn` to `pub async fn` — Tauri command-dispatch handles both. No other call site changes are needed because the command is invoked through the IPC layer.

- [ ] **Step 4: Confirm full build passes**

```bash
pnpm rust:check
pnpm rust:test
pnpm rust:clippy
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop-tauri/src-tauri/src/commands/network.rs \
        crates/remote-core/tests/session_manager.rs
git commit -m "fix(network): disconnect live session before deleting profile"
```

---

## Stage 1 self-review

- Reconnect storm (review §3a): addressed by Tasks 1 + 2.
- Profile delete leak (review §3e): addressed by Task 3.
- Three commits, each scoped to a single behavioral change with a regression test.
- Stage 1 unblocks Stage 3's idle reaper and Stage 2's `force_connect`-aware fingerprint persistence.

**Next stage:** [02-stage-2-security-hardening.md](02-stage-2-security-hardening.md)
