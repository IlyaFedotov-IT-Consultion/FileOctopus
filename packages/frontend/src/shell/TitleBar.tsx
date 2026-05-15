import { Badge, Button, DropdownMenu } from "@fileoctopus/ui";

interface TitleBarProps {
  readiness: string;
  helpOpen: boolean;
  onToggleHelp: () => void;
  onSettings: () => void;
  onShortcuts: () => void;
  onDiagnostics: () => void;
}

export function TitleBar({
  readiness,
  helpOpen,
  onToggleHelp,
  onSettings,
  onShortcuts,
  onDiagnostics,
}: TitleBarProps) {
  return (
    <header className="fo-topbar">
      <div className="fo-brand">
        <span className="fo-brand-mark" aria-hidden="true">
          🐙
        </span>
        <div>
          <h1>FileOctopus</h1>
          <Badge tone="default">Rust-powered</Badge>
        </div>
      </div>
      <div className="fo-readiness">
        <span className="fo-readiness-dot" aria-hidden="true" />
        <span>{readiness}</span>
      </div>
      <div className="fo-topbar-actions">
        <Button type="button" variant="ghost" size="sm" onClick={onSettings}>
          Settings
        </Button>
        <DropdownMenu
          label="Help"
          open={helpOpen}
          onOpenChange={(open) => {
            if (open !== helpOpen) {
              onToggleHelp();
            }
          }}
          items={[
            { id: "shortcuts", label: "Shortcuts", onSelect: onShortcuts },
            { id: "diagnostics", label: "Diagnostics", onSelect: onDiagnostics },
          ]}
        />
      </div>
    </header>
  );
}
