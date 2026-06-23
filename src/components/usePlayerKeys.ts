"use client";
import { useEffect, useRef } from "react";
import type { PlayerApi } from "@/components/usePlayer";

const FORM_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA", "BUTTON"]);

// Document-level transport shortcuts for repeat / power viewers:
//   Space / k  → play, pause, or replay at the end
//   ← / j      → previous commit      → / l → next commit
//   Home / End → first / last commit
// Shortcuts are ignored when focus is in a form control or button so native
// behaviour (typing, the range's own arrow stepping, button activation) wins.
export function usePlayerKeys(player: PlayerApi, count: number): void {
  const ref = useRef(player);
  ref.current = player;

  useEffect(() => {
    if (count <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (FORM_TAGS.has(target.tagName) || target.isContentEditable)) return;

      const p = ref.current;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          if (p.atEnd && !p.isPlaying) p.replay();
          else p.toggle();
          break;
        case "ArrowLeft":
        case "j":
          e.preventDefault();
          p.prev();
          break;
        case "ArrowRight":
        case "l":
          e.preventDefault();
          p.next();
          break;
        case "Home":
          e.preventDefault();
          p.seek(0);
          break;
        case "End":
          e.preventDefault();
          p.seek(count - 1);
          break;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [count]);
}
