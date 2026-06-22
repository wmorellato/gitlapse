"use client";
import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { usePlayer } from "@/components/usePlayer";
import { CodeViewport } from "@/components/CodeViewport";
import { CommitInfo } from "@/components/CommitInfo";
import { Controls } from "@/components/Controls";
import { Timeline } from "@/components/Timeline";
import { BASE_DWELL_MS } from "@/lib/constants";
import type { AnimationPayload } from "@/lib/types";
import styles from "./Player.module.css";

export function Player({ payload }: { payload: AnimationPayload }) {
  const { commits } = payload;
  const player = usePlayer(commits.length);
  const current = commits[player.index];
  const prev = player.index > 0 ? commits[player.index - 1].content : null;

  const [scrubbing, setScrubbing] = useState(false);
  const reduced = useReducedMotion();
  const dwellMs = BASE_DWELL_MS / player.speed;

  // Arrival payoff: a shared link should play itself. Start once on mount so a
  // cold viewer sees the morph immediately — unless they prefer reduced motion,
  // in which case they land on the first commit and can step through manually.
  useEffect(() => {
    if (!reduced && commits.length > 1) player.play();
    // Autoplay only on initial mount; reduced/play are read at that point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSeek = (i: number) => {
    setScrubbing(true);
    player.seek(i);
  };
  // Clear the scrubbing flag shortly after the index settles, so play/next/prev animate.
  useEffect(() => {
    if (!scrubbing) return;
    const t = setTimeout(() => setScrubbing(false), 80);
    return () => clearTimeout(t);
  }, [player.index, scrubbing]);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.source}>
          {payload.repo.displayName} · {payload.filePath}
          {payload.truncated && <span className={styles.pill}>truncated</span>}
        </span>
        <a className={styles.createLink} href="/create">Create your own</a>
      </header>
      <CommitInfo commit={current} index={player.index} count={commits.length} />
      <div className={styles.card}>
        <CodeViewport
          content={current.content}
          prevContent={prev}
          language={payload.language}
          dwellMs={dwellMs}
          scrubbing={scrubbing}
        />
      </div>
      <div className={styles.footer}>
        <Timeline index={player.index} count={commits.length} onSeek={handleSeek} />
        <Controls player={player} />
      </div>
    </div>
  );
}
