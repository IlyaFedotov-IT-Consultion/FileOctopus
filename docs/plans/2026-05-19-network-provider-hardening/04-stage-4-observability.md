# Stage 4 — Observability

> **Parent plan:** [00-overview.md](00-overview.md)
> **Prerequisites:** [Stage 1](01-stage-1-connection-lifecycle.md), [Stage 3](03-stage-3-reliability.md) (Task 1 builds on `force_connect`; status events benefit from the reaper)
> **Unblocks:** [Stage 5](05-stage-5-ux-polish.md) (sidebar badges + busy state consume the events)

**Goal:** Push connection status changes from `remote-core` through `app-ipc` and Tauri to the frontend, mirroring the existing `WATCH_CHANGED_EVENT` pattern. Drop the SMB/WebDAV pretense from `REMOTE_SCHEMES`.

**Why this stage ships on its own:** Status events are user-visible improvement (sidebar reflects reality without polling). The scheme cleanup is a small, safe correctness fix that pairs naturally with the IPC/event work.

---

## Tasks

1. [Narrow `REMOTE_SCHEMES` to actually-registered providers](#task-1-narrow-remote_schemes-to-actually-registered-providers)
2. [Push network status events to the frontend](#task-2-push-network-status-events-to-the-frontend)

---

## Task 1: Narrow `REMOTE_SCHEMES` to actually-registered providers

**Why:** `crates/vfs/src/lib.rs:13` lists `&["sftp", "smb", "webdav"]` even though only SFTP is wired (`crates/app-core/src/lib.rs:135`, `crates/config/src/network.rs:335-340` only accepts `"sftp"`). A user can construct a `smb://` URI that passes `ResourceUri::parse` but fails everywhere downstream with a generic `unsupported_provider`. Make the dead schemes fail at parse time with a clear message.

**Files:**

- Modify: `crates/vfs/src/lib.rs:13` and tests
- Modify: `crates/config/src/network.rs` (add regression test)

- [ ] **Step 1: Update `REMOTE_SCHEMES`**

In `crates/vfs/src/lib.rs:13`, replace:

```rust
pub const REMOTE_SCHEMES: &[&str] = &["sftp", "smb", "webdav"];
```

with:

```rust
pub const REMOTE_SCHEMES: &[&str] = &["sftp"];
```

- [ ] **Step 2: Add a regression test for unregistered remote schemes**

In the test module of `crates/vfs/src/lib.rs`, locate the `rejects_invalid_scheme` test (around line 872-876):

```rust
    #[test]
    fn rejects_invalid_scheme() {
        let error = ResourceUri::parse("ftp:///Users/ilya").unwrap_err();

        assert_eq!(error.code(), "unsupported_provider");
    }
```

Add a sibling test directly below:

```rust
    #[test]
    fn rejects_unregistered_remote_scheme() {
        for scheme in ["smb", "webdav", "ftp"] {
            let uri = format!("{scheme}://550e8400-e29b-41d4-a716-446655440000/");
            let error = ResourceUri::parse(&uri).unwrap_err();
            assert_eq!(error.code(), "unsupported_provider", "scheme = {scheme}");
        }
    }
```

- [ ] **Step 3: Run vfs tests**

```bash
cargo test -p vfs
```

Expected: PASS.

- [ ] **Step 4: Confirm `config::validate_profile_fields` still rejects non-sftp**

The existing check in `crates/config/src/network.rs:335-340` (`if scheme != "sftp"`) is now consistent with the narrowed `REMOTE_SCHEMES`. No code change here, but add a regression test. In the `#[cfg(test)] mod tests` block at the bottom of `crates/config/src/network.rs`, append:

```rust
    #[test]
    fn rejects_unsupported_scheme() {
        let dir = tempdir().unwrap();
        let repository = NetworkProfileRepository::new(dir.path().join("network.sqlite")).unwrap();
        let mut new = sample_profile();
        new.scheme = "smb".to_string();
        let error = repository.add(new).unwrap_err();
        assert!(matches!(error, NetworkError::InvalidValue { ref field, .. } if field == "scheme"));
    }
```

- [ ] **Step 5: Run config tests**

```bash
cargo test -p config
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add crates/vfs/src/lib.rs crates/config/src/network.rs
git commit -m "chore(vfs): narrow REMOTE_SCHEMES to providers that exist"
```

---

## Task 2: Push network status events to the frontend

**Why:** Per review §5b, the sidebar status (`Sidebar.tsx:192-198`) is refreshed only on user-triggered actions. Backend-driven status transitions (idle reap from Stage 3 Task 1, transient transport error from Stage 3 Task 2) are invisible until something else triggers a poll. Add a server-pushed event channel, mirroring `WATCH_CHANGED_EVENT`.

**Files:**

- Modify: `crates/remote-core/src/session.rs` (broadcast channel)
- Modify: `crates/remote-core/src/lib.rs` (re-export `NetworkStatusEvent`)
- Modify: `crates/app-ipc/src/lib.rs` (event name + DTO)
- Modify: `apps/desktop-tauri/src-tauri/src/lib.rs` (spawn forwarder)
- Modify: `packages/ts-api/src/types.ts` (DTO)
- Modify: `packages/ts-api/src/clients/network.ts` (subscribe helper)
- Modify: `packages/ts-api/src/index.ts` (re-export)
- Modify: `packages/frontend/src/hooks/useAppInit.ts` (subscribe)
- Modify: `packages/frontend/src/app/providers/ShellProvider.tsx` (thread `setNetworkStatuses`)
- Test: `crates/remote-core/tests/session_manager.rs` (extend)

- [ ] **Step 1: Define the broadcast channel in `remote-core`**

In `crates/remote-core/src/session.rs`, add near the top imports:

```rust
use tokio::sync::broadcast;
```

Add a new public type below `ConnectionStatus`:

```rust
#[derive(Debug, Clone)]
pub struct NetworkStatusEvent {
    pub profile_id: String,
    pub status: ConnectionStatus,
}
```

Extend `ConnectionSessionManager` to own a broadcast sender. Modify the struct (around line 77-83):

```rust
pub struct ConnectionSessionManager {
    profiles: NetworkProfileRepository,
    secrets: SecretStore,
    connectors: Arc<RwLock<RemoteConnectorRegistry>>,
    sessions: RwLock<HashMap<String, RemoteSessionHandle>>,
    statuses: RwLock<HashMap<String, ConnectionStatus>>,
    status_tx: broadcast::Sender<NetworkStatusEvent>,
    // If Stage 3 Task 3 has already landed:
    // connect_locks: RwLock<HashMap<String, Arc<tokio::sync::Mutex<()>>>>,
}
```

Update `new`:

```rust
    pub fn new(
        profiles: NetworkProfileRepository,
        secrets: SecretStore,
        connectors: Arc<RwLock<RemoteConnectorRegistry>>,
    ) -> Self {
        let (status_tx, _) = broadcast::channel(64);
        Self {
            profiles,
            secrets,
            connectors,
            sessions: RwLock::new(HashMap::new()),
            statuses: RwLock::new(HashMap::new()),
            status_tx,
            // connect_locks: RwLock::new(HashMap::new()), // if Stage 3 Task 3 has landed
        }
    }

    pub fn subscribe_status(&self) -> broadcast::Receiver<NetworkStatusEvent> {
        self.status_tx.subscribe()
    }
```

Add a private helper:

```rust
    fn publish_status(&self, profile_id: &str, status: ConnectionStatus) {
        let _ = self.status_tx.send(NetworkStatusEvent {
            profile_id: profile_id.to_string(),
            status,
        });
    }
```

Replace every direct `self.statuses.write().await.insert(...)` with both the insert and a `publish_status` call. There are three call sites:

- In `force_connect` after `Ok(session)`, replace:

  ```rust
                  self.statuses
                      .write()
                      .await
                      .insert(profile_id.to_string(), ConnectionStatus::Connected);
                  let _ = self.profiles.set_connection_state(profile_id, true, None);
  ```

  with:

  ```rust
                  self.statuses
                      .write()
                      .await
                      .insert(profile_id.to_string(), ConnectionStatus::Connected);
                  self.publish_status(profile_id, ConnectionStatus::Connected);
                  let _ = self.profiles.set_connection_state(profile_id, true, None);
  ```

- In `disconnect`, replace:

  ```rust
          self.statuses
              .write()
              .await
              .insert(profile_id.to_string(), ConnectionStatus::Disconnected);
          Ok(())
  ```

  with:

  ```rust
          self.statuses
              .write()
              .await
              .insert(profile_id.to_string(), ConnectionStatus::Disconnected);
          self.publish_status(profile_id, ConnectionStatus::Disconnected);
          Ok(())
  ```

- In `mark_error`, replace:

  ```rust
          self.statuses.write().await.insert(
              profile_id.to_string(),
              ConnectionStatus::Error {
                  message: message.to_string(),
              },
          );
  ```

  with:

  ```rust
          let status = ConnectionStatus::Error {
              message: message.to_string(),
          };
          self.statuses
              .write()
              .await
              .insert(profile_id.to_string(), status.clone());
          self.publish_status(profile_id, status);
  ```

- [ ] **Step 2: Write failing tests**

Append to `crates/remote-core/tests/session_manager.rs`:

```rust
#[tokio::test]
async fn connect_emits_status_event() {
    let fixture = Fixture::new();
    let profile_id = fixture.add_profile();
    let manager = fixture.manager();
    let mut rx = manager.subscribe_status();

    manager.connect(&profile_id).await.unwrap();
    let event = rx.recv().await.expect("status event after connect");

    assert_eq!(event.profile_id, profile_id);
    assert_eq!(event.status, ConnectionStatus::Connected);
}

#[tokio::test]
async fn disconnect_emits_status_event() {
    let fixture = Fixture::new();
    let profile_id = fixture.add_profile();
    let manager = fixture.manager();
    manager.connect(&profile_id).await.unwrap();
    let mut rx = manager.subscribe_status();

    manager.disconnect(&profile_id).await.unwrap();
    let event = rx.recv().await.expect("status event after disconnect");

    assert_eq!(event.profile_id, profile_id);
    assert_eq!(event.status, ConnectionStatus::Disconnected);
}
```

- [ ] **Step 3: Re-export `NetworkStatusEvent`**

In `crates/remote-core/src/lib.rs`:

```rust
pub use session::{
    spawn_idle_reaper, ConnectionSessionManager, ConnectionStatus, NetworkStatusEvent,
    RemoteConnector, RemoteConnectorRegistry, RemoteSession,
};
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
cargo test -p remote-core --test session_manager
```

Expected: PASS.

- [ ] **Step 5: Add IPC event constant and DTO**

In `crates/app-ipc/src/lib.rs`, add to the event constants block (after `WATCH_CHANGED_EVENT` near line 16):

```rust
pub const NETWORK_STATUS_EVENT: &str = "network:status";
```

Add the DTO near the other network DTOs (after `NetworkConnectionStatusDto`):

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkStatusEventDto {
    pub profile_id: String,
    pub status: String,
    pub message: Option<String>,
}
```

- [ ] **Step 6: Forward events from the Tauri shell**

In `apps/desktop-tauri/src-tauri/src/lib.rs`, replace the `setup` closure body with:

```rust
        .setup(|app| {
            telemetry::info("FileOctopus Tauri shell started");

            let app_handle = app.handle().clone();
            let state = app_handle
                .state::<std::sync::Arc<app_core::AppState>>()
                .inner()
                .clone();
            let mut rx = state.sessions().subscribe_status();
            tauri::async_runtime::spawn(async move {
                use app_ipc::{NetworkStatusEventDto, NETWORK_STATUS_EVENT};
                while let Ok(event) = rx.recv().await {
                    let (status, message) = match event.status {
                        remote_core::ConnectionStatus::Connected => {
                            ("connected".to_string(), None)
                        }
                        remote_core::ConnectionStatus::Disconnected => {
                            ("disconnected".to_string(), None)
                        }
                        remote_core::ConnectionStatus::Error { message } => {
                            ("error".to_string(), Some(message))
                        }
                    };
                    crate::emit::emit_with_eval(
                        &app_handle,
                        NETWORK_STATUS_EVENT,
                        NetworkStatusEventDto {
                            profile_id: event.profile_id,
                            status,
                            message,
                        },
                    );
                }
            });

            Ok(())
        })
```

At the top of `apps/desktop-tauri/src-tauri/src/lib.rs`, ensure `use tauri::Manager;` is imported (needed for `app.handle()`); if it's already there leave it.

- [ ] **Step 7: TypeScript DTO and subscriber**

In `packages/ts-api/src/types.ts`, add after `NetworkConnectionStatusDto`:

```ts
export interface NetworkStatusEvent {
  profileId: string;
  status: "connected" | "disconnected" | "error";
  message: string | null;
}

export const NETWORK_STATUS_EVENT = "network:status";
```

In `packages/ts-api/src/clients/network.ts`, add a method to `NetworkClient`:

```ts
  async subscribeStatusEvents(
    listener: (event: NetworkStatusEvent) => void,
  ): Promise<() => void> {
    return this.transport.subscribe(NETWORK_STATUS_EVENT, listener);
  }
```

Add `NetworkStatusEvent` and `NETWORK_STATUS_EVENT` to the import block at the top of the file. Confirm `IpcTransport` already exposes a `subscribe` method (it does — used by `subscribe(DIRECTORY_BATCH_EVENT, ...)` elsewhere; check `packages/ts-api/src/transports/tauri.ts`).

In `packages/ts-api/src/index.ts`, export the new symbols by adding them to the existing re-export list (the file aggregates types from `./types`).

- [ ] **Step 8: Subscribe from the frontend on app init**

In `packages/frontend/src/hooks/useAppInit.ts`, locate the existing event-subscription block (search for `subscribe(DIRECTORY_BATCH_EVENT` or similar). Add an additional subscription that updates the `networkStatuses` state.

Insert near other subscriptions:

```ts
useEffect(() => {
  let dispose: (() => void) | null = null;
  void client.network
    .subscribeStatusEvents((event) => {
      setNetworkStatuses((current) => {
        const others = current.filter(
          (status) => status.profileId !== event.profileId,
        );
        return [
          ...others,
          {
            profileId: event.profileId,
            status: event.status,
            message: event.message,
          },
        ];
      });
    })
    .then((unsub) => {
      dispose = unsub;
    });
  return () => {
    dispose?.();
  };
}, [client, setNetworkStatuses]);
```

> **Where to put this exactly:** open `packages/frontend/src/hooks/useAppInit.ts`, find the function body and the dependency list where `setNetworkStatuses` is already passed in (it's wired through `useNavigation`'s deps). If `useAppInit` does not currently receive `setNetworkStatuses` as a parameter, add it to the deps interface and to the call site in `ShellProvider`.

- [ ] **Step 9: Run frontend tests**

```bash
pnpm --filter @fileoctopus/frontend test
pnpm --filter @fileoctopus/frontend typecheck
```

Expected: PASS.

- [ ] **Step 10: Run all Rust tests**

```bash
pnpm rust:test
pnpm rust:clippy
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add crates/remote-core/src/session.rs \
        crates/remote-core/src/lib.rs \
        crates/app-ipc/src/lib.rs \
        apps/desktop-tauri/src-tauri/src/lib.rs \
        crates/remote-core/tests/session_manager.rs \
        packages/ts-api/src/types.ts \
        packages/ts-api/src/clients/network.ts \
        packages/ts-api/src/index.ts \
        packages/frontend/src/hooks/useAppInit.ts \
        packages/frontend/src/app/providers/ShellProvider.tsx
git commit -m "feat(network): push connection status changes to the frontend"
```

---

## Stage 4 self-review

- SMB/WebDAV vapor (review §1): removed from `REMOTE_SCHEMES`; URIs with those schemes now fail at parse time with `unsupported_provider`.
- Live status updates (review §5b): `tokio::sync::broadcast` channel in `ConnectionSessionManager` propagates connect/disconnect/error transitions through Tauri's event system to the frontend.
- Two commits; Task 1 is independent of Task 2 and can land first or last.

**Next stage:** [05-stage-5-ux-polish.md](05-stage-5-ux-polish.md)
