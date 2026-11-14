import type { CommitId } from "@mihiraki/core";

/** A repository on github.com. */
export interface Repository {
  readonly owner: string;
  readonly repo: string;
}

/** A path of the repository with each segment percent-encoded, keeping the slashes between them. */
export function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/**
 * Where github.com serves the file at `path` of `repository` at commit `oid`: its page
 * (`blob`), the JSON GitHub's code view loads for it (`_styled`), or the file itself (`raw`).
 */
export function fileUrl(
  repository: Repository,
  route: "blob" | "_styled" | "raw",
  oid: CommitId,
  path: string,
): string {
  return `https://github.com/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/${route}/${oid}/${encodePath(path)}`;
}
