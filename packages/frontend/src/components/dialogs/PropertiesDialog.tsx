import type { ReactNode } from "react";
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

function PropertiesSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="fo-properties-section" aria-label={title}>
      <h3 className="fo-properties-section-title">{title}</h3>
      {children}
    </section>
  );
}

function PropertiesRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function formatContains(properties: PathPropertiesDto): string {
  if (properties.kind !== "directory") {
    return "—";
  }

  if (
    properties.itemCount == null &&
    properties.directoryCount == null &&
    properties.fileCount == null
  ) {
    return "Not available";
  }

  return [
    properties.itemCount != null && `${properties.itemCount} item(s)`,
    properties.directoryCount != null &&
      `${properties.directoryCount} folder(s)`,
    properties.fileCount != null && `${properties.fileCount} file(s)`,
  ]
    .filter(Boolean)
    .join(", ");
}

function formatFlags(properties: PathPropertiesDto): ReactNode {
  const flags: string[] = [];
  if (properties.isHidden) {
    flags.push("Hidden");
  }
  if (properties.readonly) {
    flags.push("Read-only");
  }
  if (properties.isSymlink) {
    flags.push(
      `Symlink${properties.symlinkTarget ? ` → ${properties.symlinkTarget}` : ""}`,
    );
  }

  if (flags.length === 0) {
    return <span className="fo-properties-muted">None</span>;
  }

  return (
    <div className="fo-properties-badges">
      {flags.map((flag) => (
        <span key={flag} className="fo-properties-badge">
          {flag}
        </span>
      ))}
    </div>
  );
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

  const sizeValue = properties
    ? formatSize(properties.size ?? properties.totalSize)
    : null;
  const sizeLabel =
    loading && properties?.kind === "directory" ? (
      <span className="fo-properties-calculating">Calculating size…</span>
    ) : (
      sizeValue
    );

  return (
    <div className="fo-properties">
      {loading && !properties ? (
        <div className="fo-properties-state" role="status">
          Loading properties…
        </div>
      ) : null}
      {error ? <div className="fo-operation-error">{error}</div> : null}
      {properties ? (
        <>
          <div className="fo-properties-hero">
            <span className="fo-properties-icon" aria-hidden="true">
              {entryForIcon ? fileEntryIcon(entryForIcon) : null}
            </span>
            <div className="fo-properties-heading">
              <strong title={properties.name}>{properties.name}</strong>
              <span>{propertyType(properties)}</span>
            </div>
            <span className="fo-properties-size">{sizeLabel}</span>
          </div>

          <PropertiesSection title="General">
            <dl className="fo-properties-grid">
              <PropertiesRow label="Name" value={properties.name} />
              <PropertiesRow label="Type" value={propertyType(properties)} />
              <PropertiesRow label="Size" value={sizeLabel} />
              {properties.kind === "directory" ? (
                <PropertiesRow
                  label="Contains"
                  value={formatContains(properties)}
                />
              ) : null}
            </dl>
          </PropertiesSection>

          <PropertiesSection title="Location">
            <dl className="fo-properties-grid">
              <PropertiesRow
                label="Full path"
                value={
                  <span className="fo-properties-value fo-properties-value--mono">
                    {localPathFromUri(properties.uri)}
                  </span>
                }
              />
              <PropertiesRow
                label="Resource URI"
                value={
                  <span className="fo-properties-value fo-properties-value--mono">
                    {properties.uri}
                  </span>
                }
              />
            </dl>
          </PropertiesSection>

          <PropertiesSection title="Dates">
            <dl className="fo-properties-grid">
              <PropertiesRow
                label="Created"
                value={formatDate(properties.createdAt)}
              />
              <PropertiesRow
                label="Modified"
                value={formatDate(properties.modifiedAt)}
              />
              <PropertiesRow
                label="Accessed"
                value={formatDate(properties.accessedAt)}
              />
            </dl>
          </PropertiesSection>

          <PropertiesSection title="Attributes">
            <dl className="fo-properties-grid">
              <PropertiesRow label="Flags" value={formatFlags(properties)} />
            </dl>
          </PropertiesSection>

          {properties.warnings.length > 0 ? (
            <div className="fo-properties-warnings" role="note">
              {properties.warnings.slice(0, 3).map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          <div className="fo-properties-actions">
            <Button
              type="button"
              variant="primary"
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
              Copy URI
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
