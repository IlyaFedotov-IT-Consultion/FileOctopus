import { StatusBarSection } from "../components/StatusBarSection";
import { activeTab } from "../panelStore";
import { useShellLayout } from "./ShellLayoutContext";

export function ShellStatusBar() {
  const ctx = useShellLayout();
  const panelId = ctx.state.activePanelId;
  const tab = activeTab(ctx.state.panels[panelId]);
  const selectedCount = tab.selectedIds.length;
  const hasSelection = selectedCount > 0;
  const canRename = selectedCount === 1;
  const functionItems = [
    {
      key: "F2",
      label: "Rename",
      disabled: !canRename,
      onClick: () => ctx.triggerInlineRename(panelId),
    },
    {
      key: "F3",
      label: "Open",
      disabled: !hasSelection,
      onClick: () => ctx.handleCommandSelect("op.open", panelId),
    },
    {
      key: "F4",
      label: "Info",
      onClick: () => void ctx.handleProperties(panelId, null),
    },
    {
      key: "F5",
      label: "Copy",
      disabled: !hasSelection,
      onClick: () => ctx.handleCopyOrMove(panelId, "copy"),
    },
    {
      key: "F6",
      label: "Move",
      disabled: !hasSelection,
      onClick: () => ctx.handleCopyOrMove(panelId, "move"),
    },
    {
      key: "F7",
      label: "New Folder",
      onClick: () => ctx.handleCreateFolder(panelId),
    },
    {
      key: "F8",
      label: "Trash",
      disabled: !hasSelection,
      onClick: () => ctx.handleTrash(panelId),
    },
    {
      key: "⌘I",
      label: "Properties",
      onClick: () => void ctx.handleProperties(panelId, null),
    },
  ];

  return (
    <div className="fo-shell-status-stack">
      <div className="fo-commander-bar" aria-label="Function key actions">
        {functionItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className="fo-commander-key"
            disabled={item.disabled}
            onClick={item.onClick}
          >
            <span className="fo-commander-keycap">{item.key}</span>
            <span className="fo-commander-label">{item.label}</span>
          </button>
        ))}
      </div>
      <StatusBarSection
        state={ctx.state}
        jobs={ctx.jobs}
        operationError={ctx.operationError}
        appHealth={ctx.appHealth}
        diagnosticsOpen={ctx.diagnosticsOpen}
        onOpenActivity={() => {
          ctx.markActivityPinnedOpen();
          ctx.setActivityCollapsed(false);
          void ctx.updatePreference("activityPanelVisible", "true");
        }}
        onShowErrorDetails={
          ctx.operationError ? () => ctx.setErrorDetailsOpen(true) : undefined
        }
      />
    </div>
  );
}
