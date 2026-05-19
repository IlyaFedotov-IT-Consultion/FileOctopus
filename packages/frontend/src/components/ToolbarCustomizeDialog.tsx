import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@fileoctopus/ui";
import {
  customizableToolbarCommands,
  DEFAULT_TOOLBAR_ENTRIES,
  toolbarCommandMeta,
  type ToolbarEntry,
} from "../commands/toolbarConfig";
import type { CommandId } from "../commands/types";
import { useDialogEscape } from "../hooks/useDialogEscape";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface ToolbarCustomizeDialogProps {
  open: boolean;
  entries: ToolbarEntry[];
  onClose: () => void;
  onSave: (entries: ToolbarEntry[]) => void;
}

function entryLabel(entry: ToolbarEntry): string {
  if (entry.kind === "separator") {
    return "Separator";
  }
  return toolbarCommandMeta(entry.commandId).label;
}

export function ToolbarCustomizeDialog({
  open,
  entries,
  onClose,
  onSave,
}: ToolbarCustomizeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<ToolbarEntry[]>(entries);
  const [addCommandId, setAddCommandId] = useState<CommandId | "">("");

  useDialogEscape(open, onClose);
  useFocusTrap(dialogRef, open);

  useEffect(() => {
    if (open) {
      setDraft(entries);
    }
  }, [open, entries]);

  const catalog = useMemo(() => customizableToolbarCommands(), []);

  if (!open) {
    return null;
  }

  const move = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.length) {
      return;
    }
    setDraft((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const removeAt = (index: number) => {
    setDraft((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const addCommand = () => {
    if (!addCommandId) {
      return;
    }
    setDraft((current) => [
      ...current,
      { kind: "command", commandId: addCommandId },
    ]);
    setAddCommandId("");
  };

  return (
    <div className="fo-dialog-backdrop" role="presentation" onClick={onClose}>
      <dialog
        ref={dialogRef}
        open
        className="fo-dialog fo-toolbar-customize-dialog"
        aria-labelledby="fo-toolbar-customize-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fo-dialog-header">
          <h2 id="fo-toolbar-customize-title">Customize Toolbar</h2>
          <p className="fo-dialog-subtitle">
            Choose commander buttons shown above the file panes. Navigation
            buttons stay fixed on the left.
          </p>
        </header>
        <div className="fo-toolbar-customize-body">
          <ul className="fo-toolbar-customize-list">
            {draft.map((entry, index) => (
              <li
                key={`${entry.kind}-${index}`}
                className="fo-toolbar-customize-row"
              >
                <span className="fo-toolbar-customize-label">
                  {entryLabel(entry)}
                </span>
                <div className="fo-toolbar-customize-actions">
                  <Button
                    type="button"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={index === draft.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    Down
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => removeAt(index)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="fo-toolbar-customize-add">
            <label className="fo-settings-field">
              <span>Add command</span>
              <select
                value={addCommandId}
                onChange={(event) =>
                  setAddCommandId(event.target.value as CommandId | "")
                }
              >
                <option value="">Select…</option>
                {catalog.map((command) => (
                  <option key={command.commandId} value={command.commandId}>
                    {command.label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              size="sm"
              onClick={addCommand}
              disabled={!addCommandId}
            >
              Add
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() =>
                setDraft((current) => [...current, { kind: "separator" }])
              }
            >
              Add separator
            </Button>
          </div>
        </div>
        <footer className="fo-dialog-footer">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDraft([...DEFAULT_TOOLBAR_ENTRIES])}
          >
            Reset to default
          </Button>
          <span className="fo-toolbar-customize-spacer" />
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            Save
          </Button>
        </footer>
      </dialog>
    </div>
  );
}
