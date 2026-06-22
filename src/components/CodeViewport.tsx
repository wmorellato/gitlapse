"use client";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMorphPhase } from "@/components/useMorphPhase";
import { getPresentation } from "@/lib/presentation";
import styles from "./CodeViewport.module.css";

interface CodeViewportProps {
  content: string;
  prevContent: string | null;
  language: string;
  dwellMs: number;
  scrubbing: boolean;
}

export function CodeViewport({ content, prevContent, language, dwellMs, scrubbing }: CodeViewportProps) {
  const reduced = useReducedMotion() ?? false;
  const { phase, lines, firstChangeKey } = useMorphPhase(content, prevContent, { dwellMs, reduced, scrubbing });
  const pres = getPresentation(language);
  const rows = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (phase !== "anticipate" || reduced || !firstChangeKey) return;
    rows.current.get(firstChangeKey)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [phase, firstChangeKey, reduced]);

  let lineNo = 0;
  return (
    <div
      className={`${styles.viewport} ${pres.font === "prose" ? styles.prose : styles.code}`}
      data-phase={phase}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {lines.map((line) => {
          const number = line.type === "remove" ? null : ++lineNo;
          return (
            <motion.div
              key={line.key}
              ref={(el) => {
                if (el) rows.current.set(line.key, el);
                else rows.current.delete(line.key);
              }}
              data-line
              data-type={line.type}
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
