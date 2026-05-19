import { useRef } from "react";
import { Button } from "@fileoctopus/ui";
import { useDialogEscape } from "../../hooks/useDialogEscape";
import { useFocusTrap } from "../../hooks/useFocusTrap";

interface ClosePaneTerminalDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ClosePaneTerminalDialog({
  open,
  onClose,
  onConfirm,
}: ClosePaneTerminalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useDialogEscape(open, onClose);
  useFocusTrap(dialogRef, open);

  if (!open) {
    return null;
  }

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        ref={dialogRef}
        open
        role="dialog"
        className="fo-dialog fo-close-pane-terminal-dialog"
        aria-labelledby="close-pane-terminal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <h2 id="close-pane-terminal-title">
            Hide pane with running terminal?
          </h2>
        </header>
        <div className="fo-dialog-body">
          <p>
            The right pane has a running embedded terminal. Switching to single
            pane hides that pane; the shell keeps running in the background.
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
            Switch to single pane
          </Button>
        </footer>
      </dialog>
    </div>
  );
}
