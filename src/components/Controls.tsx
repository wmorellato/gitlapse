"use client";
import type { PlayerApi } from "@/components/usePlayer";
import styles from "./Controls.module.css";

const SPEEDS = [0.5, 1, 2, 4];

export function Controls({ player }: { player: PlayerApi }) {
  return (
    <div className={styles.bar}>
      <button onClick={player.prev} aria-label="Previous commit" className={styles.btn}>⏮</button>
      <button onClick={player.toggle} aria-label={player.isPlaying ? "Pause" : "Play"} className={styles.btn}>
        {player.isPlaying ? "⏸" : "▶"}
      </button>
      <button onClick={player.next} aria-label="Next commit" className={styles.btn}>⏭</button>
      <div className={styles.spacer}></div>
      <label className={styles.label}>
        Speed
        <select
          aria-label="Speed"
          value={player.speed}
          onChange={(e) => player.setSpeed(Number(e.target.value))}
          className={styles.speed}
        >
          {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
      </label>
    </div>
  );
}
