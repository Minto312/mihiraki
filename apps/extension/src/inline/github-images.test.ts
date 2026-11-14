import { commitId } from "@mihiraki/core";
import { afterEach, describe, expect, it } from "vitest";
import { githubImageSource, imageKeyOf } from "./github-images";

const repository = { owner: "acme", repo: "app" };
const commit = commitId("a".repeat(40));
const raw = `https://github.com/acme/app/raw/${commit}`;

afterEach(() => {
  document.body.innerHTML = "";
});

function fileBlock(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  return container;
}

describe("githubImageSource", () => {
  it("loads an external image through the proxied URL GitHub gave it in its own rich diff", () => {
    const container = fileBlock(
      '<article><img src="https://camo.githubusercontent.com/abc" data-canonical-src="https://ex.com/a.png"></article>',
    );

    expect(githubImageSource(container, repository)("https://ex.com/a.png", null)).toBe(
      "https://camo.githubusercontent.com/abc",
    );
  });

  it("holds back an external image GitHub has not proxied", () => {
    expect(
      githubImageSource(fileBlock(""), repository)("https://tracker.example/p.png", null),
    ).toBeNull();
  });

  it("lets images from GitHub itself and data URIs load as written", () => {
    const source = githubImageSource(fileBlock(""), repository);

    expect(source("https://github.com/acme/app/raw/main/a.png", null)).toBe(
      "https://github.com/acme/app/raw/main/a.png",
    );
    expect(source("https://avatars.githubusercontent.com/u/1", null)).toBe(
      "https://avatars.githubusercontent.com/u/1",
    );
    expect(source("data:image/png;base64,AAAA", null)).toBe("data:image/png;base64,AAAA");
  });

  it("does not trust a look-alike host", () => {
    expect(
      githubImageSource(fileBlock(""), repository)("https://github.com.evil.example/a.png", null),
    ).toBeNull();
  });

  describe("relative paths", () => {
    const source = (src: string, path = "docs/design/README.md") =>
      githubImageSource(fileBlock(""), repository)(src, { commit, path });

    it("load from the repository at the commit, relative to the file's directory", () => {
      expect(source("./er.png")).toBe(`${raw}/docs/design/er.png`);
      expect(source("er.png")).toBe(`${raw}/docs/design/er.png`);
      expect(source("../images/a.png")).toBe(`${raw}/docs/images/a.png`);
    });

    it("start at the repository's root when they start with a slash", () => {
      expect(source("/images/a.png")).toBe(`${raw}/images/a.png`);
    });

    it("do not go above the repository's root", () => {
      expect(source("../../../../a.png")).toBe(`${raw}/a.png`);
    });

    it("keep the query and the fragment", () => {
      expect(source("a.svg?v=2#icon")).toBe(`${raw}/docs/design/a.svg?v=2#icon`);
    });

    it("are percent-encoded, as are the file's own path segments", () => {
      expect(source("図 1.png", "docs/設計 #1/README.md")).toBe(
        `${raw}/docs/%E8%A8%AD%E8%A8%88%20%231/%E5%9B%B3%201.png`,
      );
    });

    it("count as another site's image when backslashes make them name a host", () => {
      expect(source("/\\tracker.example/p.png")).toBeNull();
      expect(source("\\\\tracker.example/p.png")).toBeNull();
    });
  });

  it("holds back a path that names another site even when the file's version is not known", () => {
    const page = document.implementation.createHTMLDocument("");
    page.head.innerHTML = '<base href="https://github.com/acme/app/pull/1/files">';
    const source = githubImageSource(page.createElement("div"), repository);

    expect(source("./a.png", null)).toBe("https://github.com/acme/app/pull/1/a.png");
    expect(source("/\\tracker.example/p.png", null)).toBeNull();
  });
});

describe("imageKeyOf", () => {
  it("changes once GitHub's own rendering with proxied images arrives", () => {
    const container = fileBlock("");
    const before = imageKeyOf(container);

    container.innerHTML =
      '<article><img src="https://camo.githubusercontent.com/abc" data-canonical-src="https://ex.com/a.png"></article>';

    expect(imageKeyOf(container)).not.toBe(before);
  });
});
