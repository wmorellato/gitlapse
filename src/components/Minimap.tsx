"use client";
import { AnimatePresence, motion } from "motion/react";
import type { TransitionLine } from "@/lib/diff";
import styles from "./Minimap.module.css";

// A line at/above this many characters fills the rail; shorter lines scale down
// proportionally. Keeps very long lines from all pegging at full width.
const FULL_WIDTH_CHARS = 48;
const MIN_WIDTH_PERCENT = 8;

export function barWidthPercent(text: string): number {
  const raw = (text.length / FULL_WIDTH_CHARS) * 100;
  return Math.max(MIN_WIDTH_PERCENT, Math.min(100, raw));
}

interface MinimapProps {
  lines: TransitionLine[];
  reduced: boolean;
}

export function Minimap({ lines, reduced }: MinimapProps) {
  return (
    <div className={styles.minimap} aria-hidden="true">
      <AnimatePresence initial={false} mode="popLayout">
        {lines.map((line) => (
          <motion.div
            key={line.key}
            className={styles.row}
            layout={!reduced}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.35 }}
          >
            <span
              data-bar
              data-type={line.type}
              className={styles.bar}
              style={{ width: `${barWidthPercent(line.text)}%` }}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
