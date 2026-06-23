"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { BASE_DWELL_MS, ANTICIPATE_HOLD_MS } from "@/lib/constants";

export interface PlayerApi {
  index: number; isPlaying: boolean; speed: number; atEnd: boolean;
  play(): void; pause(): void; toggle(): void; replay(): void;
  next(): void; prev(): void; seek(i: number): void; setSpeed(s: number): void;
}

export function usePlayer(count: number): PlayerApi {
  const [index, setIndex] = useState(0);
  const [isPlaying, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const last = Math.max(0, count - 1);
  const clamp = useCallback((i: number) => Math.min(last, Math.max(0, i)), [last]);

  const play = useCallback(() => { if (count > 1) setPlaying(true); }, [count]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => setPlaying((p) => !p), []);
  // Restart from the top and play again — the re-watch affordance at end of playback.
  const replay = useCallback(() => { if (count > 1) { setIndex(0); setPlaying(true); } }, [count]);
  const next = useCallback(() => setIndex((i) => clamp(i + 1)), [clamp]);
  const prev = useCallback(() => setIndex((i) => clamp(i - 1)), [clamp]);
  const seek = useCallback((i: number) => setIndex(clamp(i)), [clamp]);

  const idxRef = useRef(index);
  idxRef.current = index;

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      const nextIdx = idxRef.current + 1;
      if (nextIdx > last) { setPlaying(false); return; }
      setIndex(nextIdx);
      // The per-commit cycle is: paint the region (hold) + morph + settle/read.
      // Keep the interval wide enough that the hold doesn't eat the morph.
    }, (ANTICIPATE_HOLD_MS + BASE_DWELL_MS) / speed);
    return () => clearInterval(id);
  }, [isPlaying, speed, last]);

  // Only meaningful for multi-commit animations: there must be something to replay.
  const atEnd = count > 1 && index >= last;

  return { index, isPlaying, speed, atEnd, play, pause, toggle, replay, next, prev, seek, setSpeed };
}
