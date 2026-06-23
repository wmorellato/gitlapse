import type { CommitSnapshot } from "@/lib/types";
import { formatRelative } from "@/lib/relativeTime";
import styles from "./CommitInfo.module.css";

const EXACT = { dateStyle: "medium", timeStyle: "short" } as const;

export function CommitInfo({ commit, index, count }: { commit: CommitSnapshot; index: number; count: number }) {
  const firstLine = commit.message.split("\n")[0];
  const when = new Date(commit.timestamp);
  // Relative time is friendlier than a bare date; the full timestamp stays one
  // hover away. Computed at render against "now"; suppressHydrationWarning keeps
  // the harmless server/client wording difference from logging a mismatch.
  const relative = formatRelative(when, new Date());
  const exact = when.toLocaleString(undefined, EXACT);
  return (
    <div className={styles.bar}>
      <code className={styles.sha}>{commit.shortSha}</code>
      <span className={styles.message}>{firstLine}</span>
      <span className={styles.muted}>{commit.author.name}</span>
      <time dateTime={commit.timestamp} title={exact} className={styles.muted} suppressHydrationWarning>{relative}</time>
      <span>{index + 1} / {count}</span>
    </div>
  );
}
