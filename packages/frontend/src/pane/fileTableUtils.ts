import type { FileEntryDto } from "@fileoctopus/ts-api";

export function formatSize(size?: number | null): string {
  if (size == null) {
    return "";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(value?: string | null): string {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString();
}

export function fileIconGlyph(
  entry: Pick<FileEntryDto, "kind" | "extension" | "name">,
): string {
  if (entry.kind === "directory") {
    return "DIR";
  }

  const extension = (
    entry.extension ??
    entry.name.split(".").pop() ??
    ""
  ).toLowerCase();

  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) {
    return "IMG";
  }
  if (["mp4", "mov", "mkv", "avi"].includes(extension)) {
    return "VID";
  }
  if (["mp3", "wav", "flac", "aac"].includes(extension)) {
    return "AUD";
  }
  if (["zip", "tar", "gz", "rar", "7z"].includes(extension)) {
    return "ZIP";
  }
  if (["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(extension)) {
    return extension.slice(0, 3).toUpperCase();
  }

  return "TXT";
}
