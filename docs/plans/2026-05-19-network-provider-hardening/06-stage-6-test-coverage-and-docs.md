# Stage 6 — Test coverage and docs

> **Parent plan:** [00-overview.md](00-overview.md)
> **Prerequisites:** [Stage 5](05-stage-5-ux-polish.md) (all behavior changes are in place)
> **Unblocks:** Final PR / release

**Goal:** Add the missing `AuthSecrets` unit tests and document the new event, command, and TOFU behavior in the architecture reference.

**Why this stage ships on its own:** Pure additive — no production code changes. Useful even if some prior stages were deferred (the test file works against the existing `AuthSecrets` API regardless of how many other stages have landed).

---

## Tasks

1. [`AuthSecrets` loader test coverage](#task-1-authsecrets-loader-test-coverage)
2. [Final integration verification and API reference update](#task-2-final-integration-verification-and-api-reference-update)

---

## Task 1: `AuthSecrets` loader test coverage

**Why:** Per review §7, `crates/remote-core` started with zero tests. Stages 1, 3, and 4 added session-manager tests; this task fills the remaining gap on the `AuthSecrets::load` and `profile_has_stored_secret` helpers in `crates/remote-core/src/secrets.rs`.

> **Why it's not deeper:** `SecretStore` from `crates/platform` is a concrete struct, not a trait. Refactoring it into a trait is more scope than this plan; instead, the test injects a private-key profile path so `AuthSecrets::load` short-circuits without ever touching the keychain. The password branch is covered indirectly by integration-style tests gated behind `#[cfg(target_os = "macos")]` later if needed.

**Files:**

- Create: `crates/remote-core/tests/secrets.rs`

- [ ] **Step 1: Write the tests**

Create `crates/remote-core/tests/secrets.rs`:

```rust
use config::{AuthKind, NetworkProfileRepository, NewNetworkProfile, UpdateNetworkProfile};
use platform::SecretStore;
use remote_core::AuthSecrets;
use tempfile::TempDir;

fn profile_with(auth_kind: AuthKind, private_key_path: Option<String>) -> NewNetworkProfile {
    NewNetworkProfile {
        label: "test".into(),
        scheme: "sftp".into(),
        host: "example.invalid".into(),
        port: 22,
        username: "u".into(),
        auth_kind,
        private_key_path,
        default_path: "/".into(),
    }
}

#[test]
fn private_key_with_empty_path_has_no_stored_secret() {
    let temp = TempDir::new().unwrap();
    let repository =
        NetworkProfileRepository::new(temp.path().join("network.sqlite")).unwrap();
    let profile = repository
        .add(profile_with(AuthKind::PrivateKey, Some(String::new())))
        .unwrap();

    let secrets = SecretStore::new();
    assert!(!AuthSecrets::profile_has_stored_secret(&secrets, &profile));
}

#[test]
fn private_key_with_path_reports_stored_secret() {
    let temp = TempDir::new().unwrap();
    let repository =
        NetworkProfileRepository::new(temp.path().join("network.sqlite")).unwrap();
    let profile = repository
        .add(profile_with(
            AuthKind::PrivateKey,
            Some("/home/u/.ssh/id_ed25519".into()),
        ))
        .unwrap();

    let secrets = SecretStore::new();
    assert!(AuthSecrets::profile_has_stored_secret(&secrets, &profile));
}

#[test]
fn private_key_load_returns_no_password() {
    let temp = TempDir::new().unwrap();
    let repository =
        NetworkProfileRepository::new(temp.path().join("network.sqlite")).unwrap();
    let profile = repository
        .add(profile_with(AuthKind::PrivateKey, Some("/path".into())))
        .unwrap();

    let secrets = SecretStore::new();
    let loaded = AuthSecrets::load(&secrets, &profile).unwrap();
    assert!(loaded.password.is_none());
    // passphrase load is best-effort; on a clean keychain it should be None.
    assert!(loaded.passphrase.is_none());
}

#[test]
fn private_key_update_round_trips_key_path() {
    let temp = TempDir::new().unwrap();
    let repository =
        NetworkProfileRepository::new(temp.path().join("network.sqlite")).unwrap();
    let profile = repository
        .add(profile_with(AuthKind::PrivateKey, Some("/old".into())))
        .unwrap();

    let updated = repository
        .update(
            &profile.id,
            UpdateNetworkProfile {
                label: profile.label.clone(),
                host: profile.host.clone(),
                port: profile.port,
                username: profile.username.clone(),
                auth_kind: AuthKind::PrivateKey,
                private_key_path: Some("/new".into()),
                default_path: profile.default_path.clone(),
            },
        )
        .unwrap();

    assert_eq!(updated.private_key_path.as_deref(), Some("/new"));
}
```

- [ ] **Step 2: Run tests**

```bash
cargo test -p remote-core --test secrets
```

Expected: PASS (these all exercise existing code; the test file is the deliverable).

- [ ] **Step 3: Commit**

```bash
git add crates/remote-core/tests/secrets.rs
git commit -m "test(remote-core): cover AuthSecrets private-key paths"
```

---

## Task 2: Final integration verification and API reference update

**Why:** End-to-end sanity check and contributor-facing documentation. Update `docs/architecture/api-reference.md` so contributors find the new event + command without grepping.

**Files:**

- Modify: `docs/architecture/api-reference.md`

- [ ] **Step 1: Run the full test matrix**

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm rust:check
pnpm rust:test
pnpm rust:clippy
pnpm rust:fmt
```

Expected: all green.

- [ ] **Step 2: Document the new event and command**

In `docs/architecture/api-reference.md`, find the network commands section (search for `network_profiles_list`). Append:

```markdown
### `network_profile_forget_fingerprint`

**Request:** `NetworkProfileActionRequest { id: string }`
**Response:** `OkResponse`

Clears the pinned host-key fingerprint for the given profile. The next successful connect will pin the server's currently-presented SHA256 fingerprint via Trust-On-First-Use.

### Event: `network:status`

**Payload:** `NetworkStatusEventDto { profileId, status: "connected" | "disconnected" | "error", message?: string }`

Emitted by `ConnectionSessionManager` whenever a session transitions between connected/disconnected/error states. Frontends should subscribe via `client.network.subscribeStatusEvents(listener)` to keep the sidebar status in sync without polling. See `apps/desktop-tauri/src-tauri/src/lib.rs` for the forwarder.

### Host-key TOFU

`SftpConnector` computes the SHA-256 base64 (unpadded) fingerprint of the server's host key on every connect. On first successful authentication, the fingerprint is persisted to the `network_profiles.host_key_fingerprint` column. Subsequent connects compare the observed fingerprint against the pinned value and refuse the connection on mismatch with `RemoteError::AuthenticationFailed`. Users can clear the pin from the Edit Server dialog ("Forget pinned fingerprint"); this restores TOFU on the next connect.
```

- [ ] **Step 3: Final commit**

```bash
git add docs/architecture/api-reference.md
git commit -m "docs(architecture): document network status events and fingerprint TOFU"
```

---

## Stage 6 self-review

- `AuthSecrets` test gap (review §7): four new tests in `crates/remote-core/tests/secrets.rs`.
- Undocumented event + command: `docs/architecture/api-reference.md` now lists `network_profile_forget_fingerprint`, the `network:status` event, and the TOFU semantics.
- Two commits; both are additive.

---

## Plan complete

All 17 tasks across 6 stages map back to specific items in the review. Items intentionally not addressed by this plan are documented in [00-overview.md § Out of scope](00-overview.md#out-of-scope-follow-up-plan) and are tracked for a follow-up `RemoteSession`-reshape + write-ops plan.
