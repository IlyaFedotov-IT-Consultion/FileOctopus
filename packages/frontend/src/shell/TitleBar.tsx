import { Badge, Button } from "@fileoctopus/ui";
import { MenuBar, type MenuBarProps } from "./MenuBar";

interface TitleBarProps {
  onSettings: () => void;
  menuBarProps: MenuBarProps;
}

export function TitleBar({ onSettings, menuBarProps }: TitleBarProps) {
  return (
    <header className="fo-topbar">
      <div className="fo-brand">
        <span className="fo-brand-mark" aria-hidden="true">
          FO
        </span>
        <h1>FileOctopus</h1>
        <Badge tone="default">Rust-powered</Badge>
      </div>
      <MenuBar {...menuBarProps} />
      <div className="fo-topbar-actions">
        <Button type="button" variant="ghost" size="sm" onClick={onSettings}>
          Settings
        </Button>
      </div>
    </header>
  );
}
