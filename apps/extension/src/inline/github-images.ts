import type { DocumentVersion, ImageSource } from "@mihiraki/ui";

/** The repository whose files are reviewed. */
export interface Repository {
  readonly owner: string;
  readonly repo: string;
}

/** GitHub's own rich diff marks each proxied image with the address it was written with. */
const PROXIED_IMAGE = "img[data-canonical-src]";

/** Hosts GitHub serves itself; loading from them tells no third party who is reading. */
function isGitHubHost(host: string): boolean {
  return (
    host === "github.com" ||
    host.endsWith(".githubusercontent.com") ||
    host.endsWith(".githubassets.com")
  );
}

function urlOf(src: string, base: string): URL | null {
  try {
    return new URL(src, base);
  } catch {
    return null;
  }
}

/**
 * A stand-in for the repository's root directory. Resolving against it keeps `..` from
 * going above the root, and makes a path starting with `/` start at the root, as on GitHub.
 */
const REPOSITORY_ROOT = "https://repository.invalid/";

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/**
 * The address GitHub serves a file of the repository at, for a path relative to the file
 * `version.path` at commit `version.commit`, as GitHub loads relative images in its own
 * rendering of a Markdown file. Null when `src` is not a path (it names a scheme or a host,
 * including with backslashes, which URLs read as slashes).
 */
function rawFileUrl(repository: Repository, version: DocumentVersion, src: string): string | null {
  const root = new URL(REPOSITORY_ROOT);
  const target = urlOf(src, new URL(encodePath(version.path), root).href);
  if (target?.origin !== root.origin) return null;
  const { owner, repo } = repository;
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/raw/${version.commit}${target.pathname}${target.search}${target.hash}`;
}

/**
 * Where an image of the file loads from on github.com: a relative path from the repository,
 * at the commit of the version of the file it is in; as written when GitHub itself serves
 * it (including data URIs); through the proxied address GitHub gave the same image in its
 * own rich diff of this file otherwise; or held back when there is none, as GitHub never
 * loads a third-party image straight from the reader's browser. What decides is the address
 * `src` resolves to, not how it is written: `/\\example.com/a.png` is another site's image.
 */
export function githubImageSource(container: Element, repository: Repository): ImageSource {
  const base = container.ownerDocument.baseURI;
  return (src, version) => {
    const inRepository = version && rawFileUrl(repository, version, src);
    if (inRepository) return inRepository;
    const url = urlOf(src, base);
    if (!url) return null;
    if (url.protocol === "data:" || isGitHubHost(url.host)) return url.href;
    for (const image of Array.from(container.querySelectorAll(PROXIED_IMAGE))) {
      const canonical = urlOf(image.getAttribute("data-canonical-src") ?? "", base);
      const proxied = image.getAttribute("src");
      if (canonical?.href === url.href && proxied) return proxied;
    }
    return null;
  };
}

/** Changes when GitHub's own rendering of the file (and its proxied images) comes or goes. */
export function imageKeyOf(container: Element): string {
  return Array.from(container.querySelectorAll(PROXIED_IMAGE), (image) =>
    image.getAttribute("data-canonical-src"),
  ).join("\n");
}
