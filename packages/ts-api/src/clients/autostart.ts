import type { IpcTransport, AutostartStatusDto } from "../types";

export class AutostartClient {
  constructor(private readonly transport: IpcTransport) {}

  async get(): Promise<AutostartStatusDto> {
    return this.transport.invoke<AutostartStatusDto>("autostart.get");
  }

  async set(enabled: boolean): Promise<AutostartStatusDto> {
    return this.transport.invoke<AutostartStatusDto>("autostart.set", {
      enabled,
    });
  }
}
