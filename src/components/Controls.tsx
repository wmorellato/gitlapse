"use client";
import type { PlayerApi } from "@/components/usePlayer";
import styles from "./Controls.module.css";

const SPEEDS = [0.5, 1, 2, 4];

export function Controls({ player }: { player: PlayerApi }) {
  // Once playback settles on the final commit, the primary control becomes a
  // re-watch button; while still playing the last frame it stays Pause.
  const showReplay = player.atEnd && !player.isPlaying;
  return (
    <div className={styles.bar}>
      <button onClick={player.prev} aria-label="Previous commit" aria-keyshortcuts="ArrowLeft" className={styles.btn}>⏮</button>
      <button
        onClick={showReplay ? player.replay : player.toggle}
        aria-label={showReplay ? "Replay" : player.isPlaying ? "Pause" : "Play"}
        aria-keyshortcuts="Space"
        className={styles.btn}
      >
        {showReplay ? "↻" : player.isPlaying ? "⏸" : "▶"}
      </button>
      <button onClick={player.next} aria-label="Next commit" aria-keyshortcuts="ArrowRight" className={styles.btn}>⏭</button>
      <div className={styles.speeds} role="group" aria-label="Playback speed">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            className={styles.speedBtn}
            aria-pressed={player.speed === s}
            onClick={() => player.setSpeed(s)}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
