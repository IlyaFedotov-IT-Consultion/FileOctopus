import type {
  GitDiscoverRequest,
  GitDiscoverResponse,
  GitStatusForDirectoryRequest,
  GitStatusForDirectoryResponse,
  IpcTransport,
} from "../types";

export class GitClient {
  constructor(private readonly transport: IpcTransport) {}

  async discover(request: GitDiscoverRequest): Promise<GitDiscoverResponse> {
    return this.transport.invoke<GitDiscoverResponse>("git.discover", {
      request,
    });
  }

  async statusForDirectory(
    request: GitStatusForDirectoryRequest,
  ): Promise<GitStatusForDirectoryResponse> {
    return this.transport.invoke<GitStatusForDirectoryResponse>(
      "git.statusForDirectory",
      { request },
    );
  }
}
