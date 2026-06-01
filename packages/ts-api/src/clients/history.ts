import type {
  IpcTransport,
  ListRecentOperationsRequest,
  ListRecentOperationsResponse,
  ClearOperationHistoryResponse,
} from "../types";

export class OperationHistoryClient {
  constructor(private readonly transport: IpcTransport) {}

  async listRecentOperations(
    request: ListRecentOperationsRequest = {},
  ): Promise<ListRecentOperationsResponse> {
    return this.transport.invoke<ListRecentOperationsResponse>(
      "operationHistory.listRecent",
      { request },
    );
  }

  async clearOperationHistory(): Promise<ClearOperationHistoryResponse> {
    return this.transport.invoke<ClearOperationHistoryResponse>(
      "operationHistory.clear",
    );
  }
}
