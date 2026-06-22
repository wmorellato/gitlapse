import type { CommitSnapshot } from "@/lib/types";
import styles from "./CommitInfo.module.css";

export function CommitInfo({ commit, index, count }: { commit: CommitSnapshot; index: number; count: number }) {
  const firstLine = commit.message.split("\n")[0];
  const when = new Date(commit.timestamp);
  return (
    <div className={styles.bar}>
      <code className={styles.sha}>{commit.shortSha}</code>
      <span className={styles.message}>{firstLine}</span>
      <span className={styles.muted}>{commit.author.name}</span>
      <time dateTime={commit.timestamp} title={when.toISOString()} className={styles.muted}>{when.toLocaleDateString()}</time>
      <span>{index + 1} / {count}</span>
    </div>
  );
}
