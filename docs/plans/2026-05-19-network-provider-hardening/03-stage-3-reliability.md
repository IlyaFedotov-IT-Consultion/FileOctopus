# Stage 3 — Reliability

> **Parent plan:** [00-overview.md](00-overview.md)
> **Prerequisites:** [Stage 1](01-stage-1-connection-lifecycle.md) (uses `force_connect` and the test fixture)
> **Unblocks:** Stage 4 (the status events benefit from the reaper)

**Goal:** Keep the session pool healthy. Reap idle sessions on a background tick, probe sessions with `ping()` before returning them, reconnect once on transport failure, and prevent duplicate handshakes when concurrent callers all miss the cache.

**Why this stage ships on its own:** Three independent reliability features. Each can be deployed without the others, although Tasks 2 and 3 deliver the most user-visible improvement together.

---

## Tasks

1. [Background idle-session reaper](#task-1-background-idle-session-reaper)
2. [Reconnect on transient transport error](#task-2-reconnect-on-transient-transport-error)
3. [Per-profile connect lock (race fix)](#task-3-per-profile-connect-lock-race-fix)

---

## Task 1: Background idle-session reaper

**Why:** `SESSION_IDLE_TIMEOUT = 15 min` (`crates/remote-core/src/session.rs:13`) is enforced lazily on access. A connected session whose profile is never revisited holds a TCP socket and file descriptors indefinitely. We need a background tokio task that periodically scans and disconnects idle sessions.

**Files:**

- Modify: `crates/remote-core/src/session.rs` (add reaper)
- Modify: `crates/remote-core/src/lib.rs` (re-export helper)
- Modify: `crates/app-core/src/lib.rs` (spawn reaper at boot)
- Test: `crates/remote-core/tests/session_manager.rs` (extend)

- [ ] **Step 1: Write failing test that exercises the reaper directly**

Append to `crates/remote-core/tests/session_manager.rs`:

```rust
use std::time::Duration;

#[tokio::test]
async fn reap_idle_sessions_disconnects_stale_handles() {
    let fixture = Fixture::new();
    let profile_id = fixture.add_profile();
    let manager = fixture.manager();

    manager.connect(&profile_id).await.unwrap();
    assert_eq!(
        manager.connection_status(&profile_id).await,
        ConnectionStatus::Connected,
    );

    // Drive the reaper with a tiny idle threshold so we don't sleep for 15 minutes.
    manager
        .reap_idle_sessions(Duration::from_millis(0))
        .await;

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

- [ ] **Step 2: Run test, verify it fails**

```bash
cargo test -p remote-core --test session_manager reap_idle_sessions_disconnects_stale_handles
```

Expected: FAIL on `no method named reap_idle_sessions`.

- [ ] **Step 3: Implement `reap_idle_sessions`**

In `crates/remote-core/src/session.rs`, add inside `impl ConnectionSessionManager` (after `disconnect`):

```rust
    /// Walk the session table and disconnect any handle whose `last_used`
    /// is older than `threshold`. Intended to be called periodically from
    /// a background task (see `spawn_idle_reaper`).
    pub async fn reap_idle_sessions(&self, threshold: Duration) {
        let stale: Vec<String> = {
            let sessions = self.sessions.read().await;
            sessions
                .iter()
                .filter(|(_, handle)| handle.last_used.elapsed() >= threshold)
                .map(|(id, _)| id.clone())
                .collect()
        };

        for profile_id in stale {
            let _ = self.disconnect(&profile_id).await;
        }
    }
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cargo test -p remote-core --test session_manager reap_idle_sessions_disconnects_stale_handles
```

Expected: PASS.

- [ ] **Step 5: Add reaper task spawn helper**

Still in `crates/remote-core/src/session.rs`, add (outside the `impl`) a free function:

```rust
const IDLE_REAPER_TICK: Duration = Duration::from_secs(60);

/// Spawns a tokio task that periodically reaps idle sessions held by `manager`.
/// Aborts cleanly when the returned `JoinHandle` is dropped.
pub fn spawn_idle_reaper(
    manager: Arc<ConnectionSessionManager>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(IDLE_REAPER_TICK);
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            interval.tick().await;
            manager.reap_idle_sessions(SESSION_IDLE_TIMEOUT).await;
        }
    })
}
```

- [ ] **Step 6: Re-export the helper**

In `crates/remote-core/src/lib.rs`, replace:

```rust
pub use session::{
    ConnectionSessionManager, ConnectionStatus, RemoteConnector, RemoteConnectorRegistry,
    RemoteSession,
};
```

with:

```rust
pub use session::{
    spawn_idle_reaper, ConnectionSessionManager, ConnectionStatus, RemoteConnector,
    RemoteConnectorRegistry, RemoteSession,
};
```

- [ ] **Step 7: Spawn at boot**

In `crates/app-core/src/lib.rs`, after the `sessions` Arc is created (around line 137-141, after the `let sessions = Arc::new(ConnectionSessionManager::new(...))` line), add:

```rust
        // Drop the JoinHandle on purpose: when AppState is dropped at shutdown the
        // tokio runtime is also torn down, which cancels the spawned task.
        let _reaper = remote_core::spawn_idle_reaper(sessions.clone());
```

- [ ] **Step 8: Run full Rust test + clippy**

```bash
pnpm rust:test
pnpm rust:clippy
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add crates/remote-core/src/session.rs \
        crates/remote-core/src/lib.rs \
        crates/app-core/src/lib.rs \
        crates/remote-core/tests/session_manager.rs
git commit -m "feat(remote-core): spawn idle-session reaper at boot"
```

---

## Task 2: Reconnect on transient transport error

**Why:** Per review §3c, `session_for_profile` reconnects only when the last-used timestamp is older than `SESSION_IDLE_TIMEOUT`. A dropped TCP connection that returns errors mid-session bubbles up as `VfsError::Internal` from `map_ssh_error` and the user sees "internal error". Use `ping()` (which exists but is never called) as a liveness probe and reconnect once on probe failure.

**Files:**

- Modify: `crates/remote-core/src/session.rs:191-213`
- Test: `crates/remote-core/tests/session_manager.rs` (extend)

- [ ] **Step 1: Extend the stub session to fail on demand**

In `crates/remote-core/tests/session_manager.rs`, replace the `StubSession` and `StubConnector` definitions with versions that can simulate a dead session:

```rust
use std::sync::Mutex;

#[derive(Default)]
struct StubSession {
    ping_should_fail: Arc<Mutex<bool>>,
}

#[async_trait]
impl RemoteSession for StubSession {
    async fn ping(&self) -> Result<(), RemoteError> {
        if *self.ping_should_fail.lock().unwrap() {
            return Err(RemoteError::ConnectionFailed {
                uri: "sftp://test".into(),
                message: "stub fault".into(),
            });
        }
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
    next_failure: Mutex<Vec<Arc<Mutex<bool>>>>,
}

impl StubConnector {
    fn kill_next_session_after_open(&self) -> Arc<Mutex<bool>> {
        let flag = Arc::new(Mutex::new(false));
        self.next_failure.lock().unwrap().push(flag.clone());
        flag
    }
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
        let flag = self
            .next_failure
            .lock()
            .unwrap()
            .pop()
            .unwrap_or_else(|| Arc::new(Mutex::new(false)));
        Ok(Arc::new(StubSession {
            ping_should_fail: flag,
        }))
    }

    async fn disconnect(&self, _session: Arc<dyn RemoteSession>) -> Result<(), RemoteError> {
        self.disconnects.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }
}
```

Update the previous tests (idempotency, disconnect, reap) to match the new struct shape — they no longer reference `pings`. The simplest fix is to drop the `pings` reference from the original `StubSession` and use the new shape across all tests.

- [ ] **Step 2: Write failing test**

Append to `crates/remote-core/tests/session_manager.rs`:

```rust
#[tokio::test]
async fn session_for_profile_reconnects_when_ping_fails() {
    let fixture = Fixture::new();
    let profile_id = fixture.add_profile();
    let manager = fixture.manager();

    // First connect produces a session whose ping will start failing.
    let flag = fixture.connector.kill_next_session_after_open();
    manager.connect(&profile_id).await.unwrap();

    // Simulate transport drop.
    *flag.lock().unwrap() = true;

    // The next session lookup must observe the failure and reconnect.
    let _ = manager.session_for_profile(&profile_id).await.unwrap();
    assert_eq!(
        fixture.connector.connects.load(Ordering::SeqCst),
        2,
        "expected reconnect after ping failure"
    );
}
```

- [ ] **Step 3: Run test, verify it fails**

```bash
cargo test -p remote-core --test session_manager session_for_profile_reconnects_when_ping_fails
```

Expected: FAIL (current `session_for_profile` returns the cached session without probing).

- [ ] **Step 4: Probe before returning a cached session**

In `crates/remote-core/src/session.rs`, replace `session_for_profile` (lines 191-213) with:

```rust
    pub async fn session_for_profile(
        &self,
        profile_id: &str,
    ) -> Result<Arc<dyn RemoteSession>, RemoteError> {
        let cached: Option<Arc<dyn RemoteSession>> = {
            let sessions = self.sessions.read().await;
            sessions
                .get(profile_id)
                .filter(|handle| handle.last_used.elapsed() < SESSION_IDLE_TIMEOUT)
                .map(|handle| handle.inner.clone())
        };

        if let Some(session) = cached {
            if session.ping().await.is_ok() {
                return Ok(session);
            }
            // Probe failed: discard the dead handle before reconnecting so we don't
            // race a second `connect` call against the stale entry.
            let _ = self.disconnect(profile_id).await;
        }

        self.force_connect(profile_id).await?;
        self.sessions
            .read()
            .await
            .get(profile_id)
            .map(|handle| handle.inner.clone())
            .ok_or_else(|| RemoteError::NotConnected {
                uri: format!("sftp://{profile_id}"),
            })
    }
```

- [ ] **Step 5: Run test, verify it passes**

```bash
cargo test -p remote-core --test session_manager session_for_profile_reconnects_when_ping_fails
```

Expected: PASS.

- [ ] **Step 6: Run full remote-core test suite**

```bash
cargo test -p remote-core
pnpm rust:clippy
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add crates/remote-core/src/session.rs \
        crates/remote-core/tests/session_manager.rs
git commit -m "feat(remote-core): probe sessions and reconnect on transport failure"
```

---

## Task 3: Per-profile connect lock (race fix)

**Why:** Per review §3d, two concurrent `connect` callers that both miss the cache will both perform a handshake; the second wins, the first's session is wasted. Combined with Task 2, this race surfaces whenever a directory listing fires the same instant as the user clicks "Connect".

**Files:**

- Modify: `crates/remote-core/src/session.rs`
- Test: `crates/remote-core/tests/session_manager.rs` (extend)

- [ ] **Step 1: Write failing test**

Append to `crates/remote-core/tests/session_manager.rs`:

```rust
#[tokio::test]
async fn concurrent_connect_calls_share_a_single_handshake() {
    use std::sync::Arc;

    let fixture = Fixture::new();
    let profile_id = fixture.add_profile();
    let manager = Arc::new(fixture.manager());

    let manager_a = manager.clone();
    let id_a = profile_id.clone();
    let task_a = tokio::spawn(async move { manager_a.connect(&id_a).await });

    let manager_b = manager.clone();
    let id_b = profile_id.clone();
    let task_b = tokio::spawn(async move { manager_b.connect(&id_b).await });

    task_a.await.unwrap().unwrap();
    task_b.await.unwrap().unwrap();

    assert_eq!(
        fixture.connector.connects.load(Ordering::SeqCst),
        1,
        "concurrent connects should coalesce into a single handshake"
    );
}
```

- [ ] **Step 2: Run test, verify it fails**

```bash
cargo test -p remote-core --test session_manager concurrent_connect_calls_share_a_single_handshake
```

Expected: FAIL — both tasks miss the cache and both call `force_connect`.

- [ ] **Step 3: Add a per-profile in-flight lock**

In `crates/remote-core/src/session.rs`, add to the struct:

```rust
pub struct ConnectionSessionManager {
    profiles: NetworkProfileRepository,
    secrets: SecretStore,
    connectors: Arc<RwLock<RemoteConnectorRegistry>>,
    sessions: RwLock<HashMap<String, RemoteSessionHandle>>,
    statuses: RwLock<HashMap<String, ConnectionStatus>>,
    connect_locks: RwLock<HashMap<String, Arc<tokio::sync::Mutex<()>>>>,
}
```

> **Note:** If Stage 4 Task 2 is being implemented in parallel, it adds a `status_tx: broadcast::Sender<NetworkStatusEvent>` field. The two additions don't conflict — just include both fields when both stages land.

Update `new`:

```rust
        Self {
            profiles,
            secrets,
            connectors,
            sessions: RwLock::new(HashMap::new()),
            statuses: RwLock::new(HashMap::new()),
            connect_locks: RwLock::new(HashMap::new()),
        }
```

Add helper:

```rust
    async fn connect_lock(&self, profile_id: &str) -> Arc<tokio::sync::Mutex<()>> {
        {
            let locks = self.connect_locks.read().await;
            if let Some(lock) = locks.get(profile_id) {
                return lock.clone();
            }
        }
        let mut locks = self.connect_locks.write().await;
        locks
            .entry(profile_id.to_string())
            .or_insert_with(|| Arc::new(tokio::sync::Mutex::new(())))
            .clone()
    }
```

Wrap `connect`:

```rust
    pub async fn connect(&self, profile_id: &str) -> Result<(), RemoteError> {
        if self.session_is_alive(profile_id).await {
            return Ok(());
        }
        let lock = self.connect_lock(profile_id).await;
        let _guard = lock.lock().await;
        if self.session_is_alive(profile_id).await {
            return Ok(());
        }
        self.force_connect(profile_id).await
    }
```

- [ ] **Step 4: Run test, verify it passes**

```bash
cargo test -p remote-core --test session_manager concurrent_connect_calls_share_a_single_handshake
```

Expected: PASS.

- [ ] **Step 5: Run full test suite + clippy**

```bash
cargo test -p remote-core
pnpm rust:clippy
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add crates/remote-core/src/session.rs \
        crates/remote-core/tests/session_manager.rs
git commit -m "fix(remote-core): coalesce concurrent connect calls per profile"
```

---

## Stage 3 self-review

- Idle reaper (review §3c): periodic tokio task disconnects sessions past `SESSION_IDLE_TIMEOUT`.
- Reconnect on transport failure (review §3c continued): `session_for_profile` probes `ping()` and force-reconnects on probe failure.
- Connect race (review §3d): per-profile in-flight `tokio::sync::Mutex` coalesces concurrent `connect` callers.
- Four new tests in `crates/remote-core/tests/session_manager.rs`. Each task is reviewable in isolation.

**Next stage:** [04-stage-4-observability.md](04-stage-4-observability.md)
