"use client";
import type { PlayerApi } from "@/components/usePlayer";

const SPEEDS = [0.5, 1, 2, 4];

export function Controls({ player }: { player: PlayerApi }) {
  return (
    <div className="controls" style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button onClick={player.prev} aria-label="Previous commit">⏮</button>
      <button onClick={player.toggle} aria-label={player.isPlaying ? "Pause" : "Play"}>
        {player.isPlaying ? "⏸" : "▶"}
      </button>
      <button onClick={player.next} aria-label="Next commit">⏭</button>
      <label style={{ marginLeft: "auto" }}>
        Speed
        <select
          aria-label="Speed"
          value={player.speed}
          onChange={(e) => player.setSpeed(Number(e.target.value))}
        >
          {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
      </label>
    </div>
  );
}
