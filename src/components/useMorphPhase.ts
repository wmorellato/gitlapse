"use client";
import { useEffect, useRef, useState } from "react";
import { buildTransition, type TransitionLine } from "@/lib/diff";

export type MorphPhase = "idle" | "anticipate" | "apply";

export interface MorphState {
  phase: MorphPhase;
  lines: TransitionLine[];
  firstChangeKey: string | null;
}

function applied(transition: TransitionLine[]): TransitionLine[] {
  return transition
    .filter((l) => l.type !== "remove")
    .map((l) => ({ ...l, type: "context" as const }));
}

export function useMorphPhase(
  content: string,
  prevContent: string | null,
  opts: { dwellMs: number; reduced: boolean; scrubbing: boolean }
): MorphState {
  const { dwellMs, reduced, scrubbing } = opts;
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
    setState({ phase: "anticipate", lines: transition, firstChangeKey: firstChange.key });

    const t1 = setTimeout(() => {
      setState({ phase: "apply", lines: applied(transition), firstChangeKey: null });
      const t2 = setTimeout(() => setState((s) => ({ ...s, phase: "idle" })), beat);
      timers.current.push(t2);
    }, beat);
    timers.current.push(t1);
  }, [content, prevContent, dwellMs, reduced, scrubbing]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return state;
}
