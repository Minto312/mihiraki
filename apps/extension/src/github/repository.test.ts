import { commitId } from "@mihiraki/core";
import { describe, expect, it } from "vitest";
import { fileUrl } from "./repository";

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
