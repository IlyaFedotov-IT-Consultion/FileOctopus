import type {
  IpcTransport,
  TerminalExitEvent,
  TerminalKillRequest,
  TerminalOkResponse,
  TerminalOutputEvent,
  TerminalResizeRequest,
  TerminalSpawnRequest,
  TerminalSpawnResponse,
  TerminalWriteRequest,
  UnlistenFn,
} from "../types";
import { TERMINAL_EXIT_EVENT, TERMINAL_OUTPUT_EVENT } from "../events";
import { requireListen } from "../requireListen";

export class TerminalClient {
  constructor(private readonly transport: IpcTransport) {}

  async spawn(request: TerminalSpawnRequest): Promise<TerminalSpawnResponse> {
    return this.transport.invoke<TerminalSpawnResponse>("terminal.spawn", {
      request,
    });
  }

  async write(request: TerminalWriteRequest): Promise<TerminalOkResponse> {
    return this.transport.invoke<TerminalOkResponse>("terminal.write", {
      request,
    });
  }

  async resize(request: TerminalResizeRequest): Promise<TerminalOkResponse> {
    return this.transport.invoke<TerminalOkResponse>("terminal.resize", {
      request,
    });
  }

  async kill(request: TerminalKillRequest): Promise<TerminalOkResponse> {
    return this.transport.invoke<TerminalOkResponse>("terminal.kill", {
      request,
    });
  }

  onOutput(handler: (event: TerminalOutputEvent) => void): Promise<UnlistenFn> {
    return requireListen(this.transport, TERMINAL_OUTPUT_EVENT, handler);
  }

  onExit(handler: (event: TerminalExitEvent) => void): Promise<UnlistenFn> {
    return requireListen(this.transport, TERMINAL_EXIT_EVENT, handler);
  }
}
