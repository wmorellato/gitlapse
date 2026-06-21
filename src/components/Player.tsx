"use client";
import { usePlayer } from "@/components/usePlayer";
import { CodeViewport } from "@/components/CodeViewport";
import { CommitInfo } from "@/components/CommitInfo";
import { Controls } from "@/components/Controls";
import { Timeline } from "@/components/Timeline";
import type { AnimationPayload } from "@/lib/types";

export function Player({ payload }: { payload: AnimationPayload }) {
  const { commits } = payload;
  const player = usePlayer(commits.length);
  const current = commits[player.index];
  const prev = player.index > 0 ? commits[player.index - 1].content : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100vh", padding: 16, boxSizing: "border-box" }}>
      <header style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span>{payload.repo.displayName} · {payload.filePath}{payload.truncated ? " · (truncated)" : ""}</span>
        <a href="/create">Create your own</a>
      </header>
      <CommitInfo commit={current} index={player.index} count={commits.length} />
      <div style={{ flex: 1, minHeight: 0, border: "1px solid #ddd", borderRadius: 6 }}>
        <CodeViewport content={current.content} prevContent={prev} />
      </div>
      <Timeline index={player.index} count={commits.length} onSeek={player.seek} />
      <Controls player={player} />
    </div>
  );
}
