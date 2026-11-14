import type { CommitId } from "@mihiraki/core";
import type { ComponentChildren } from "preact";
import { createContext } from "preact";
import { useContext, useMemo, useState } from "preact/hooks";
import type { SanitizedHtml } from "./sanitize";

/** The commit and path of the version of the reviewed file that an image appears in. */
export interface DocumentVersion {
  readonly commit: CommitId;
  readonly path: string;
}

/** The version shown on each side; null for a side the file does not exist on. */
export interface DocumentVersions {
  readonly base: DocumentVersion | null;
  readonly head: DocumentVersion | null;
}

/**
 * How the host lets an image of the reviewed Markdown load: the URL to load it from (e.g.
 * the host's own image proxy), or null to hold it back until the reviewer asks for it. A PR
 * author could otherwise learn who opened the file, and from where, with a tracking image.
 * `version` is the version of the file the image is in, which a relative path is relative
 * to; null when it is not known.
 */
export type ImageSource = (src: string, version: DocumentVersion | null) => string | null;

export interface ImagePolicy {
  readonly resolve: ImageSource;
  /** Images the reviewer chose to load as written. */
  readonly allowed: ReadonlySet<string>;
}

interface ImagePolicyState extends ImagePolicy {
  readonly allow: (src: string) => void;
}

const ImagePolicyContext = createContext<ImagePolicyState | null>(null);

/** Without a source, images load as written (e.g. the playground, which has no host). */
export function ImagePolicyProvider({
  source,
  children,
}: {
  readonly source: ImageSource | undefined;
  readonly children: ComponentChildren;
}) {
  const [allowed, setAllowed] = useState<ReadonlySet<string>>(() => new Set());
  const policy = useMemo(
    () =>
      source
        ? {
            resolve: source,
            allowed,
            allow: (src: string) => setAllowed((before) => new Set([...before, src])),
          }
        : null,
    [source, allowed],
  );
  return <ImagePolicyContext.Provider value={policy}>{children}</ImagePolicyContext.Provider>;
}

export function useImagePolicy(): ImagePolicyState | null {
  return useContext(ImagePolicyContext);
}

const DocumentVersionsContext = createContext<DocumentVersions | null>(null);

/** Tells the rendered blocks which version of the file each side shows. */
export const DocumentVersionsProvider = DocumentVersionsContext.Provider;

export function useDocumentVersions(): DocumentVersions | null {
  return useContext(DocumentVersionsContext);
}

/** Marks the button that stands in for a held-back image; it carries the image's address. */
export const HELD_IMAGE_ATTR = "data-mhr-src";

function hostOf(src: string): string {
  try {
    return new URL(src).host;
  } catch {
    return src;
  }
}

/**
 * Applies the policy to sanitised HTML: each image loads from the host's URL for it, or is
 * replaced by a button naming its site. `version` is the version of the file the HTML was
 * rendered from. Only attributes are removed and a plain button with text is added, so the
 * result is still safe to insert.
 */
export function holdImages(
  html: SanitizedHtml,
  policy: ImagePolicy,
  label: (host: string) => string,
  version: DocumentVersion | null,
): SanitizedHtml {
  const template = document.createElement("template");
  template.innerHTML = html;
  for (const element of Array.from(template.content.querySelectorAll("[src]"))) {
    if (element.tagName !== "IMG") element.removeAttribute("src");
  }
  for (const image of Array.from(template.content.querySelectorAll("img"))) {
    image.removeAttribute("srcset");
    const src = image.getAttribute("src");
    if (!src || policy.allowed.has(src)) continue;
    const resolved = policy.resolve(src, version);
    if (resolved !== null) {
      image.setAttribute("src", resolved);
      continue;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mhr-image-held";
    button.setAttribute(HELD_IMAGE_ATTR, src);
    button.textContent = label(hostOf(src));
    image.replaceWith(button);
  }
  return template.innerHTML as SanitizedHtml;
}
