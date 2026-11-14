import { commitId } from "@mihiraki/core";
import { describe, expect, it } from "vitest";
import { fileUrl, isFilesTab, parsePullRequestLocation } from "./pr-location";

describe("parsePullRequestLocation", () => {
  it("reads owner, repository and number from any pull request tab", () => {
    expect(parsePullRequestLocation("https://github.com/acme/docs/pull/42/files")).toEqual({
      owner: "acme",
      repo: "docs",
      number: 42,
    });
    expect(parsePullRequestLocation("https://github.com/acme/docs/pull/42")).toEqual({
      owner: "acme",
      repo: "docs",
      number: 42,
    });
  });

  it("returns null outside pull requests", () => {
    expect(parsePullRequestLocation("https://github.com/acme/docs/issues/42")).toBeNull();
    expect(parsePullRequestLocation("https://github.com/acme/docs/pulls")).toBeNull();
    expect(parsePullRequestLocation("https://gitlab.com/acme/docs/pull/42")).toBeNull();
  });
});

describe("isFilesTab", () => {
  it("recognises both the current and the legacy Files changed URLs", () => {
    expect(isFilesTab("https://github.com/acme/docs/pull/42/changes")).toBe(true);
    expect(isFilesTab("https://github.com/acme/docs/pull/42/files?diff=split")).toBe(true);
  });

  it("rejects other pull request tabs", () => {
    expect(isFilesTab("https://github.com/acme/docs/pull/42")).toBe(false);
    expect(isFilesTab("https://github.com/acme/docs/pull/42/commits")).toBe(false);
  });
});

describe("fileUrl", () => {
  const repository = { owner: "acme", repo: "docs" };
  const oid = commitId("a".repeat(40));

  it("gives the address of a file of the repository at a commit, for each route", () => {
    expect(fileUrl(repository, "raw", oid, "docs/a.png")).toBe(
      `https://github.com/acme/docs/raw/${oid}/docs/a.png`,
    );
    expect(fileUrl(repository, "blob", oid, "docs/a.md")).toBe(
      `https://github.com/acme/docs/blob/${oid}/docs/a.md`,
    );
  });

  it("percent-encodes each segment of the path, keeping the slashes between them", () => {
    expect(fileUrl(repository, "raw", oid, "設計 #1/図?.png")).toBe(
      `https://github.com/acme/docs/raw/${oid}/%E8%A8%AD%E8%A8%88%20%231/%E5%9B%B3%3F.png`,
    );
  });
});
