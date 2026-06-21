import type { CommitSnapshot } from "@/lib/types";

export function CommitInfo({ commit, index, count }: { commit: CommitSnapshot; index: number; count: number }) {
  const firstLine = commit.message.split("\n")[0];
  const when = new Date(commit.timestamp);
  return (
    <div className="commit-info" style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 14 }}>
      <code>{commit.shortSha}</code>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firstLine}</span>
      <span>{commit.author.name}</span>
      <time dateTime={commit.timestamp} title={when.toISOString()}>{when.toLocaleDateString()}</time>
      <span>{index + 1} / {count}</span>
    </div>
  );
}
