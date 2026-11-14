import type { ImageSource } from "@mihiraki/ui";
import { encodePath, fileUrl, type Repository } from "../github/pr-location";

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

interface RepositoryTarget {
  /** Path of the repository's file, not percent-encoded. */
  readonly path: string;
  /** The query and fragment `src` gave, kept as written. */
  readonly rest: string;
}

/**
 * Where `src` points in the repository, read as a path from the file at `filePath`, as
 * GitHub reads relative images in its own rendering of a Markdown file. Null when `src` is
 * not such a path: it names a scheme or a host (including with backslashes, which URLs read
 * as slashes), or its percent-encoding is malformed.
 */
function resolveInRepository(src: string, filePath: string): RepositoryTarget | null {
  const root = new URL(REPOSITORY_ROOT);
  const target = urlOf(src, new URL(encodePath(filePath), root).href);
  if (target?.origin !== root.origin) return null;
  try {
    const path = target.pathname.slice(1).split("/").map(decodeURIComponent).join("/");
    return { path, rest: `${target.search}${target.hash}` };
  } catch {
    return null;
  }
}

/**
 * Where an image of the file loads from on github.com: a relative path from the repository,
 * at the commit of the version of the file it is in; as written when GitHub itself serves
 * it (including data URIs); through the proxied address GitHub gave the same image in its
 * own rich diff of this file otherwise; or held back when there is none, as GitHub never
 * loads a third-party image straight from the reader's browser. What decides is the address
 * `src` resolves to, not how it is written: `/\example.com/a.png` is another site's image.
 */
export function githubImageSource(container: Element, repository: Repository): ImageSource {
  const base = container.ownerDocument.baseURI;
  return (src, version) => {
    if (version) {
      const target = resolveInRepository(src, version.path);
      if (target) return `${fileUrl(repository, "raw", version.commit, target.path)}${target.rest}`;
    }
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
