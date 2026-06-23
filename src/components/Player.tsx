"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePlayer } from "@/components/usePlayer";
import { usePlayerKeys } from "@/components/usePlayerKeys";
import { CodeViewport } from "@/components/CodeViewport";
import { CommitInfo } from "@/components/CommitInfo";
import { Controls } from "@/components/Controls";
import { Timeline } from "@/components/Timeline";
import { BASE_DWELL_MS, ANTICIPATE_HOLD_MS } from "@/lib/constants";
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
  const holdMs = ANTICIPATE_HOLD_MS / player.speed;
  // The performance is over: invite a re-watch without auto-looping (calm, not flashy).
  const finished = player.atEnd && !player.isPlaying;
  // Space / arrows / Home-End for repeat and power viewers.
  usePlayerKeys(player, commits.length);

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
          holdMs={holdMs}
          scrubbing={scrubbing}
        />
        <AnimatePresence>
          {finished && (
            <motion.div
              className={styles.replayLayer}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
              transition={{ duration: reduced ? 0.12 : 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <button className={styles.replayButton} onClick={player.replay}>
                <span className={styles.replayIcon} aria-hidden>↻</span>
                Replay
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className={styles.footer}>
        <Timeline index={player.index} count={commits.length} onSeek={handleSeek} />
        <Controls player={player} />
      </div>
    </div>
  );
}
