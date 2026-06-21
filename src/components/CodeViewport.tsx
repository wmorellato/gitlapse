"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toRenderLines } from "@/lib/diff";

export function CodeViewport({ content, prevContent }: { content: string; prevContent: string | null }) {
  const reduce = useReducedMotion();
  const lines = toRenderLines(content, prevContent);

  return (
    <div
      className="code-viewport"
      style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, lineHeight: "20px", overflow: "auto" }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {lines.map((line, i) => (
          <motion.div
            key={line.key}
            data-line
            data-change={line.change}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, height: 0, backgroundColor: "rgba(46,160,67,0.25)" }}
            animate={{ opacity: 1, height: 20, backgroundColor: "rgba(0,0,0,0)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, backgroundColor: "rgba(248,81,73,0.25)" }}
            transition={{ duration: reduce ? 0.1 : 0.4 }}
            style={{ display: "flex", gap: 12, whiteSpace: "pre" }}
          >
            <span style={{ opacity: 0.4, userSelect: "none", minWidth: 32, textAlign: "right" }}>{i + 1}</span>
            <span>{line.text === "" ? " " : line.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
