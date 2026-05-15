import { useEffect } from "react";
import { Button } from "@fileoctopus/ui";
import { formatShortcut, shortcutGroups } from "../shortcuts";

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        open
        className="fo-dialog fo-shortcuts-dialog"
        aria-labelledby="shortcuts-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <h2 id="shortcuts-title">Keyboard shortcuts</h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>
        <div className="fo-shortcuts-groups">
          {shortcutGroups.map((group) => (
            <section key={group.title} className="fo-shortcuts-group">
              <h3>{group.title}</h3>
              <table className="fo-shortcuts-table">
                <tbody>
                  {group.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.label}</td>
                      <td>
                        <kbd>{formatShortcut(entry)}</kbd>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </dialog>
    </div>
  );
}
