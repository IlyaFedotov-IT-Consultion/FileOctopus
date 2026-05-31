# RMT-1: Remote Providers Expansion (SMB + S3)

> Created: 2026-05-25
> Status: In Progress
> Priority: P2

## Overview

Add SMB (CIFS) and S3 protocol support to FileOctopus, following the existing `provider-sftp` pattern: new VFS provider crates + `RemoteConnector`/`RemoteSession` impls + registration in `app-core`.

## Architecture

```
                    ┌─────────────┐
                    │ VfsRegistry │
                    └──────┬──────┘
           ┌───────────────┼───────────────┬──────────────┐
           ▼               ▼               ▼              ▼
    LocalFsProvider  SftpProvider   SmbProvider    S3Provider
           │               │               │              │
           │         ConnectionSessionManager ◄───────────┤
           │               │                              │
           │    RemoteConnectorRegistry                   │
           │    ┌─────┬──────────┬──────────┐             │
           │    │SFTP │   SMB    │    S3    │             │
           │    └─────┴──────────┴──────────┘             │
           │                                              │
    ┌──────┴──────┐   ┌────────────┐  ┌──────────────┐  ┌──────────┐
    │ std::fs     │   │ ssh2 crate │  │ pavao crate  │  │rust-s3   │
    │ (local)     │   │ (SSH/SFTP) │  │ (libsmbclient│  │(S3/HTTP) │
    └─────────────┘   └────────────┘  └──────────────┘  └──────────┘
```

## Task Breakdown

### Task 1: Extend NetworkProfile + AuthKind (config crate)

**Files:** `crates/config/src/network.rs`
**Changes:**

- Add `AuthKind::AccessKey` variant (for S3 access_key_id/secret_access_key)
- Extend `validate_profile_fields` to accept `"smb"` and `"s3"` schemes
- Add `AuthKind::None` variant (for anonymous S3 public buckets)
- Default ports: SMB=445, S3=443
  **TDD:** Test that smb/s3 profiles validate correctly; test AccessKey auth kind

### Task 2: VFS URI Scheme Registration (vfs crate)

**Files:** `crates/vfs/src/lib.rs`
**Changes:**

- Update `REMOTE_SCHEMES` from `&["sftp"]` to `&["sftp", "smb", "s3"]`
- Add `validate_smb_uri_body()` — expects `<uuid>/share/path`
- Add `validate_s3_uri_body()` — expects `<uuid>/bucket/path`
  **TDD:** Test URI parsing for smb:// and s3:// schemes

### Task 3: SMB Provider Crate (provider-smb)

**New crate:** `crates/provider-smb/`
**Dependencies:** `pavao` (libsmbclient FFI)
**Structure (mirrors provider-sftp):**

```
crates/provider-smb/
├── Cargo.toml
├── src/
│   ├── lib.rs       — public exports (SmbConnector, SmbProvider)
│   ├── connector.rs — SmbSession + SmbConnector (RemoteSession + RemoteConnector impls)
│   ├── provider.rs  — SmbProvider (VfsProvider impl)
│   └── ops.rs       — blocking SMB operations via pavao
└── tests/
    └── capabilities.rs
```

**SmbSession:** wraps `pavao::SmbContext` with `Arc<Mutex<>>`
**SmbConnector:** connects via `pavao::SmbContext::new()` with host/port/username/password
**SmbProvider:** implements all VfsProvider methods via `spawn_blocking` + pavao calls
**Key ops:**

- stat: `smb.stat(path)` → FileEntry
- list: `smb.readdir(path)` → Vec<FileEntry>
- create_directory: `smb.mkdir(path)`
- create_file: `smb.create(path)` + close
- rename: `smb.rename(from, to)`
- remove: `smb.unlink(path)` / `smb.rmdir(path)`
- copy_file: read + write chunks
- read_file_prefix: `smb.open(path).read(max_bytes)`

### Task 4: S3 Provider Crate (provider-s3)

**New crate:** `crates/provider-s3/`
**Dependencies:** `rust-s3` or `reqwest` + `aws-sign-v4`
**Structure (mirrors provider-sftp):**

```
crates/provider-s3/
├── Cargo.toml
├── src/
│   ├── lib.rs       — public exports (S3Connector, S3Provider)
│   ├── connector.rs — S3Session + S3Connector (RemoteSession + RemoteConnector impls)
│   ├── provider.rs  — S3Provider (VfsProvider impl)
│   └── ops.rs       — blocking S3 operations
└── tests/
    └── capabilities.rs
```

**S3-specific considerations:**

- S3 has no real directories — directories are zero-byte objects with trailing `/`
- list: uses `list_objects_v2` with prefix and delimiter `/`
- stat: HEAD object, or HEAD prefix for "directory"
- rename: COPY + DELETE (S3 has no native rename)
- copy_file: S3 COPY API (same-region) or GET + PUT (cross-region)
- read_file_prefix: GET with Range header
- URI: `s3://<profile_id>/<bucket>/<key_prefix>`
- S3 profile extra fields: `bucket`, `region`, `endpoint_url`

### Task 5: App-Core Registration

**File:** `crates/app-core/src/lib.rs`
**Changes:**

```rust
// Add to boot():
if network_enabled {
    connector_registry.register(Arc::new(SftpConnector::new()));
    connector_registry.register(Arc::new(SmbConnector::new()));
    connector_registry.register(Arc::new(S3Connector::new()));
}
// ...
if network_enabled {
    vfs.register(Arc::new(SftpProvider::new(sessions.clone())))?;
    vfs.register(Arc::new(SmbProvider::new(sessions.clone())))?;
    vfs.register(Arc::new(S3Provider::new(sessions.clone())))?;
}
```

**Workspace Cargo.toml:** Add `crates/provider-smb` and `crates/provider-s3` to members

### Task 6: TypeScript Types + IPC

**File:** `packages/ts-api/src/types.ts`
**Changes:**

- Add `S3ProfileConfig` type (bucket, region, endpointUrl)
- Extend `NetworkProfileDto` with optional S3 fields

### Task 7: Frontend — Network Profile Dialog

**File:** `packages/frontend/src/components/NetworkProfileDialog.tsx` (or similar)
**Changes:**

- Add scheme dropdown options: SFTP, SMB, S3
- Conditional form fields per scheme:
  - SFTP: host, port (22), username, auth (password/key)
  - SMB: host, port (445), username, auth (password only)
  - S3: endpoint URL, region, bucket, access key ID, secret access key
- Sidebar Network section: show SMB/S3 icons per scheme

## Implementation Order

1. Task 1 (config) — extends profile validation for new schemes
2. Task 2 (vfs) — registers new URI schemes
3. Task 3 (provider-smb) — full SMB provider crate
4. Task 4 (provider-s3) — full S3 provider crate
5. Task 5 (app-core) — wire everything together
6. Task 6 (ts-api) — TypeScript types
7. Task 7 (frontend) — UI for new profile types
8. Health gate verification

## Dependencies

### System

- `libsmbclient` — already installed (`libsmbclient0` on Ubuntu)
- `libclang` — required by `pavao` build (for FFI bindings)

### Rust

- `pavao = "0.2"` — SMB client via libsmbclient FFI
- `rust-s3 = "0.34"` or manual reqwest + AWS sig v4

## Acceptance Criteria

- [ ] `cargo check` clean with both new crates
- [ ] `cargo test` passes for all workspace crates
- [ ] SMB provider: stat, list, create_directory, create_file, rename, remove, copy_file, read_file_prefix
- [ ] S3 provider: stat, list, create_directory, create_file, rename, remove, copy_file, read_file_prefix
- [ ] NetworkProfile validation accepts smb/s3 schemes
- [ ] VFS URI parsing handles smb:// and s3:// URIs
- [ ] Frontend: Add Network Profile dialog shows SMB/S3 options
- [ ] `pnpm typecheck` clean
- [ ] `pnpm test` passes
