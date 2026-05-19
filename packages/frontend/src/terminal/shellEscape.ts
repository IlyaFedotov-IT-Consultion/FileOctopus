export function shellEscapePosixPath(path: string): string {
  if (!path) {
    return "''";
  }
  return `'${path.replace(/'/g, "'\\''")}'`;
}

export function encodeTerminalInput(data: string): string {
  return btoa(
    Array.from(new TextEncoder().encode(data), (byte) =>
      String.fromCharCode(byte),
    ).join(""),
  );
}
