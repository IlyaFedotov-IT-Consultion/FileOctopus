import type {
  IpcTransport,
  AppDataHealthResponse,
  ExportDiagnosticsBundleRequest,
  ExportDiagnosticsBundleResponse,
} from "../types";

export class DiagnosticsClient {
  constructor(private readonly transport: IpcTransport) {}

  async appDataHealth(): Promise<AppDataHealthResponse> {
    return this.transport.invoke<AppDataHealthResponse>(
      "diagnostics.appDataHealth",
    );
  }

  async exportBundle(
    request: ExportDiagnosticsBundleRequest,
  ): Promise<ExportDiagnosticsBundleResponse> {
    return this.transport.invoke<ExportDiagnosticsBundleResponse>(
      "diagnostics.exportBundle",
      { request },
    );
  }
}
