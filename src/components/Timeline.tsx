"use client";
import styles from "./Timeline.module.css";

// Above this many commits, per-commit ticks crowd into an illegible smear, so we
// drop them and let the ember fill alone carry the sense of progress.
const MAX_TICKS = 40;

export function Timeline({ index, count, onSeek }: { index: number; count: number; onSeek: (i: number) => void }) {
  const last = Math.max(0, count - 1);
  const pct = last > 0 ? (index / last) * 100 : 0;
  const showTicks = count > 1 && count <= MAX_TICKS;

  return (
    <div className={styles.wrap}>
      {showTicks && (
        <div className={styles.ticks} aria-hidden>
          {Array.from({ length: count }, (_, i) => (
            <span key={i} data-tick className={styles.tick} style={{ left: `${(i / last) * 100}%` }} />
          ))}
        </div>
      )}
      <input
        type="range"
        aria-label="Timeline"
        min={0}
        max={last}
        value={index}
        onChange={(e) => onSeek(Number(e.target.value))}
        className={styles.range}
        style={{
          background: `linear-gradient(to right, var(--accent) ${pct}%, var(--border) ${pct}%)`,
        }}
      />
    </div>
  );
}
