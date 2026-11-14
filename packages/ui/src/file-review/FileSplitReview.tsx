import {
  basePathOf,
  type ChangedFile,
  headPathOf,
  isSameRevision,
  type ReviewBackend,
  type Revision,
  type ThreadSnapshot,
} from "@mihiraki/core";
import { useMemo, useState } from "preact/hooks";
import type { SubmitComment } from "../comment-form/submit-comment";
import { describeLoadFailure } from "../host-errors/describe";
import { useMessages } from "../i18n/i18n";
import { useAsync } from "../review-app/use-async";
import { type DocumentVersions, DocumentVersionsProvider } from "../safe-html/images";
import type { DiffLayout } from "../split-view/layout";
import { SplitReview } from "../split-view/SplitReview";
import { UnifiedReview } from "../split-view/UnifiedReview";

export interface FileSplitReviewProps {
  readonly backend: ReviewBackend;
  readonly file: ChangedFile;
  /** Threads of the whole pull request (only this file's are shown); null until loaded. */
  readonly threads: ThreadSnapshot | null;
  readonly onSubmitComment: SubmitComment;
  /** Two columns (base | head) or one; split by default. */
  readonly layout?: DiffLayout;
}

function documentVersionsOf(file: ChangedFile, revision: Revision): DocumentVersions {
  const basePath = basePathOf(file);
  const headPath = headPathOf(file);
  return {
    base: basePath === null ? null : { commit: revision.base, path: basePath },
    head: headPath === null ? null : { commit: revision.head, path: headPath },
  };
}

function StaleRevisionNotice({ onReload }: { readonly onReload: () => void }) {
  const t = useMessages();
  return (
    <p class="mhr-notice mhr-notice--stale">
      {t.staleRevision}
      <button type="button" class="mhr-button" onClick={onReload}>
        {t.loadLatest}
      </button>
    </p>
  );
}

/**
 * Loads both versions of one file and shows them as a split review. Mount one per file
 * (keyed by its path), so a view never shows another file's text while loading.
 */
export function FileSplitReview({
  backend,
  file,
  threads,
  onSubmitComment,
  layout = "split",
}: FileSplitReviewProps) {
  const t = useMessages();
  const [reloads, setReloads] = useState(0);
  const loaded = useAsync(() => backend.loadFileVersions(file), [backend, file, reloads]);
  const fileThreads = useMemo(
    () => threads?.threads.filter((thread) => thread.path === file.path) ?? [],
    [threads, file.path],
  );
  const revision = loaded.value?.revision;
  const documentVersions = useMemo(
    () => (revision ? documentVersionsOf(file, revision) : null),
    [file, revision],
  );

  if (loaded.status === "failure")
    return (
      <p class="mhr-message mhr-message--error">
        {describeLoadFailure(t, t.couldNotLoadFile(file.path), loaded.failure)}
      </p>
    );
  if (!loaded.value) return <p class="mhr-message">{t.loading}</p>;
  const versions = loaded.value;
  const Review = layout === "unified" ? UnifiedReview : SplitReview;
  // Unknown until the threads are loaded; nothing is claimed about them before that.
  const isStale = threads !== null && !isSameRevision(threads.revision, versions.revision);
  return (
    <>
      {isStale && <StaleRevisionNotice onReload={() => setReloads((count) => count + 1)} />}
      <DocumentVersionsProvider value={documentVersions}>
        <Review
          path={file.path}
          base={versions.base}
          head={versions.head}
          threads={fileThreads}
          revision={versions.revision}
          hasPendingReview={threads?.hasPendingReview === true}
          onSubmitComment={onSubmitComment}
        />
      </DocumentVersionsProvider>
    </>
  );
}
