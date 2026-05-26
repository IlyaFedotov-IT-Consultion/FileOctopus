import { describe, expect, it } from "vitest";
import {
  breadcrumbSegmentsFromUri,
  displayPathFromUri,
  isNetworkUri,
  isRemoteUri,
  isSupportedNavigationUri,
  parentUriFromUri,
  profileIdFromRemoteUri,
  rootUriForUri,
} from "../src/uri";

const profileId = "77ac077d-d721-480f-9ee0-bb22403f0fd5";
const remoteHome = `sftp://${profileId}/home/ilya`;

describe("uri helpers", () => {
  it("detects remote schemes", () => {
    expect(
      isRemoteUri("sftp://550e8400-e29b-41d4-a716-446655440000/home"),
    ).toBe(true);
    expect(isRemoteUri("local:///tmp")).toBe(false);
  });

  it("accepts local and remote URIs for navigation", () => {
    expect(isSupportedNavigationUri("local:///tmp")).toBe(true);
    expect(isSupportedNavigationUri("network:///")).toBe(true);
    expect(isSupportedNavigationUri("network:///cloud")).toBe(true);
    expect(
      isSupportedNavigationUri(
        "sftp://550e8400-e29b-41d4-a716-446655440000/home",
      ),
    ).toBe(true);
    expect(isSupportedNavigationUri("/tmp")).toBe(false);
  });

  it("extracts profile id from remote URIs", () => {
    expect(
      profileIdFromRemoteUri(
        "sftp://550e8400-e29b-41d4-a716-446655440000/home/deploy",
      ),
    ).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(profileIdFromRemoteUri("local:///tmp")).toBeNull();
  });

  it("derives remote display paths without local prefix", () => {
    expect(displayPathFromUri(remoteHome)).toBe("/home/ilya");
    expect(parentUriFromUri(remoteHome)).toBe(`sftp://${profileId}/home`);
    expect(rootUriForUri(remoteHome)).toBe(`sftp://${profileId}/`);
  });

  it("builds remote breadcrumb segments with remote URIs", () => {
    expect(breadcrumbSegmentsFromUri(remoteHome)).toEqual([
      { label: "home", uri: `sftp://${profileId}/home` },
      { label: "ilya", uri: remoteHome },
    ]);
  });

  it("builds network breadcrumb segments with virtual URIs", () => {
    expect(displayPathFromUri("network:///cloud")).toBe(
      "Network / Cloud Storage",
    );
    expect(parentUriFromUri("network:///cloud")).toBe("network:///");
    expect(rootUriForUri("network:///cloud")).toBe("network:///");
    expect(breadcrumbSegmentsFromUri("network:///cloud")).toEqual([
      { label: "Network", uri: "network:///" },
      { label: "Cloud Storage", uri: "network:///cloud" },
    ]);
  });

  it("detects the network virtual scheme exclusively", () => {
    expect(isNetworkUri("network:///")).toBe(true);
    expect(isNetworkUri("network:///cloud")).toBe(true);
    expect(isNetworkUri("network:///saved/abc")).toBe(true);
    // Must use three slashes; the "network" scheme has no authority.
    expect(isNetworkUri("network://cloud")).toBe(false);
    expect(isNetworkUri("network:cloud")).toBe(false);
    expect(isNetworkUri("local:///")).toBe(false);
    expect(isNetworkUri("sftp://abc/")).toBe(false);
  });

  it("renders the root network URI as just the Network label", () => {
    expect(displayPathFromUri("network:///")).toBe("Network");
  });

  it("returns null parent for the network root and steps up one level otherwise", () => {
    expect(parentUriFromUri("network:///")).toBeNull();
    expect(parentUriFromUri("network:///cloud/google-drive-0")).toBe(
      "network:///cloud",
    );
  });

  it("titlecases unknown kebab-case slugs in network breadcrumb labels", () => {
    const segments = breadcrumbSegmentsFromUri(
      "network:///cloud/google-drive-0",
    );

    expect(segments).toEqual([
      { label: "Network", uri: "network:///" },
      { label: "Cloud Storage", uri: "network:///cloud" },
      { label: "Google Drive 0", uri: "network:///cloud/google-drive-0" },
    ]);
  });

  it("supports deep network paths in display + breadcrumb output", () => {
    const deep = "network:///saved/550e8400-e29b-41d4-a716-446655440000";

    expect(displayPathFromUri(deep)).toBe(
      "Network / Saved Connections / 550e8400 E29b 41d4 A716 446655440000",
    );
    expect(rootUriForUri(deep)).toBe("network:///");
  });
});
