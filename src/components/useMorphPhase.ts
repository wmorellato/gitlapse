"use client";
import { useEffect, useRef, useState } from "react";
import { buildTransition, type TransitionLine } from "@/lib/diff";
import { ANTICIPATE_HOLD_MS } from "@/lib/constants";

export type MorphPhase = "idle" | "anticipate" | "apply";

export interface MorphState {
  phase: MorphPhase;
  lines: TransitionLine[];
  firstChangeKey: string | null;
}

// The "before" view: the old content with the lines that are about to change
// still present (and highlighted as removals). No added lines yet — this is the
// region we paint and hold on before the change is applied.
function beforeView(transition: TransitionLine[]): TransitionLine[] {
  return transition.filter((l) => l.type !== "add");
}

function applied(transition: TransitionLine[]): TransitionLine[] {
  return transition
    .filter((l) => l.type !== "remove")
    .map((l) => ({ ...l, type: "context" as const }));
}

// The line to scroll to while painting the region. A removal anchors directly;
// a pure addition anchors to the preceding context line (its insertion point).
function anchorKey(transition: TransitionLine[]): string | null {
  const idx = transition.findIndex((l) => l.type !== "context");
  if (idx === -1) return null;
  if (transition[idx].type === "remove") return transition[idx].key;
  for (let k = idx - 1; k >= 0; k--) {
    if (transition[k].type === "context") return transition[k].key;
  }
  return null;
}

export function useMorphPhase(
  content: string,
  prevContent: string | null,
  opts: { dwellMs: number; reduced: boolean; scrubbing: boolean; holdMs?: number }
): MorphState {
  const { dwellMs, reduced, scrubbing, holdMs = ANTICIPATE_HOLD_MS } = opts;
  const [state, setState] = useState<MorphState>(() => ({
    phase: "idle",
    lines: buildTransition(content, content),
    firstChangeKey: null
  }));
  const shownRef = useRef(content);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (content === shownRef.current) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const from = prevContent ?? shownRef.current ?? "";
    const transition = buildTransition(from, content);
    const firstChange = transition.find((l) => l.type !== "context");
    shownRef.current = content;

    if (reduced || scrubbing || !firstChange) {
      setState({ phase: "idle", lines: applied(transition), firstChangeKey: null });
      return;
    }

    const beat = Math.min(700, Math.max(150, Math.round(dwellMs * 0.4)));

    // Phase 1 — paint the region: old content, change highlighted, held so the
    // viewer registers where the edit lands (and the eased scroll can finish).
    setState({ phase: "anticipate", lines: beforeView(transition), firstChangeKey: anchorKey(transition) });

    const t1 = setTimeout(() => {
      // Phase 2 — apply: the new content appears (additions grow in).
      setState({ phase: "apply", lines: transition, firstChangeKey: null });
      // Phase 3 — settle: removed lines collapse away, washes clear.
      const t2 = setTimeout(() => {
        setState({ phase: "idle", lines: applied(transition), firstChangeKey: null });
      }, beat);
      timers.current.push(t2);
    }, holdMs);
    timers.current.push(t1);
  }, [content, prevContent, dwellMs, reduced, scrubbing, holdMs]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return state;
}
