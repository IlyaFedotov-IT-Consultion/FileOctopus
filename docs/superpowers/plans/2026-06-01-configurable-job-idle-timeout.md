# Configurable Job Idle-Timeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing job idle-timeout (no-progress watchdog) a live-configurable user preference, surfaced in Settings.

**Architecture:** Add a `operation_idle_timeout_secs` preference (0 = disabled, default 300) plumbed through `config` → `app-ipc` DTO → `ts-api` types → Settings UI. The runtime watchdog reads a shared `Arc<AtomicU64>` each tick so changes apply live via `OperationRuntime::set_idle_timeout`, called from the `set_preference` command and seeded at boot.

**Tech Stack:** Rust (rusqlite, tokio threads), TypeScript/React 19, Tauri IPC.

Spec: `docs/superpowers/specs/2026-06-01-configurable-job-idle-timeout-design.md`.

---

### Task 1: `config` — add the preference field, default, serialization, and validation

**Files:**

- Modify: `crates/config/src/lib.rs` (struct `UserPreferences`, `Default`, `as_rows`, `apply_value`, tests mod)

- [ ] **Step 1: Write failing tests** in the `mod tests` block (after `as_rows_serializes_new_fields`):

```rust
    #[test]
    fn defaults_include_operation_idle_timeout() {
        assert_eq!(UserPreferences::default().operation_idle_timeout_secs, 300);
    }

    #[test]
    fn as_rows_serializes_operation_idle_timeout() {
        let rows: std::collections::HashMap<&str, String> =
            UserPreferences::default().as_rows().into_iter().collect();
        assert_eq!(rows["operationIdleTimeoutSecs"], "300");
    }

    #[test]
    fn round_trips_and_validates_operation_idle_timeout() {
        let dir = tempdir().unwrap();
        let repo = PreferencesRepository::new(dir.path().join("preferences.sqlite")).unwrap();

        assert_eq!(repo.set("operationIdleTimeoutSecs", "60").unwrap().operation_idle_timeout_secs, 60);
        // 0 means "disabled" and is preserved.
        assert_eq!(repo.set("operationIdleTimeoutSecs", "0").unwrap().operation_idle_timeout_secs, 0);
        // Below the floor is clamped up.
        assert_eq!(repo.set("operationIdleTimeoutSecs", "5").unwrap().operation_idle_timeout_secs, 10);
        // Above the ceiling is clamped down.
        assert_eq!(
            repo.set("operationIdleTimeoutSecs", "999999").unwrap().operation_idle_timeout_secs,
            86400
        );
        // Non-numeric is rejected.
        assert!(matches!(
            repo.set("operationIdleTimeoutSecs", "abc").unwrap_err(),
            PreferencesError::InvalidValue { .. }
        ));
    }
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cargo test -p config operation_idle_timeout`
Expected: FAIL — `no field operation_idle_timeout_secs on type UserPreferences`.

- [ ] **Step 3: Add the struct field** next to `network_connection_timeout` in `pub struct UserPreferences` (around `crates/config/src/lib.rs:81`):

```rust
    pub operation_idle_timeout_secs: u32,
```

- [ ] **Step 4: Add the default** next to `network_connection_timeout: 30,` in the `Default for UserPreferences` impl (around `:148`):

```rust
            operation_idle_timeout_secs: 300,
```

- [ ] **Step 5: Add the serialization row** in `as_rows`, next to the `networkConnectionTimeout` entry (around `:682`):

```rust
            (
                "operationIdleTimeoutSecs",
                self.operation_idle_timeout_secs.to_string(),
            ),
```

- [ ] **Step 6: Add the `apply_value` match arm** next to the `"networkConnectionTimeout"` arm (around `:871`). 0 = disabled; otherwise clamp to `[10, 86400]`:

```rust
        "operationIdleTimeoutSecs" => {
            let secs = value
                .parse::<u32>()
                .map_err(|error| invalid_value(key, error.to_string()))?;
            preferences.operation_idle_timeout_secs =
                if secs == 0 { 0 } else { secs.clamp(10, 86400) };
        }
```

- [ ] **Step 7: Run tests, verify they pass**

Run: `cargo test -p config operation_idle_timeout`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add crates/config/src/lib.rs
git commit -m "feat(config): add operation_idle_timeout_secs preference"
```

---

### Task 2: `config` — schema migration v14 backfills the default

**Files:**

- Modify: `crates/config/src/lib.rs` (`SCHEMA_VERSION`, `migrate`, new `backfill_v14_keys`, tests mod)

- [ ] **Step 1: Write the failing migration test** in `mod tests`:

```rust
    #[test]
    fn migrates_v13_database_to_current_schema_with_idle_timeout_default() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("preferences.sqlite");
        {
            let connection = Connection::open(&path).unwrap();
            connection
                .execute(
                    "create table if not exists preferences (
                        key text primary key,
                        value text not null,
                        updated_at text not null
                    )",
                    [],
                )
                .unwrap();
            connection
                .execute(
                    "insert into preferences (key, value, updated_at) values
                        ('theme', 'dark', '0')",
                    [],
                )
                .unwrap();
            connection.pragma_update(None, "user_version", 13u32).unwrap();
        }

        let repo = PreferencesRepository::new(path.clone()).unwrap();
        let prefs = repo.get_all().unwrap();
        assert_eq!(prefs.theme, "dark");
        assert_eq!(prefs.operation_idle_timeout_secs, 300);

        let connection = Connection::open(&path).unwrap();
        let version: u32 = connection
            .query_row("pragma user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);
    }
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cargo test -p config migrates_v13_database`
Expected: FAIL — `operation_idle_timeout_secs` is `300` only if migrated, but `SCHEMA_VERSION` is still 13 so the v14 backfill never runs / assertion on the value or version fails.

- [ ] **Step 3: Bump the schema version** (around `crates/config/src/lib.rs:19`):

```rust
pub const SCHEMA_VERSION: u32 = 14;
```

- [ ] **Step 4: Add the migration step** after the `if user_version < 13 { ... }` block in `migrate`:

```rust
        if user_version < 14 {
            self.backfill_v14_keys(&connection)?;
            connection.pragma_update(None, "user_version", SCHEMA_VERSION)?;
        }
```

- [ ] **Step 5: Add `backfill_v14_keys`** next to `backfill_v13_keys`:

```rust
    fn backfill_v14_keys(&self, connection: &Connection) -> Result<(), PreferencesError> {
        let defaults = UserPreferences::default();
        let now = chrono_lite_now();
        let rows = [(
            "operationIdleTimeoutSecs",
            defaults.operation_idle_timeout_secs.to_string(),
        )];

        for (key, value) in rows {
            connection.execute(
                "insert into preferences (key, value, updated_at) values (?1, ?2, ?3)
                 on conflict(key) do nothing",
                params![key, value, now],
            )?;
        }

        Ok(())
    }
```

- [ ] **Step 6: Run tests, verify pass** (and confirm no other migration test broke)

Run: `cargo test -p config`
Expected: PASS (all config tests, including the existing `migrates_v*` ones, which assert `version == SCHEMA_VERSION` and still hold at 14).

- [ ] **Step 7: Commit**

```bash
git add crates/config/src/lib.rs
git commit -m "feat(config): migrate schema v14 backfilling operationIdleTimeoutSecs"
```

---

### Task 3: `app-ipc` — mirror the field in the DTO + conversion

**Files:**

- Modify: `crates/app-ipc/src/preferences.rs` (`UserPreferencesDto`)
- Modify: `crates/app-ipc/src/lib.rs` (`impl From<config::UserPreferences> for UserPreferencesDto`)

- [ ] **Step 1: Write the failing test** at the bottom of `crates/app-ipc/src/lib.rs` `mod tests` (or create one if absent — there is a `#[cfg(test)] mod tests` near the file end):

```rust
    #[test]
    fn user_preferences_dto_maps_operation_idle_timeout() {
        let mut prefs = config::UserPreferences::default();
        prefs.operation_idle_timeout_secs = 120;
        let dto = UserPreferencesDto::from(prefs);
        assert_eq!(dto.operation_idle_timeout_secs, 120);

        let json = serde_json::to_string(&dto).unwrap();
        assert!(json.contains("\"operationIdleTimeoutSecs\":120"));
    }
```

- [ ] **Step 2: Run test, verify it fails**

Run: `cargo test -p app-ipc user_preferences_dto_maps_operation_idle_timeout`
Expected: FAIL — `no field operation_idle_timeout_secs on UserPreferencesDto`.

- [ ] **Step 3: Add the DTO field** next to `network_connection_timeout: u32,` in `crates/app-ipc/src/preferences.rs` (around `:61`):

```rust
    pub operation_idle_timeout_secs: u32,
```

- [ ] **Step 4: Add the conversion mapping** next to `network_connection_timeout: value.network_connection_timeout,` in `crates/app-ipc/src/lib.rs` (around `:337`):

```rust
            operation_idle_timeout_secs: value.operation_idle_timeout_secs,
```

- [ ] **Step 5: Run test, verify it passes**

Run: `cargo test -p app-ipc user_preferences_dto_maps_operation_idle_timeout`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add crates/app-ipc/src/preferences.rs crates/app-ipc/src/lib.rs
git commit -m "feat(app-ipc): mirror operationIdleTimeoutSecs in UserPreferencesDto"
```

---

### Task 4: `app-core` runtime — live-updatable watchdog + `set_idle_timeout`

**Files:**

- Modify: `crates/app-core/src/runtime.rs` (imports, `OperationRuntime` struct + `with_settings`, `set_idle_timeout`, `watchdog_loop`)
- Modify: `crates/app-core/src/tests.rs` (new tests)

- [ ] **Step 1: Write failing tests** in `crates/app-core/src/tests.rs` (after `job_exceeding_idle_timeout_fails_with_timeout`):

```rust
#[test]
fn set_idle_timeout_enables_watchdog_live() {
    let dir = tempfile::tempdir().unwrap();
    let runtime = OperationRuntime::with_settings(
        local_vfs(),
        OperationHistoryRepository::new(dir.path().join("history.sqlite")).unwrap(),
        RuntimeSettings { worker_count: 2, idle_timeout: None },
    );
    // Watchdog starts disabled; enable it live with a short interval.
    runtime.set_idle_timeout(Some(Duration::from_millis(150)));

    let (sender, receiver) = mpsc::channel();
    runtime
        .start_with_executor(
            noop_plan(),
            Arc::new(move |event| {
                let _ = sender.send(event);
            }),
            move |_vfs, _plan, job, cancel, _pause, _progress| {
                for _ in 0..200 {
                    if cancel.is_cancelled() {
                        return Err(vfs::FileOperationError::Cancelled {
                            job_id: Some(job.as_str().to_string()),
                        });
                    }
                    std::thread::sleep(Duration::from_millis(20));
                }
                Ok(())
            },
        )
        .unwrap();

    let terminal = loop {
        let event = receiver.recv_timeout(Duration::from_secs(5)).unwrap();
        if matches!(event, JobEvent::Failed(_) | JobEvent::Completed(_) | JobEvent::Cancelled(_)) {
            break event;
        }
    };
    match terminal {
        JobEvent::Failed(failed) => assert_eq!(failed.error_code, "timeout"),
        other => panic!("expected Failed(timeout) after live enable, got {other:?}"),
    }
}

#[test]
fn set_idle_timeout_none_disables_watchdog_live() {
    let dir = tempfile::tempdir().unwrap();
    let runtime = OperationRuntime::with_settings(
        local_vfs(),
        OperationHistoryRepository::new(dir.path().join("history.sqlite")).unwrap(),
        RuntimeSettings { worker_count: 2, idle_timeout: Some(Duration::from_millis(150)) },
    );
    // Disable the watchdog live before running a no-progress job.
    runtime.set_idle_timeout(None);

    let (sender, receiver) = mpsc::channel();
    runtime
        .start_with_executor(
            noop_plan(),
            Arc::new(move |event| {
                let _ = sender.send(event);
            }),
            move |_vfs, _plan, _job, _cancel, _pause, _progress| {
                // No progress for ~400ms; would time out at 150ms if still enabled.
                std::thread::sleep(Duration::from_millis(400));
                Ok(())
            },
        )
        .unwrap();

    let terminal = loop {
        let event = receiver.recv_timeout(Duration::from_secs(5)).unwrap();
        if matches!(event, JobEvent::Failed(_) | JobEvent::Completed(_) | JobEvent::Cancelled(_)) {
            break event;
        }
    };
    assert!(
        matches!(terminal, JobEvent::Completed(_)),
        "watchdog disabled live: job should complete, got {terminal:?}"
    );
}
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cargo test -p app-core set_idle_timeout`
Expected: FAIL — `no method set_idle_timeout on OperationRuntime`.

- [ ] **Step 3: Update atomic imports** at the top of `crates/app-core/src/runtime.rs` — change the existing `use std::sync::atomic::{AtomicBool, Ordering};` to:

```rust
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
```

- [ ] **Step 4: Add the shared field** to `struct OperationRuntime` (after `dispatch`):

```rust
    idle_timeout_ms: Arc<AtomicU64>,
```

- [ ] **Step 5: Update `with_settings`** — replace the conditional watchdog spawn block:

```rust
        let jobs = Arc::new(Mutex::new(HashMap::new()));
        if let Some(idle_timeout) = settings.idle_timeout {
            let jobs = jobs.clone();
            std::thread::spawn(move || watchdog_loop(jobs, idle_timeout));
        }
```

with an always-on watchdog seeded from settings (0 = disabled):

```rust
        let jobs = Arc::new(Mutex::new(HashMap::new()));
        let idle_timeout_ms = Arc::new(AtomicU64::new(
            settings
                .idle_timeout
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
        ));
        {
            let jobs = jobs.clone();
            let idle_timeout_ms = idle_timeout_ms.clone();
            std::thread::spawn(move || watchdog_loop(jobs, idle_timeout_ms));
        }
```

and add `idle_timeout_ms,` to the `Self { ... }` constructor at the end of `with_settings`.

- [ ] **Step 6: Add the setter** as a public method on `impl OperationRuntime` (near `cancel`):

```rust
    /// Live-update the no-progress watchdog timeout. `None` (or a zero duration)
    /// disables it; the running watchdog picks up the change on its next tick.
    pub fn set_idle_timeout(&self, timeout: Option<Duration>) {
        let ms = timeout.map(|d| d.as_millis() as u64).unwrap_or(0);
        self.idle_timeout_ms.store(ms, Ordering::SeqCst);
    }
```

- [ ] **Step 7: Rewrite `watchdog_loop`** to read the atomic each tick:

```rust
fn watchdog_loop(jobs: Arc<Mutex<HashMap<String, JobRuntimeState>>>, idle_timeout_ms: Arc<AtomicU64>) {
    loop {
        let current_ms = idle_timeout_ms.load(Ordering::SeqCst);
        let poll = if current_ms == 0 {
            Duration::from_secs(5)
        } else {
            (Duration::from_millis(current_ms) / 4)
                .clamp(Duration::from_millis(10), Duration::from_secs(5))
        };
        std::thread::sleep(poll);

        // Only the watchdog still references the job table: the runtime has been
        // dropped, so stop polling and let this thread exit.
        if Arc::strong_count(&jobs) == 1 {
            break;
        }

        let current_ms = idle_timeout_ms.load(Ordering::SeqCst);
        if current_ms == 0 {
            continue; // disabled
        }
        let idle_timeout = Duration::from_millis(current_ms);

        let now = Utc::now();
        let Ok(jobs) = jobs.lock() else {
            break;
        };
        for state in jobs.values() {
            if state.snapshot.status != JobStatus::Running || state.timed_out.load(Ordering::SeqCst)
            {
                continue;
            }
            let idle = now.signed_duration_since(state.snapshot.updated_at);
            let exceeded = idle.to_std().map(|idle| idle >= idle_timeout).unwrap_or(false);
            if exceeded {
                state.timed_out.store(true, Ordering::SeqCst);
                state.cancel.cancel();
                telemetry::info(&format!(
                    "operation job watchdog timeout job_id={}",
                    state.snapshot.job_id.as_str()
                ));
            }
        }
    }
}
```

- [ ] **Step 8: Run tests, verify they pass** (including the pre-existing timeout test)

Run: `cargo test -p app-core`
Expected: PASS — `set_idle_timeout_enables_watchdog_live`, `set_idle_timeout_none_disables_watchdog_live`, `job_exceeding_idle_timeout_fails_with_timeout`, `concurrency_is_bounded_by_worker_count` all green.

- [ ] **Step 9: Commit**

```bash
git add crates/app-core/src/runtime.rs crates/app-core/src/tests.rs
git commit -m "feat(app-core): live-updatable idle-timeout watchdog + set_idle_timeout"
```

---

### Task 5: `app-core` boot — seed the runtime from the stored preference

**Files:**

- Modify: `crates/app-core/src/lib.rs` (`boot_with_paths`, imports)

- [ ] **Step 1: Add imports** at the top of `crates/app-core/src/lib.rs` if not present:

```rust
use std::time::Duration;
use crate::runtime::RuntimeSettings;
```

- [ ] **Step 2: Reorder boot to build preferences before the runtime and seed the timeout.** Replace (around `crates/app-core/src/lib.rs:264-266`):

```rust
        let vfs_filesystem = VfsFilesystem::with_sessions(sessions.clone(), vfs.clone());
        let operations = Arc::new(OperationRuntime::new(vfs_filesystem, history));
        let preferences = PreferencesRepository::new(paths.preferences_db.clone())
            .map_err(|error| AppCoreError::History(error.to_string()))?;
```

with:

```rust
        let preferences = PreferencesRepository::new(paths.preferences_db.clone())
            .map_err(|error| AppCoreError::History(error.to_string()))?;
        let idle_secs = preferences
            .get_all()
            .map(|prefs| prefs.operation_idle_timeout_secs)
            .unwrap_or(300);
        let runtime_settings = RuntimeSettings {
            idle_timeout: (idle_secs > 0).then(|| Duration::from_secs(u64::from(idle_secs))),
            ..RuntimeSettings::default()
        };
        let vfs_filesystem = VfsFilesystem::with_sessions(sessions.clone(), vfs.clone());
        let operations =
            Arc::new(OperationRuntime::with_settings(vfs_filesystem, history, runtime_settings));
```

- [ ] **Step 3: Verify it compiles**

Run: `cargo check -p app-core`
Expected: PASS (no errors; `RuntimeSettings`/`Duration` resolved).

- [ ] **Step 4: Commit**

```bash
git add crates/app-core/src/lib.rs
git commit -m "feat(app-core): seed runtime idle-timeout from stored preference at boot"
```

---

### Task 6: Tauri command — apply the preference change live

**Files:**

- Modify: `apps/desktop-tauri/src-tauri/src/commands/preferences.rs`

- [ ] **Step 1: Add the live-apply hook** in `set_preference`. Replace the body after the `set(...)` call:

```rust
    let preferences = state
        .preferences()
        .set(&request.key, &request.value)
        .map_err(|error| IpcError::preferences_error(error.to_string()))?;

    if request.key == "operationIdleTimeoutSecs" {
        let secs = preferences.operation_idle_timeout_secs;
        state.operations().set_idle_timeout(
            (secs > 0).then(|| std::time::Duration::from_secs(u64::from(secs))),
        );
    }

    Ok(SetPreferenceResponse {
        preferences: UserPreferencesDto::from(preferences),
    })
```

- [ ] **Step 2: Verify it compiles**

Run: `cargo check -p fileoctopus-desktop`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop-tauri/src-tauri/src/commands/preferences.rs
git commit -m "feat(tauri): apply operationIdleTimeoutSecs change to runtime live"
```

---

### Task 7: `ts-api` — add the field to the TS DTO

**Files:**

- Modify: `packages/ts-api/src/types.ts` (`interface UserPreferencesDto`)
- Modify: `packages/ts-api/src/transports/preview.ts` (the default-preferences literal)

> `operationIdleTimeoutSecs` is a **required** field, so every `UserPreferencesDto` object literal in
> the repo must add it or `tsc` will error. This task fixes the two literals in the `ts-api` package;
> Task 8 fixes the frontend ones.

- [ ] **Step 1: Add the field** next to `networkConnectionTimeout: number;` (around `packages/ts-api/src/types.ts:414`):

```ts
operationIdleTimeoutSecs: number;
```

- [ ] **Step 2: Update the preview transport's default preferences** in `packages/ts-api/src/transports/preview.ts` — add next to its `networkConnectionTimeout` entry:

```ts
    operationIdleTimeoutSecs: 300,
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @fileoctopus/ts-api typecheck`
Expected: PASS (if it still errors on a missing field, add `operationIdleTimeoutSecs: 300` to the literal the error points at).

- [ ] **Step 4: Commit**

```bash
git add packages/ts-api/src/types.ts packages/ts-api/src/transports/preview.ts
git commit -m "feat(ts-api): add operationIdleTimeoutSecs to UserPreferencesDto"
```

---

### Task 8: Frontend — Settings control in `SettingsOperations` + fix DTO literals

**Files:**

- Modify: `packages/frontend/src/components/settings/SettingsOperations.tsx`
- Modify: `packages/frontend/src/components/fallbackPreferences.ts` (FALLBACK_PREFERENCES literal)
- Modify: `packages/frontend/tests/settingsOperations.test.tsx` (add import + test + fixture field)
- Modify (fixture field only): `packages/frontend/tests/settingsViewer.test.tsx`, `settingsPolish.test.tsx`, `settingsEditor.test.tsx`, `settingsNetwork.test.tsx`, `chromeStore.test.ts`

- [ ] **Step 1: Add the required field to every frontend `UserPreferencesDto` literal.** In each file below, add `operationIdleTimeoutSecs: 300,` next to the existing `networkConnectionTimeout` entry:
  - `packages/frontend/src/components/fallbackPreferences.ts`
  - `packages/frontend/tests/settingsOperations.test.tsx` (the `basePreferences` fixture)
  - `packages/frontend/tests/settingsViewer.test.tsx`
  - `packages/frontend/tests/settingsPolish.test.tsx`
  - `packages/frontend/tests/settingsEditor.test.tsx`
  - `packages/frontend/tests/settingsNetwork.test.tsx`
  - `packages/frontend/tests/chromeStore.test.ts`

  (Run `pnpm --filter @fileoctopus/frontend typecheck` and add the field to any other literal the compiler flags.)

- [ ] **Step 2: Write the failing test.** In `packages/frontend/tests/settingsOperations.test.tsx`, add an import for the component and a test that renders it directly (the file currently renders `SettingsDialog`; importing `SettingsOperations` directly keeps the new test self-contained):

```tsx
import { SettingsOperations } from "../src/components/settings/SettingsOperations";
```

```tsx
it("updates the operation idle timeout", () => {
  const onChange = vi.fn();
  render(
    <SettingsOperations preferences={basePreferences} onChange={onChange} />,
  );
  const input = screen.getByLabelText(/inactivity timeout/i);
  fireEvent.change(input, { target: { value: "120" } });
  expect(onChange).toHaveBeenCalledWith("operationIdleTimeoutSecs", "120");
});
```

- [ ] **Step 2b: Run test, verify it fails**

Run: `pnpm --filter @fileoctopus/frontend test -- settingsOperations`
Expected: FAIL — no element with label "inactivity timeout".

- [ ] **Step 3: Add the control** inside the returned `<section>` of `SettingsOperations` (after the existing fields), using the `{ preferences, onChange }` props:

```tsx
      <label className="fo-settings-checkbox">
        <input
          type="checkbox"
          checked={preferences.operationIdleTimeoutSecs > 0}
          onChange={(event) =>
            onChange(
              "operationIdleTimeoutSecs",
              event.target.checked ? "300" : "0",
            )
          }
        />
        <span>Cancel operations stalled with no progress</span>
      </label>
      <label className="fo-settings-field">
        <span>Inactivity timeout (seconds)</span>
        <input
          type="number"
          min={10}
          max={86400}
          value={preferences.operationIdleTimeoutSecs}
          disabled={preferences.operationIdleTimeoutSecs === 0}
          onChange={(event) =>
            onChange("operationIdleTimeoutSecs", event.target.value)
          }
        />
      </label>
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm --filter @fileoctopus/frontend test -- settingsOperations`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/components/settings/SettingsOperations.tsx packages/frontend/tests/settingsOperations.test.tsx
git commit -m "feat(frontend): SettingsOperations control for idle-timeout preference"
```

---

### Task 9: Full verification

- [ ] **Step 1: Rust gates**

```bash
pnpm rust:check && pnpm rust:test && pnpm rust:clippy && pnpm rust:fmt
```

Expected: all PASS.

- [ ] **Step 2: JS gates**

```bash
pnpm --filter @fileoctopus/ts-api typecheck
pnpm --filter @fileoctopus/frontend typecheck
pnpm --filter @fileoctopus/frontend test
pnpm lint
```

Expected: all PASS (full vitest suite green).

- [ ] **Step 3: Update the architecture review doc** — in `docs/architecture/review-2026-05.md`, change the "No job timeout/deadline" gap line to note the idle timeout exists and is now user-configurable.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/review-2026-05.md
git commit -m "docs: note job idle-timeout is now configurable"
```

---

## Notes for the implementer

- The serialization function is `UserPreferences::as_rows()`; loading reuses `apply_value` over stored rows, so adding the `as_rows` entry + the `apply_value` arm is sufficient for round-tripping.
- The existing `migrates_v*` tests assert `version == SCHEMA_VERSION`; bumping to 14 keeps them valid because migrations run to the latest version.
- `set_idle_timeout` takes `Option<Duration>` (refines the spec's `Option<u32>`) so it is unit-testable at millisecond precision; the command handler and boot convert whole seconds to `Duration`.
- The watchdog is now spawned unconditionally; the `Arc::strong_count(&jobs) == 1` exit condition still terminates it when the runtime is dropped.
