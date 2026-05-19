# Stage 5 — UX polish

> **Parent plan:** [00-overview.md](00-overview.md)
> **Prerequisites:** [Stage 2](02-stage-2-security-hardening.md) (Task 2 displays the persisted fingerprint), [Stage 4](04-stage-4-observability.md) (Tasks 3 and 4 consume status events)
> **Unblocks:** [Stage 6](06-stage-6-test-coverage-and-docs.md)

**Goal:** Make the read-only SFTP experience feel polished and safe. Confirm before destructive actions, surface the host-key fingerprint, badge profiles with auth/connection state, and show busy state during explicit connect.

**Why this stage ships on its own:** Four small UI tasks. Each is reviewable in isolation; users will notice each improvement independently.

---

## Tasks

1. [Remove-server confirmation dialog](#task-1-remove-server-confirmation-dialog)
2. [Host-key fingerprint UI in ConnectServerDialog](#task-2-host-key-fingerprint-ui-in-connectserverdialog)
3. [Sidebar auth-state indicator](#task-3-sidebar-auth-state-indicator)
4. [Visual loading indicator while connecting](#task-4-visual-loading-indicator-while-connecting)

---

## Task 1: Remove-server confirmation dialog

**Why:** Per review §5d, clicking "Remove" in `NetworkLocationsDialog.tsx:193-197` immediately deletes the profile + keychain entries with no prompt. Add a confirmation dialog that mirrors `ClearRecentLocationsDialog.tsx`.

**Files:**

- Create: `packages/frontend/src/components/dialogs/RemoveServerDialog.tsx`
- Modify: `packages/frontend/src/app/providers/ModalsProvider.tsx`
- Modify: `packages/frontend/src/components/DialogOverlayGroup.tsx`
- Modify: `packages/frontend/src/components/dialogs/NetworkLocationsDialog.tsx`
- Modify: `packages/frontend/src/sidebar/Sidebar.tsx` (route context-menu Remove through dialog)
- Modify: `packages/frontend/src/shell/PaneWorkspace.tsx` (or wherever `onDeleteProfile` is bound)
- Test: `packages/frontend/tests/removeServerDialog.test.tsx` (create)

- [ ] **Step 1: Create the dialog component**

Create `packages/frontend/src/components/dialogs/RemoveServerDialog.tsx`:

```tsx
import { useRef } from "react";
import { Button } from "@fileoctopus/ui";
import type { NetworkProfileDto } from "@fileoctopus/ts-api";
import { useDialogEscape } from "../../hooks/useDialogEscape";
import { useFocusTrap } from "../../hooks/useFocusTrap";

interface RemoveServerDialogProps {
  open: boolean;
  profile: NetworkProfileDto | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function RemoveServerDialog({
  open,
  profile,
  onClose,
  onConfirm,
}: RemoveServerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogEscape(open, onClose);
  useFocusTrap(dialogRef, open);

  if (!open || !profile) {
    return null;
  }

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        ref={dialogRef}
        open
        role="dialog"
        className="fo-dialog fo-remove-server-dialog"
        aria-labelledby="remove-server-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <h2 id="remove-server-title">Remove Server</h2>
        </header>
        <div className="fo-dialog-body">
          <p>
            Remove <strong>{profile.label}</strong> (
            <code>
              {profile.username}@{profile.host}:{profile.port}
            </code>
            )?
          </p>
          <p>
            Saved credentials in the keychain will also be deleted. Folders on
            the remote server are not affected.
          </p>
        </div>
        <footer className="fo-dialog-footer">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Remove Server
          </Button>
        </footer>
      </dialog>
    </div>
  );
}
```

- [ ] **Step 2: Add modal state**

In `packages/frontend/src/app/providers/ModalsProvider.tsx`, add to the state shape (around line 78-85 where existing state is declared):

```ts
const [removeServerProfile, setRemoveServerProfile] =
  useState<NetworkProfileDto | null>(null);
```

Expose in the context value (search for `networkLocationsOpen` and add `removeServerProfile`, `setRemoveServerProfile` next to it).

- [ ] **Step 3: Wire into `DialogOverlayGroup`**

In `packages/frontend/src/components/DialogOverlayGroup.tsx`, add to the props interface (near `connectServerProfile`):

```ts
removeServerProfile: NetworkProfileDto | null;
setRemoveServerProfile: (profile: NetworkProfileDto | null) => void;
```

Import the new dialog:

```ts
import { RemoveServerDialog } from "./dialogs/RemoveServerDialog";
```

In the `NetworkLocationsDialog` props, change `onDeleteServer` to open the confirmation dialog instead of calling `deleteProfile` directly:

```tsx
        onDeleteServer={(profileId) => {
          const profile = networkProfiles.find((item) => item.id === profileId);
          if (profile) {
            setRemoveServerProfile(profile);
          }
        }}
```

Add the dialog at the bottom of the returned fragment, next to `<ConnectServerDialog />`:

```tsx
<RemoveServerDialog
  open={removeServerProfile !== null}
  profile={removeServerProfile}
  onClose={() => setRemoveServerProfile(null)}
  onConfirm={() => {
    if (removeServerProfile) {
      void deleteProfile(removeServerProfile.id);
    }
  }}
/>
```

- [ ] **Step 4: Adjust `onDeleteServer` callback signature**

`NetworkLocationsDialog.tsx:21` currently types `onDeleteServer: (profileId: string) => Promise<void>` because the old call was async. Change it to:

```ts
onDeleteServer: (profileId: string) => void;
```

And the corresponding button at line 191-197:

```tsx
<Button
  type="button"
  size="sm"
  variant="ghost"
  onClick={() => onDeleteServer(profile.id)}
>
  Remove
</Button>
```

- [ ] **Step 5: Wire same flow from Sidebar context menu**

In `packages/frontend/src/sidebar/Sidebar.tsx:295`, the existing `onRemove={() => onDeleteProfile(networkContextMenu.profile.id)}` remains, but the underlying `onDeleteProfile` handler must now route through `setRemoveServerProfile` instead of calling `deleteProfile` directly.

Search for where `onDeleteProfile` is plumbed (likely `PaneWorkspace.tsx`) and change the implementation to:

```tsx
onDeleteProfile={(profileId) => {
  const profile = networkProfiles.find((item) => item.id === profileId);
  if (profile) {
    setRemoveServerProfile(profile);
  }
}}
```

- [ ] **Step 6: Write a test**

Create `packages/frontend/tests/removeServerDialog.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RemoveServerDialog } from "../src/components/dialogs/RemoveServerDialog";
import type { NetworkProfileDto } from "@fileoctopus/ts-api";

const profile: NetworkProfileDto = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  label: "Production",
  scheme: "sftp",
  host: "prod.example.com",
  port: 22,
  username: "deploy",
  authKind: "password",
  privateKeyPath: null,
  defaultPath: "/var/www",
  defaultUri: "sftp://550e8400-e29b-41d4-a716-446655440000/var/www",
  hostKeyFingerprint: null,
  sortOrder: 0,
  lastConnectedAt: null,
  lastError: null,
  hasStoredSecret: true,
  createdAt: "2026-05-19T00:00:00Z",
  updatedAt: "2026-05-19T00:00:00Z",
};

describe("RemoveServerDialog", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <RemoveServerDialog
        open={false}
        profile={profile}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows profile identity and confirm/cancel buttons", () => {
    render(
      <RemoveServerDialog
        open
        profile={profile}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("Production")).toBeInTheDocument();
    expect(screen.getByText("deploy@prod.example.com:22")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove Server" }),
    ).toBeInTheDocument();
  });

  it("invokes onConfirm and onClose when confirm is clicked", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <RemoveServerDialog
        open
        profile={profile}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove Server" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onClose but not onConfirm when cancel is clicked", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <RemoveServerDialog
        open
        profile={profile}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 7: Run frontend tests**

```bash
pnpm --filter @fileoctopus/frontend test -- removeServerDialog
pnpm --filter @fileoctopus/frontend typecheck
pnpm --filter @fileoctopus/frontend lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/frontend/src/components/dialogs/RemoveServerDialog.tsx \
        packages/frontend/src/app/providers/ModalsProvider.tsx \
        packages/frontend/src/components/DialogOverlayGroup.tsx \
        packages/frontend/src/components/dialogs/NetworkLocationsDialog.tsx \
        packages/frontend/src/sidebar/Sidebar.tsx \
        packages/frontend/src/shell/PaneWorkspace.tsx \
        packages/frontend/tests/removeServerDialog.test.tsx
git commit -m "feat(frontend): confirm before removing a network profile"
```

---

## Task 2: Host-key fingerprint UI in ConnectServerDialog

**Why:** Per review §5e, the fingerprint column already exists in the DTO (`NetworkProfileDto.hostKeyFingerprint`) but no UI surfaces it. After Stage 2 Task 1 the value is meaningful (`SHA256:…`). Show it read-only on edit and provide a "Forget pinned fingerprint" action that clears it (next connect will re-pin).

**Files:**

- Modify: `crates/config/src/network.rs` (new `clear_host_key_fingerprint` method)
- Modify: `apps/desktop-tauri/src-tauri/src/commands/network.rs` (new command)
- Modify: `apps/desktop-tauri/src-tauri/src/lib.rs` (register command)
- Modify: `packages/ts-api/src/clients/network.ts` (call)
- Modify: `packages/ts-api/src/commandMap.ts` (mapping)
- Modify: `packages/frontend/src/components/dialogs/ConnectServerDialog.tsx`
- Modify: `packages/frontend/src/hooks/useNetworkHandlers.ts` (add `forgetFingerprint`)
- Modify: `packages/frontend/src/components/DialogOverlayGroup.tsx` (plumb through)

- [ ] **Step 1: Implement repository method**

In `crates/config/src/network.rs`, after `set_host_key_fingerprint` (around line 270), add:

```rust
    pub fn clear_host_key_fingerprint(&self, id: &str) -> Result<(), NetworkError> {
        let connection = self.connect()?;
        let now = Utc::now().to_rfc3339();
        let updated = connection.execute(
            "update network_profiles
             set host_key_fingerprint = null, updated_at = ?2
             where id = ?1",
            params![id, now],
        )?;
        if updated == 0 {
            return Err(NetworkError::ProfileNotFound);
        }
        Ok(())
    }
```

Add a regression test in the same file's `#[cfg(test)] mod tests`:

```rust
    #[test]
    fn clears_host_key_fingerprint() {
        let dir = tempdir().unwrap();
        let repository = NetworkProfileRepository::new(dir.path().join("network.sqlite")).unwrap();
        let created = repository.add(sample_profile()).unwrap();
        repository
            .set_host_key_fingerprint(&created.id, "SHA256:abc")
            .unwrap();
        assert_eq!(
            repository.get(&created.id).unwrap().host_key_fingerprint.as_deref(),
            Some("SHA256:abc"),
        );

        repository.clear_host_key_fingerprint(&created.id).unwrap();
        assert_eq!(
            repository.get(&created.id).unwrap().host_key_fingerprint,
            None,
        );
    }
```

- [ ] **Step 2: Add backend command**

In `apps/desktop-tauri/src-tauri/src/commands/network.rs`, append:

```rust
#[tauri::command]
pub fn network_profile_forget_fingerprint(
    request: NetworkProfileActionRequest,
    state: State<'_, Arc<AppState>>,
) -> Result<OkResponse, IpcError> {
    state
        .network()
        .clear_host_key_fingerprint(&request.id)
        .map_err(network_error)?;
    Ok(OkResponse { ok: true })
}
```

- [ ] **Step 3: Register the command**

In `apps/desktop-tauri/src-tauri/src/lib.rs`, add to the `tauri::generate_handler![...]` list (around line 60-68 where other network commands live):

```rust
            commands::network::network_profile_forget_fingerprint,
```

- [ ] **Step 4: Wire through ts-api**

In `packages/ts-api/src/commandMap.ts`, add an entry:

```ts
  "network.profileForgetFingerprint": "network_profile_forget_fingerprint",
```

In `packages/ts-api/src/clients/network.ts`, add to `NetworkClient`:

```ts
  async forgetFingerprint(
    request: NetworkProfileActionRequest,
  ): Promise<OkResponse> {
    try {
      return await this.transport.invoke("network.profileForgetFingerprint", {
        request,
      });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }
```

- [ ] **Step 5: Surface in the dialog**

In `packages/frontend/src/components/dialogs/ConnectServerDialog.tsx`, add to the props interface (line 7-23):

```ts
  onForgetFingerprint?: (profileId: string) => Promise<void>;
```

Add a fingerprint section to the form body. Before the closing `</div>` of `<div className="fo-dialog-body fo-connect-server-form">` (around line 262), insert:

```tsx
{
  editingProfile?.hostKeyFingerprint ? (
    <div className="fo-dialog-field fo-dialog-field-static">
      <span>Pinned host key</span>
      <code
        className="fo-fingerprint-display"
        title={editingProfile.hostKeyFingerprint}
      >
        {editingProfile.hostKeyFingerprint}
      </code>
      {onForgetFingerprint ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (editingProfile?.id) {
              void onForgetFingerprint(editingProfile.id);
            }
          }}
        >
          Forget pinned fingerprint
        </Button>
      ) : null}
      <span className="fo-settings-hint">
        The next successful connect will pin the server's current fingerprint.
      </span>
    </div>
  ) : editingProfile ? (
    <p className="fo-settings-hint">
      No host key pinned yet. The fingerprint shown by the server on the next
      connect will be remembered.
    </p>
  ) : null;
}
```

- [ ] **Step 6: Pass `onForgetFingerprint` through**

In `packages/frontend/src/components/DialogOverlayGroup.tsx`, plumb `forgetFingerprint` from `useNetworkHandlers` to `ConnectServerDialog`. Add to the props interface and pass through.

In `packages/frontend/src/hooks/useNetworkHandlers.ts`, add:

```ts
const forgetFingerprint = useCallback(
  async (profileId: string) => {
    setOperationError(null);
    try {
      await client.network.forgetFingerprint({ id: profileId });
      await refreshNetworkProfiles();
    } catch (error) {
      setOperationError(normalizeIpcError(error).message);
      throw error;
    }
  },
  [client, refreshNetworkProfiles, setOperationError],
);
```

And include it in the returned object.

- [ ] **Step 7: Run tests**

```bash
pnpm rust:test
pnpm rust:clippy
pnpm --filter @fileoctopus/frontend test
pnpm --filter @fileoctopus/frontend typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/desktop-tauri/src-tauri/src/commands/network.rs \
        apps/desktop-tauri/src-tauri/src/lib.rs \
        crates/config/src/network.rs \
        packages/ts-api/src/clients/network.ts \
        packages/ts-api/src/commandMap.ts \
        packages/frontend/src/components/dialogs/ConnectServerDialog.tsx \
        packages/frontend/src/components/DialogOverlayGroup.tsx \
        packages/frontend/src/hooks/useNetworkHandlers.ts
git commit -m "feat(network): show and clear pinned host-key fingerprint"
```

---

## Task 3: Sidebar auth-state indicator

**Why:** Per review §5f, the sidebar shows the same icon for a working profile and one whose keychain entry is missing. After Stage 4 Task 2, status is push-updated; combine that with `hasStoredSecret` to badge the row when credentials are missing.

**Files:**

- Modify: `packages/frontend/src/sidebar/Sidebar.tsx`
- Test: `packages/frontend/tests/sidebarNetworkStatus.test.tsx` (create)

- [ ] **Step 1: Write failing test**

Create `packages/frontend/tests/sidebarNetworkStatus.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "../src/sidebar/Sidebar";
import type {
  NetworkConnectionStatusDto,
  NetworkProfileDto,
} from "@fileoctopus/ts-api";

const baseProfile: NetworkProfileDto = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  label: "Prod",
  scheme: "sftp",
  host: "prod.example.com",
  port: 22,
  username: "deploy",
  authKind: "password",
  privateKeyPath: null,
  defaultPath: "/",
  defaultUri: "sftp://550e8400-e29b-41d4-a716-446655440000/",
  hostKeyFingerprint: null,
  sortOrder: 0,
  lastConnectedAt: null,
  lastError: null,
  hasStoredSecret: false,
  createdAt: "2026-05-19T00:00:00Z",
  updatedAt: "2026-05-19T00:00:00Z",
};

function renderSidebar(
  profile: NetworkProfileDto,
  statuses: NetworkConnectionStatusDto[] = [],
) {
  return render(
    <Sidebar
      locations={[]}
      networkProfiles={[profile]}
      networkStatuses={statuses}
      favorites={[]}
      recentToday={[]}
      recentWeek={[]}
      starred={[]}
      activeUri=""
      onNavigate={vi.fn()}
      onAddFavorite={vi.fn()}
      onRemoveFavorite={vi.fn()}
      onRenameFavorite={vi.fn()}
      onRevealFavorite={vi.fn()}
      onAddServer={vi.fn()}
      onConnectProfile={vi.fn()}
      onDisconnectProfile={vi.fn()}
      onEditProfile={vi.fn()}
      onDeleteProfile={vi.fn()}
    />,
  );
}

describe("Sidebar network section", () => {
  it("marks profiles without stored credentials", () => {
    renderSidebar(baseProfile);
    const item = screen.getByRole("button", { name: /Prod/ });
    expect(item.getAttribute("title")).toMatch(/credentials missing/i);
  });

  it("reflects connected status in title", () => {
    renderSidebar({ ...baseProfile, hasStoredSecret: true }, [
      {
        profileId: baseProfile.id,
        status: "connected",
        message: null,
      },
    ]);
    const item = screen.getByRole("button", { name: /Prod/ });
    expect(item.getAttribute("title")).toMatch(/connected/i);
  });

  it("reflects error status in title", () => {
    renderSidebar({ ...baseProfile, hasStoredSecret: true }, [
      {
        profileId: baseProfile.id,
        status: "error",
        message: "TCP timeout",
      },
    ]);
    const item = screen.getByRole("button", { name: /Prod/ });
    expect(item.getAttribute("title")).toMatch(/TCP timeout/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails on the first case**

```bash
pnpm --filter @fileoctopus/frontend test -- sidebarNetworkStatus
```

Expected: FAIL — the current `title` derivation in `Sidebar.tsx:192-198` does not include `hasStoredSecret`.

- [ ] **Step 3: Update Sidebar to include auth-state in title and add badge classes**

In `packages/frontend/src/sidebar/Sidebar.tsx`, replace the `title=` expression (line 192-198):

```tsx
                title={profileTitle(profile, status)}
```

Then add a helper at the bottom of the file (next to `locationIcon`):

```tsx
function profileTitle(
  profile: NetworkProfileDto,
  status: NetworkConnectionStatusDto | undefined,
): string {
  if (!profile.hasStoredSecret) {
    return `${profile.label} (credentials missing)`;
  }
  if (status?.status === "connected") {
    return `${profile.label} (connected)`;
  }
  if (status?.status === "error") {
    return `${profile.label} (${status.message ?? "error"})`;
  }
  return profile.label;
}
```

Add a CSS class hook for visual indication. Pass a new optional `badge` prop to `SidebarItem`. Update the function signature at lines 622-640:

```tsx
function SidebarItem({
  icon,
  label,
  active,
  onClick,
  onContextMenu,
  indented = false,
  subdued = false,
  title,
  badge,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  indented?: boolean;
  subdued?: boolean;
  title?: string;
  badge?: "warning" | "error" | null;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cx(
        "fo-sidebar-item",
        active && "fo-sidebar-active",
        indented && "fo-sidebar-indented",
        subdued && "fo-sidebar-subdued",
        badge === "warning" && "fo-sidebar-warning",
        badge === "error" && "fo-sidebar-error",
      )}
      title={title ?? label}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <span className="fo-sidebar-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="fo-sidebar-label">{label}</span>
    </Button>
  );
}
```

And at the network-profile `SidebarItem` call site (around line 178-200), add:

```tsx
              badge={
                !profile.hasStoredSecret
                  ? "warning"
                  : status?.status === "error"
                    ? "error"
                    : null
              }
```

- [ ] **Step 4: Run test, verify it passes**

```bash
pnpm --filter @fileoctopus/frontend test -- sidebarNetworkStatus
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/frontend/src/sidebar/Sidebar.tsx \
        packages/frontend/tests/sidebarNetworkStatus.test.tsx
git commit -m "feat(frontend): badge sidebar profiles with auth or error state"
```

---

## Task 4: Visual loading indicator while connecting

**Why:** Per review §5b/§5c, even after Stage 4 there's no visual cue _during_ an SSH handshake. After Stage 1 the connection only happens lazily inside `fs_list_start`, so the user sees only the existing pane "loading" spinner. But explicit "Connect" actions from the sidebar context menu still need feedback. Track an in-flight set in `useNetworkHandlers` and project it to the sidebar via `aria-busy` + a CSS class.

> **Note:** We don't introduce a backend `Connecting` `ConnectionStatus` variant — the dialog/sidebar tracks its own in-progress promise. The status event channel from Stage 4 carries only terminal transitions.

**Files:**

- Modify: `packages/frontend/src/hooks/useNetworkHandlers.ts` (expose in-flight set)
- Modify: `packages/frontend/src/app/providers/ShellProvider.tsx` (thread state)
- Modify: `packages/frontend/src/sidebar/Sidebar.tsx` (consume `busyProfileIds`)
- Modify: `packages/frontend/tests/sidebarNetworkStatus.test.tsx` (extend)

- [ ] **Step 1: Track in-flight connects**

In `packages/frontend/src/hooks/useNetworkHandlers.ts`, replace the hook implementation's return to track active operations. Wrap the existing `connectProfile` and `disconnectProfile`:

```ts
import { useCallback, useState } from "react";
// ... existing imports

export function useNetworkHandlers({
  client,
  refreshNetworkProfiles,
  setOperationError,
}: UseNetworkHandlersParams) {
  const [busyProfileIds, setBusyProfileIds] = useState<Set<string>>(new Set());

  const withBusy = useCallback(
    async (profileId: string, fn: () => Promise<void>) => {
      setBusyProfileIds((current) => {
        const next = new Set(current);
        next.add(profileId);
        return next;
      });
      try {
        await fn();
      } finally {
        setBusyProfileIds((current) => {
          const next = new Set(current);
          next.delete(profileId);
          return next;
        });
      }
    },
    [],
  );

  const connectProfile = useCallback(
    async (profileId: string) => {
      setOperationError(null);
      await withBusy(profileId, async () => {
        try {
          await client.network.connect({ id: profileId });
          await refreshNetworkProfiles();
        } catch (error) {
          setOperationError(normalizeIpcError(error).message);
          throw error;
        }
      });
    },
    [client, refreshNetworkProfiles, setOperationError, withBusy],
  );

  // ... same wrapping for disconnectProfile

  return {
    connectProfile,
    disconnectProfile,
    deleteProfile,
    saveProfile,
    forgetFingerprint,
    busyProfileIds,
  };
}
```

- [ ] **Step 2: Thread `busyProfileIds` to the Sidebar**

In `packages/frontend/src/app/providers/ShellProvider.tsx`, expose `busyProfileIds` from the `useNetworkHandlers` return and pass it through `useShellContext` value to consumers.

In `packages/frontend/src/sidebar/Sidebar.tsx`, add to the props interface:

```ts
busyProfileIds: Set<string>;
```

Use it to add an animated state to the badge. In the network section render (around line 173-201), thread `busy={busyProfileIds.has(profile.id)}` to `SidebarItem` (extend the prop with `busy?: boolean` and toggle `aria-busy` + a CSS class `fo-sidebar-busy`).

- [ ] **Step 3: Lightweight test for `aria-busy`**

In `packages/frontend/tests/sidebarNetworkStatus.test.tsx`, append:

```tsx
it("sets aria-busy while a connect is in flight", () => {
  const profile = { ...baseProfile, hasStoredSecret: true };
  render(
    <Sidebar
      locations={[]}
      networkProfiles={[profile]}
      networkStatuses={[]}
      favorites={[]}
      recentToday={[]}
      recentWeek={[]}
      starred={[]}
      activeUri=""
      busyProfileIds={new Set([profile.id])}
      onNavigate={vi.fn()}
      onAddFavorite={vi.fn()}
      onRemoveFavorite={vi.fn()}
      onRenameFavorite={vi.fn()}
      onRevealFavorite={vi.fn()}
      onAddServer={vi.fn()}
      onConnectProfile={vi.fn()}
      onDisconnectProfile={vi.fn()}
      onEditProfile={vi.fn()}
      onDeleteProfile={vi.fn()}
    />,
  );
  const item = screen.getByRole("button", { name: /Prod/ });
  expect(item.getAttribute("aria-busy")).toBe("true");
});
```

Update the other tests in the same file to pass `busyProfileIds={new Set()}`.

- [ ] **Step 4: Manual QA check**

```bash
pnpm dev
```

In the running app:

1. Add an SFTP profile.
2. From the sidebar context menu, click "Connect".
3. Verify a visual busy state appears on the row until the connection completes or errors.

(No automated test for the visual state — gates only on `aria-busy`.)

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @fileoctopus/frontend test -- sidebarNetworkStatus
pnpm --filter @fileoctopus/frontend typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/frontend/src/hooks/useNetworkHandlers.ts \
        packages/frontend/src/app/providers/ShellProvider.tsx \
        packages/frontend/src/sidebar/Sidebar.tsx \
        packages/frontend/tests/sidebarNetworkStatus.test.tsx
git commit -m "feat(frontend): show busy state for in-flight network connects"
```

---

## Stage 5 self-review

- Destructive remove without confirmation (review §5d): now gated by `RemoveServerDialog`.
- Missing fingerprint UI (review §5e): pinned fingerprint displayed in Edit Server; "Forget pinned fingerprint" restores TOFU.
- Sidebar auth/connection state opacity (review §5f): `title` and badge class reflect `hasStoredSecret` + connection status.
- No feedback during explicit connect (review §5b/§5c): sidebar rows now report `aria-busy="true"` while a connect is in flight.
- Four commits; Tasks 1, 3, 4 can ship in any order. Task 2 should follow Stage 2 (it depends on the persisted SHA-256 fingerprint).

**Next stage:** [06-stage-6-test-coverage-and-docs.md](06-stage-6-test-coverage-and-docs.md)
