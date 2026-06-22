"use client";
import styles from "./Timeline.module.css";

export function Timeline({ index, count, onSeek }: { index: number; count: number; onSeek: (i: number) => void }) {
  return (
    <input
      type="range"
      aria-label="Timeline"
      min={0}
      max={Math.max(0, count - 1)}
      value={index}
      onChange={(e) => onSeek(Number(e.target.value))}
      className={styles.range}
    />
  );
}
