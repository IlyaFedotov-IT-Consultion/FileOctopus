import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";
import type {
  AppInfoResponse,
  DirectoryBatchEventDto,
  IpcError,
  IpcTransport,
  ListStartRequest,
  ListStartResponse,
  StatRequest,
  StatResponse,
  UnlistenFn
} from "./types";

export const DIRECTORY_BATCH_EVENT = "directory.batch";

const commandMap: Record<string, string> = {
  "app.get_info": "app_get_info",
  "fs.stat": "fs_stat",
  "fs.list_start": "fs_list_start"
};

export class FileOctopusClient {
  readonly fs: FsClient;

  constructor(private readonly transport: IpcTransport) {
    this.fs = new FsClient(transport);
  }

  getAppInfo(): Promise<AppInfoResponse> {
    return this.transport.invoke<AppInfoResponse>("app.get_info");
  }
}

export class FsClient {
  constructor(private readonly transport: IpcTransport) {}

  async stat(request: StatRequest): Promise<StatResponse> {
    try {
      return await this.transport.invoke<StatResponse>("fs.stat", { request });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  async listStart(request: ListStartRequest): Promise<ListStartResponse> {
    try {
      return await this.transport.invoke<ListStartResponse>("fs.list_start", { request });
    } catch (error) {
      throw normalizeIpcError(error);
    }
  }

  onDirectoryBatch(handler: (event: DirectoryBatchEventDto) => void): Promise<UnlistenFn> {
    if (!this.transport.listen) {
      return Promise.reject({
        code: "unsupported_transport",
        message: "Transport does not support event subscriptions"
      } satisfies IpcError);
    }

    return this.transport.listen<DirectoryBatchEventDto>(DIRECTORY_BATCH_EVENT, handler);
  }
}

export function createTauriTransport(): IpcTransport {
  return {
    invoke<TResponse>(command: string, args?: Record<string, unknown>) {
      return tauriInvoke<TResponse>(commandMap[command] ?? command, args);
    },
    async listen<TPayload>(event: string, handler: (payload: TPayload) => void) {
      return tauriListen<TPayload>(event, (tauriEvent) => handler(tauriEvent.payload));
    }
  };
}

export function createFileOctopusClient(transport: IpcTransport = createTauriTransport()) {
  return new FileOctopusClient(transport);
}

export function normalizeIpcError(error: unknown): IpcError {
  if (isIpcError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return {
      code: "unknown",
      message: error.message
    };
  }

  if (typeof error === "string") {
    return {
      code: "unknown",
      message: error
    };
  }

  return {
    code: "unknown",
    message: "Unexpected IPC error"
  };
}

function isIpcError(error: unknown): error is IpcError {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as Partial<IpcError>;

  return typeof candidate.code === "string" && typeof candidate.message === "string";
}
