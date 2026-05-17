import type { FileEntryDto, PathPropertiesDto } from "@fileoctopus/ts-api";
import { Button, fileEntryIcon } from "@fileoctopus/ui";
import type { PanelId } from "../../panelStore";
import { propertyType, localPathFromUri } from "../../utils/paneUtils";
import { formatDate, formatSize } from "../../pane/fileTableUtils";

export interface PropertiesDialogState {
  panelId: PanelId;
  entry: FileEntryDto | null;
  properties: PathPropertiesDto | null;
  loading: boolean;
  error: string | null;
}

interface PropertiesDialogProps {
  open: boolean;
  state: PropertiesDialogState;
  onCopyPath: () => void;
  onReveal: () => void;
}

export function PropertiesDialog({
  open,
  state,
  onCopyPath,
  onReveal,
}: PropertiesDialogProps) {
  if (!open) {
    return null;
  }

  const { properties, loading, error } = state;
  const entryForIcon =
    state.entry ??
    (properties
      ? { kind: properties.kind, name: properties.name, extension: null }
      : null);

  return (
    <div className="fo-properties">
      {loading ? <div className="fo-properties-state">Loading</div> : null}
      {error ? <div className="fo-operation-error">{error}</div> : null}
      {properties ? (
        <>
          <div className="fo-properties-hero">
            <span className="fo-properties-icon" aria-hidden="true">
              {entryForIcon ? fileEntryIcon(entryForIcon) : null}
            </span>
            <div className="fo-properties-heading">
              <strong>{properties.name}</strong>
              <span>{propertyType(properties)}</span>
            </div>
            <span className="fo-properties-size">
              {formatSize(properties.size ?? properties.totalSize)}
            </span>
          </div>
          <dl className="fo-properties-grid">
            <dt>Name</dt>
            <dd>{properties.name}</dd>
            <dt>Type</dt>
            <dd>{propertyType(properties)}</dd>
            <dt>Full path</dt>
            <dd>{localPathFromUri(properties.uri)}</dd>
            <dt>Resource URI</dt>
            <dd>{properties.uri}</dd>
            <dt>Size</dt>
            <dd>{formatSize(properties.size ?? properties.totalSize)}</dd>
            <dt>Contains</dt>
            <dd>
              {properties.itemCount != null
                ? [
                    properties.itemCount != null &&
                      `${properties.itemCount} item(s)`,
                    properties.directoryCount != null &&
                      `${properties.directoryCount} folder(s)`,
                    properties.fileCount != null &&
                      `${properties.fileCount} file(s)`,
                  ]
                    .filter(Boolean)
                    .join(", ")
                : "Not available"}
            </dd>
            <dt>Created</dt>
            <dd>{formatDate(properties.createdAt)}</dd>
            <dt>Modified</dt>
            <dd>{formatDate(properties.modifiedAt)}</dd>
            <dt>Accessed</dt>
            <dd>{formatDate(properties.accessedAt)}</dd>
            <dt>Flags</dt>
            <dd>
              {[
                properties.isHidden && "Hidden",
                properties.readonly && "Read-only",
                properties.isSymlink &&
                  `Symlink${properties.symlinkTarget ? ` → ${properties.symlinkTarget}` : ""}`,
              ]
                .filter(Boolean)
                .join(", ") || "None"}
            </dd>
          </dl>
          {properties.warnings.length > 0 ? (
            <div className="fo-dialog-summary">
              {properties.warnings.slice(0, 3).map((warning) => (
                <span key={warning}>{warning}</span>
              ))}
            </div>
          ) : null}
          <div className="fo-dialog-actions">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCopyPath}
            >
              Copy Path
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void navigator.clipboard.writeText(properties.uri)}
            >
              Copy Resource URI
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onReveal}>
              Reveal
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
