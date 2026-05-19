# Stage 2 — Security hardening

> **Parent plan:** [00-overview.md](00-overview.md)
> **Prerequisites:** [Stage 1](01-stage-1-connection-lifecycle.md) (Task 1's `force_connect` split is referenced in Task 1 Step 8)
> **Unblocks:** Stage 5 (the fingerprint UI depends on Task 1's persistence)

**Goal:** Replace the broken host-key hashing with real SHA-256 + base64 in OpenSSH format, persist on first connect via Trust-On-First-Use, tighten profile validation, and carry the real URI through error messages.

**Why this stage ships on its own:** Three independent security improvements. Even partial adoption (only Task 1) materially improves the security posture; Tasks 2 and 3 are low-risk follow-ons.

---

## Tasks

1. [SHA-256 host-key fingerprint with TOFU pinning](#task-1-sha-256-host-key-fingerprint-with-tofu-pinning)
2. [Port and host validation tightening](#task-2-port-and-host-validation-tightening)
3. [Preserve real URI in `RemoteError → VfsError` mapping](#task-3-preserve-real-uri-in-remoteerror--vfserror-mapping)

---

## Task 1: SHA-256 host-key fingerprint with TOFU pinning

**Why:** `crates/provider-sftp/src/connector.rs:296-302` `hex_fingerprint` colon-joins the **entire raw public key blob** instead of its hash. It will never match `ssh-keyscan -t rsa,ed25519 host | ssh-keygen -lf -` output (which is `SHA256:<base64>` for modern OpenSSH) and is unusable as a security feature. On top of that, the first-seen fingerprint is never persisted, so TOFU never pins.

**Files:**

- Modify: `crates/provider-sftp/Cargo.toml`
- Modify: `crates/provider-sftp/src/connector.rs:83-93,296-302`
- Modify: `crates/provider-sftp/src/lib.rs` (re-export the new helper)
- Modify: `crates/remote-core/Cargo.toml` (add `provider-sftp` dep)
- Modify: `crates/remote-core/src/session.rs` (persist fingerprint after connect)
- Test: `crates/provider-sftp/tests/fingerprint.rs` (create)

- [ ] **Step 1: Add dependencies**

In `crates/provider-sftp/Cargo.toml`, add to `[dependencies]`:

```toml
sha2 = "0.10"
data-encoding = "2"
```

- [ ] **Step 2: Write failing test**

Create `crates/provider-sftp/tests/fingerprint.rs`:

```rust
use provider_sftp::sha256_base64_fingerprint;

#[test]
fn produces_openssh_style_sha256_label() {
    // Synthetic key blob; we only care about format here.
    let blob = b"\x00\x01\x02\x03\x04test-key-bytes";
    let fingerprint = sha256_base64_fingerprint(blob);

    assert!(
        fingerprint.starts_with("SHA256:"),
        "fingerprint should be prefixed with `SHA256:`, got {fingerprint}"
    );

    let suffix = fingerprint.trim_start_matches("SHA256:");
    assert!(
        !suffix.ends_with('='),
        "OpenSSH strips base64 padding from fingerprints, got {fingerprint}"
    );
    assert!(suffix.chars().all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/'));
    // SHA-256 output is 32 bytes -> 43 chars of unpadded base64.
    assert_eq!(suffix.len(), 43);
}

#[test]
fn fingerprint_is_deterministic() {
    let blob = b"deterministic input";
    assert_eq!(
        sha256_base64_fingerprint(blob),
        sha256_base64_fingerprint(blob),
    );
}

#[test]
fn fingerprint_changes_when_blob_changes() {
    let a = sha256_base64_fingerprint(b"server-a");
    let b = sha256_base64_fingerprint(b"server-b");
    assert_ne!(a, b);
}
```

- [ ] **Step 3: Run test, verify it fails (symbol not defined)**

```bash
cargo test -p provider-sftp --test fingerprint
```

Expected: FAIL on `unresolved import provider_sftp::sha256_base64_fingerprint`.

- [ ] **Step 4: Implement new fingerprint helper**

In `crates/provider-sftp/src/connector.rs`, replace `fn hex_fingerprint` (lines 296-302) with:

```rust
pub fn sha256_base64_fingerprint(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};

    let digest = Sha256::digest(bytes);
    // OpenSSH uses unpadded standard base64 (RFC 4648, no `=` trailing).
    let encoded = data_encoding::BASE64_NOPAD.encode(&digest);
    format!("SHA256:{encoded}")
}
```

- [ ] **Step 5: Export it from the crate**

In `crates/provider-sftp/src/lib.rs`, replace:

```rust
mod connector;
mod provider;

pub use connector::{SftpConnector, SftpSession};
pub use provider::SftpProvider;
```

with:

```rust
mod connector;
mod provider;

pub use connector::{sha256_base64_fingerprint, SftpConnector, SftpSession};
pub use provider::SftpProvider;
```

- [ ] **Step 6: Update the call site inside the connector**

In `crates/provider-sftp/src/connector.rs`, replace the body at lines 83-93 (the `let fingerprint = session.host_key()...` block) with:

```rust
        let fingerprint = session
            .host_key()
            .map(|(key, _)| sha256_base64_fingerprint(key));

        match (profile.host_key_fingerprint.as_deref(), fingerprint.as_deref()) {
            (Some(expected), Some(observed)) if expected != observed => {
                return Err(RemoteError::AuthenticationFailed {
                    message: format!(
                        "host key fingerprint mismatch (expected {expected}, got {observed})"
                    ),
                });
            }
            _ => {}
        }
```

Note: we deliberately leave the persistence (TOFU pin-on-first-seen) for Step 7 below — it must happen after authentication succeeds, not while we still have the chance of bailing out.

- [ ] **Step 7: Carry the observed fingerprint on the `SftpSession`**

We need the session manager to persist the just-observed fingerprint via `NetworkProfileRepository::set_host_key_fingerprint`. The cleanest seam is to have `SftpConnector::connect` return the observed fingerprint alongside the session, but `RemoteConnector::connect` returns only `Arc<dyn RemoteSession>`. To avoid widening the trait in this plan, we'll store the fingerprint on the `SftpSession` and let the session manager pull it after a successful connect.

In `crates/provider-sftp/src/connector.rs`, change the `SftpSession` struct (lines 11-13) to:

```rust
pub struct SftpSession {
    pub(crate) session: Arc<Mutex<Session>>,
    observed_fingerprint: Option<String>,
}
```

Update `SftpSession::with_session`:

```rust
impl SftpSession {
    pub fn with_session(session: Session, observed_fingerprint: Option<String>) -> Self {
        Self {
            session: Arc::new(Mutex::new(session)),
            observed_fingerprint,
        }
    }

    pub fn observed_fingerprint(&self) -> Option<&str> {
        self.observed_fingerprint.as_deref()
    }

    pub fn clone_handle(&self) -> Self {
        Self {
            session: Arc::clone(&self.session),
            observed_fingerprint: self.observed_fingerprint.clone(),
        }
    }

    // ... lock_session unchanged
```

And in `connect_blocking` capture and return the fingerprint alongside the session. Change the return type:

```rust
    fn connect_blocking(
        profile: &NetworkProfile,
        secrets: &AuthSecrets,
    ) -> Result<(Session, Option<String>), RemoteError> {
        // ... same body up to fingerprint comparison ...
        // After successful auth:
        Ok((session, fingerprint))
    }
```

And in the trait `impl`:

```rust
    async fn connect(
        &self,
        profile: &NetworkProfile,
        secrets: &AuthSecrets,
    ) -> Result<Arc<dyn RemoteSession>, RemoteError> {
        let profile = profile.clone();
        let secrets = secrets.clone();
        let (session, fingerprint) =
            tokio::task::spawn_blocking(move || Self::connect_blocking(&profile, &secrets))
                .await
                .map_err(|error| RemoteError::Internal(error.to_string()))??;
        Ok(Arc::new(SftpSession::with_session(session, fingerprint)))
    }
```

- [ ] **Step 8: Persist the fingerprint after a successful connect in the session manager**

In `crates/remote-core/src/session.rs`, inside `force_connect` (the renamed body from Stage 1 Task 1), after the `Ok(session)` arm calls `self.profiles.set_connection_state(profile_id, true, None)`, add:

```rust
                if let Some(sftp) = session
                    .as_any()
                    .downcast_ref::<provider_sftp::SftpSession>()
                    .and_then(|s| s.observed_fingerprint())
                {
                    if profile.host_key_fingerprint.as_deref() != Some(sftp) {
                        let _ = self.profiles.set_host_key_fingerprint(profile_id, sftp);
                    }
                }
```

This is the **only** place we keep an `as_any()` downcast — and it's tagged for removal in the follow-up `RemoteSession` reshape plan. To make the import work, add `provider-sftp` to `crates/remote-core/Cargo.toml`:

```toml
provider-sftp = { path = "../provider-sftp" }
```

> ⚠️ Adding `provider-sftp` as a dependency of `remote-core` creates a forward dependency that the follow-up `RemoteSession` reshape will remove. For now it's the smallest possible coupling — we only reference the concrete type to pull the fingerprint out.

- [ ] **Step 9: Run all tests**

```bash
cargo test -p provider-sftp --test fingerprint
cargo test -p provider-sftp
cargo test -p remote-core
pnpm rust:clippy
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add crates/provider-sftp/Cargo.toml \
        crates/provider-sftp/src/connector.rs \
        crates/provider-sftp/src/lib.rs \
        crates/provider-sftp/tests/fingerprint.rs \
        crates/remote-core/Cargo.toml \
        crates/remote-core/src/session.rs
git commit -m "fix(provider-sftp): use SHA256 host-key fingerprint with TOFU pinning"
```

---

## Task 2: Port and host validation tightening

**Why:** `crates/config/src/network.rs:334-357` accepts port 0 (a valid `u16` but invalid TCP port) and rejects only empty hostnames. We add minimal validation: port in `1..=65535`, host has at least one non-whitespace character and no embedded spaces/control chars.

**Files:**

- Modify: `crates/config/src/network.rs`

- [ ] **Step 1: Write failing tests**

In `crates/config/src/network.rs`, append to the `#[cfg(test)] mod tests` block:

```rust
    #[test]
    fn rejects_port_zero() {
        let dir = tempdir().unwrap();
        let repository = NetworkProfileRepository::new(dir.path().join("network.sqlite")).unwrap();
        let mut new = sample_profile();
        new.port = 0;
        let error = repository.add(new).unwrap_err();
        assert!(matches!(error, NetworkError::InvalidValue { ref field, .. } if field == "port"));
    }

    #[test]
    fn rejects_host_with_whitespace() {
        let dir = tempdir().unwrap();
        let repository = NetworkProfileRepository::new(dir.path().join("network.sqlite")).unwrap();
        let mut new = sample_profile();
        new.host = "bad host".to_string();
        let error = repository.add(new).unwrap_err();
        assert!(matches!(error, NetworkError::InvalidValue { ref field, .. } if field == "host"));
    }

    #[test]
    fn rejects_host_with_control_char() {
        let dir = tempdir().unwrap();
        let repository = NetworkProfileRepository::new(dir.path().join("network.sqlite")).unwrap();
        let mut new = sample_profile();
        new.host = "bad\u{0001}host".to_string();
        let error = repository.add(new).unwrap_err();
        assert!(matches!(error, NetworkError::InvalidValue { ref field, .. } if field == "host"));
    }
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
cargo test -p config rejects_port_zero rejects_host_with_whitespace rejects_host_with_control_char
```

Expected: FAIL — currently all three are accepted.

- [ ] **Step 3: Tighten validation**

Add a `port` parameter to `validate_profile_fields` and update both call sites. In `crates/config/src/network.rs`, replace the function (lines 334-357):

```rust
fn validate_profile_fields(
    scheme: &str,
    host: &str,
    username: &str,
    port: u16,
) -> Result<(), NetworkError> {
    if scheme != "sftp" {
        return Err(NetworkError::InvalidValue {
            field: "scheme".to_string(),
            reason: format!("unsupported scheme `{scheme}`"),
        });
    }

    let trimmed_host = host.trim();
    if trimmed_host.is_empty() {
        return Err(NetworkError::InvalidValue {
            field: "host".to_string(),
            reason: "host is required".to_string(),
        });
    }
    if trimmed_host != host
        || host.chars().any(|ch| ch.is_whitespace() || ch.is_control())
    {
        return Err(NetworkError::InvalidValue {
            field: "host".to_string(),
            reason: "host must not contain whitespace or control characters".to_string(),
        });
    }

    if username.trim().is_empty() {
        return Err(NetworkError::InvalidValue {
            field: "username".to_string(),
            reason: "username is required".to_string(),
        });
    }

    if port == 0 {
        return Err(NetworkError::InvalidValue {
            field: "port".to_string(),
            reason: "port must be in range 1..=65535".to_string(),
        });
    }

    Ok(())
}
```

Then update the two callers:

In `add` (line 146):

```rust
        validate_profile_fields(&profile.scheme, &profile.host, &profile.username, profile.port)?;
```

In `update` (line 185):

```rust
        validate_profile_fields(&existing.scheme, &profile.host, &profile.username, profile.port)?;
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
cargo test -p config
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/config/src/network.rs
git commit -m "fix(config): validate port range and reject host with whitespace/controls"
```

---

## Task 3: Preserve real URI in `RemoteError → VfsError` mapping

**Why:** Per review §4c, `crates/remote-core/src/error.rs:47-78` hardcodes `"network profile"` as the URI string. Users see disorienting messages like `authentication failed network profile: missing password`. Carry the real profile ID through, formatted as the URI prefix.

**Files:**

- Modify: `crates/remote-core/src/error.rs`
- Modify: `crates/remote-core/src/session.rs`
- Modify: `crates/provider-sftp/src/connector.rs` (pass URI through)

- [ ] **Step 1: Extend `RemoteError` to carry context**

In `crates/remote-core/src/error.rs`, replace the `AuthenticationFailed`, `ConnectionFailed`, and `NotConnected` variants with:

```rust
    #[error("authentication failed for `{uri}`: {message}")]
    AuthenticationFailed { uri: String, message: String },
    #[error("connection failed for `{uri}`: {message}")]
    ConnectionFailed { uri: String, message: String },
    #[error("connection not established for `{uri}`")]
    NotConnected { uri: String },
```

(`uri` replaces `profile_id` in `NotConnected`.)

Update `From<RemoteError> for VfsError` to use the new field names:

```rust
            RemoteError::AuthenticationFailed { uri, message } => Self::AuthenticationFailed {
                uri,
                message,
            },
            RemoteError::ConnectionFailed { uri, message } => Self::ConnectionLost {
                uri,
                message,
            },
            RemoteError::NotConnected { uri } => Self::ConnectionRequired { uri },
            RemoteError::SecretStore(platform::SecretStoreError::NotFound) => {
                Self::AuthenticationFailed {
                    uri: "sftp://".to_string(),
                    message: "missing stored credentials".to_string(),
                }
            }
```

The `SecretStore::NotFound` arm has no URI context at all — leave it as a coarse `sftp://` for now.

- [ ] **Step 2: Update every constructor in `crates/remote-core/src/session.rs`**

Search the file for the three variants and update the constructors. The substitutions:

- Line ~141 (`mark_error` path for password missing): wrap `RemoteError::AuthenticationFailed { message }` → `RemoteError::AuthenticationFailed { uri: format!("sftp://{profile_id}"), message }`.
- Line ~145 (secret store error path): same substitution.
- Line ~210 (`NotConnected { profile_id }`): change to `NotConnected { uri: format!("sftp://{profile_id}") }`.

In other words, every place that currently constructs one of these variants must thread a URI string. For SFTP that's `format!("sftp://{profile_id}")` — the same shape `ResourceUri::from_remote_profile` would produce, but we don't need the validation overhead here.

- [ ] **Step 3: Update `crates/provider-sftp/src/connector.rs`**

In `crates/provider-sftp/src/connector.rs`, every `RemoteError::ConnectionFailed { message }` and `RemoteError::AuthenticationFailed { message }` constructor needs a URI. The connector doesn't currently know the profile id — pass it through:

Change `connect_blocking` signature:

```rust
    fn connect_blocking(
        profile: &NetworkProfile,
        secrets: &AuthSecrets,
        uri: &str,
    ) -> Result<(Session, Option<String>), RemoteError> {
```

Inside, every `RemoteError::ConnectionFailed { message: ... }` becomes `RemoteError::ConnectionFailed { uri: uri.to_string(), message: ... }` (and likewise for `AuthenticationFailed`).

In the `RemoteConnector::connect` impl, construct the URI before spawning blocking:

```rust
    async fn connect(
        &self,
        profile: &NetworkProfile,
        secrets: &AuthSecrets,
    ) -> Result<Arc<dyn RemoteSession>, RemoteError> {
        let profile = profile.clone();
        let secrets = secrets.clone();
        let uri = format!("sftp://{}", profile.id);
        let (session, fingerprint) =
            tokio::task::spawn_blocking(move || Self::connect_blocking(&profile, &secrets, &uri))
                .await
                .map_err(|error| RemoteError::Internal(error.to_string()))??;
        Ok(Arc::new(SftpSession::with_session(session, fingerprint)))
    }
```

- [ ] **Step 4: Update `SftpSession::ping`**

```rust
    async fn ping(&self) -> Result<(), RemoteError> {
        let session = self.lock_session()?;
        if !session.authenticated() {
            return Err(RemoteError::ConnectionFailed {
                uri: "sftp://".to_string(),
                message: "session is not authenticated".to_string(),
            });
        }
        Ok(())
    }
```

(Ping doesn't have the URI; leaving it generic is acceptable because ping failures route through the session manager, which discards the inner URI.)

- [ ] **Step 5: Run all tests**

```bash
pnpm rust:test
pnpm rust:clippy
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add crates/remote-core/src/error.rs \
        crates/remote-core/src/session.rs \
        crates/provider-sftp/src/connector.rs
git commit -m "fix(remote-core): carry real URI in remote error messages"
```

---

## Stage 2 self-review

- Broken host-key fingerprint (review §4a): replaced with SHA-256 base64 in OpenSSH format, persisted via TOFU.
- Loose validation (§4b): port 0 and whitespace/control-char hostnames now rejected.
- Disorienting error messages (§4c): real URI now propagated through `RemoteError` and into `VfsError`.
- Three commits; Tasks 2 and 3 can be reordered or shipped independently.

**Next stage:** [03-stage-3-reliability.md](03-stage-3-reliability.md)
