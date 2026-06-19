import { FileOctopusShell, type LocalPathPicker } from "@fileoctopus/frontend";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import "@fileoctopus/ui/tokens.css";
import "@fileoctopus/ui/components.css";
import "./App.css";

function isDesktopShell(): boolean {
  return typeof globalThis === "object" && "__TAURI_INTERNALS__" in globalThis;
}

const pickLocalPath: LocalPathPicker = async ({
  kind,
  title,
  currentPath,
  filters,
}) => {
  try {
    const defaultPath = currentPath?.trim() || undefined;

    if (kind === "save") {
      return await save({ title, defaultPath, filters });
    }

    const selected = await open({
      title,
      defaultPath,
      filters,
      multiple: false,
      directory: kind === "directory",
    });

    return typeof selected === "string" ? selected : null;
  } catch {
    return null;
  }
};

function App() {
  return (
    <FileOctopusShell
      pickLocalPath={pickLocalPath}
      onRequestExit={() => {
        if (isDesktopShell()) {
          void getCurrentWindow().close();
          return;
        }
        globalThis.close();
      }}
      onRequestMinimize={() => {
        if (isDesktopShell()) {
          void getCurrentWindow().minimize();
        }
      }}
      onRequestToggleMaximize={() => {
        if (isDesktopShell()) {
          void getCurrentWindow().toggleMaximize();
        }
      }}
    />
  );
}

export default App;
