"use client";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { MorphPhase } from "@/components/useMorphPhase";
import type { TransitionLine } from "@/lib/diff";
import { getPresentation } from "@/lib/presentation";
import styles from "./CodeViewport.module.css";

// Top padding of the scroll container, so the revealed line sits inside the
// content area instead of flush against the container edge.
function parsePadding(el: HTMLElement): number {
  return parseFloat(getComputedStyle(el).paddingTop) || 0;
}

// Smooth, eased scroll of a single container (accelerate then decelerate).
// We animate scrollTop ourselves rather than using { behavior: "smooth" }: the
// native smooth scroll is cancelled whenever layout reflows, and the morph
// reflows constantly — so a native smooth scroll never lands. Driving it per
// frame keeps it on course. Returns a cancel function.
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function rollScrollTo(el: HTMLElement, top: number, durationMs: number): () => void {
  const start = el.scrollTop;
  const delta = top - start;
  if (Math.abs(delta) < 1 || durationMs <= 0) {
    el.scrollTop = top;
    return () => {};
  }
  let raf = 0;
  let startTs = 0;
  const step = (ts: number) => {
    if (!startTs) startTs = ts;
    const t = Math.min(1, (ts - startTs) / durationMs);
    el.scrollTop = start + delta * easeInOutCubic(t);
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

interface CodeViewportProps {
  lines: TransitionLine[];
  phase: MorphPhase;
  firstChangeKey: string | null;
  reduced: boolean;
  language: string;
  holdMs: number;
}

export function CodeViewport({ lines, phase, firstChangeKey, reduced, language, holdMs }: CodeViewportProps) {
  const pres = getPresentation(language);
  const viewport = useRef<HTMLDivElement>(null);

  // While the region is painted (anticipate phase), roll the change into view by
  // scrolling ONLY the viewport — scrollIntoView() would also scroll the window
  // and surface a second page scrollbar. The eased roll runs during the hold,
  // before the new content is applied, so it has a calm window to complete.
  // The lookup runs in rAF because Motion attaches the row's node after this
  // effect commits; querying the DOM next frame reliably finds it.
  useEffect(() => {
    if (phase !== "anticipate" || reduced || !firstChangeKey) return;
    let cancelRoll = () => {};
    const raf = requestAnimationFrame(() => {
      const container = viewport.current;
      const target = container?.querySelector<HTMLElement>("[data-first-change]");
      if (!container || !target) return;
      const offset = target.getBoundingClientRect().top - container.getBoundingClientRect().top;
      // Leave a few lines of context above the change instead of pinning it flush.
      const headroom = parsePadding(container) + container.clientHeight * 0.25;
      const top = Math.max(0, container.scrollTop + offset - headroom);
      // Finish the roll comfortably within the hold window.
      cancelRoll = rollScrollTo(container, top, Math.min(700, holdMs * 0.8));
    });
    return () => {
      cancelAnimationFrame(raf);
      cancelRoll();
    };
  }, [phase, firstChangeKey, reduced, holdMs]);

  let lineNo = 0;
  return (
    <div
      ref={viewport}
      className={`${styles.viewport} ${pres.font === "prose" ? styles.prose : styles.code}`}
      data-phase={phase}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {lines.map((line) => {
          const number = line.type === "remove" ? null : ++lineNo;
          return (
            <motion.div
              key={line.key}
              data-line
              data-type={line.type}
              data-first-change={line.key === firstChangeKey ? "" : undefined}
              className={styles.row}
              layout={!reduced}
              initial={reduced ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: reduced ? 0 : 0.35 }}
            >
              {pres.showLineNumbers && (
                <span className={styles.gutter} data-gutter aria-hidden="true">
                  {number}
                </span>
              )}
              <span className={styles.text}>{line.text === "" ? " " : line.text}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
