# Modern UI + Two-Phase Morph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the commit-animation app into a clean, light, minimal UI optimized for reading prose/markdown, and upgrade the line-diff animation with scroll-to-change, line wrapping, and a soft "anticipation highlight" beat before each change applies.

**Architecture:** A thin CSS design-token layer (`globals.css`) plus per-component CSS Modules replaces inline styles (no new dependencies). The animation gains a pure `buildTransition` line-merge (LCS) and a `useMorphPhase` state machine that sequences each commit change as anticipate → apply → idle; `CodeViewport` renders whatever the hook hands it, wrapping long lines and scrolling the first change to the top. The data layer (extraction, store, API, validation, `usePlayer`) is untouched.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, Motion (Framer Motion), Vitest + Testing Library. No new dependencies.

## Global Constraints

- Single **light** theme; all colors/spacing/fonts come from CSS custom properties in `:root` (`src/app/globals.css`). Components read tokens via CSS Modules — no inline style objects for static styling.
- **No new dependencies.** Hand-rolled tokens + CSS Modules only.
- **Adaptive typography:** prose languages are exactly `"markdown"` and `"plaintext"` → proportional font + NO line numbers; everything else → monospace + line numbers.
- **Wrapping always on:** `white-space: pre-wrap; overflow-wrap: anywhere;` viewport scrolls vertically only.
- **Soft washes:** `--add-wash` (low-saturation green), `--remove-wash` (low-saturation rose). These are decoration only; never the sole add/remove signal.
- **Two-phase morph:** anticipate (tint + scroll to first change) → apply (collapse removed / settle added / FLIP context). Phase duration = `clamp(150, round(dwellMs * 0.4), 700)` ms. `dwellMs = BASE_DWELL_MS / speed` (BASE_DWELL_MS = 1500).
- **Skip the beat** (instant swap, no auto-scroll) when `prefers-reduced-motion` is set, when scrubbing the timeline, on the first render, and when a commit has no changes.
- **Data layer unchanged:** do not modify extraction, store, API routes, validation, or `usePlayer.ts`.
- Existing Vitest suite stays green; production `npm run build` must succeed. (Playwright browser run + `docker build` remain CI/Docker-deferred — not runnable in this sandbox.)

---

## File Structure

```
src/app/globals.css            (NEW) :root design tokens + base reset
src/app/layout.tsx             (MOD) import "./globals.css"
src/lib/presentation.ts        (NEW) language -> { font, showLineNumbers }
src/lib/diff.ts                (MOD) add buildTransition(); remove now-unused toRenderLines in Task 5
src/components/useMorphPhase.ts (NEW) phase state machine hook
src/components/CodeViewport.tsx (MOD) consume hook; wrap; adaptive; washes; scroll
src/components/CodeViewport.module.css (NEW)
src/components/Player.tsx       (MOD) wire language/dwell/scrubbing; layout
src/components/Player.module.css (NEW)
src/components/Controls.tsx     (MOD) restyle
src/components/Controls.module.css (NEW)
src/components/Timeline.tsx     (MOD) restyle
src/components/Timeline.module.css (NEW)
src/components/CommitInfo.tsx   (MOD) restyle
src/components/CommitInfo.module.css (NEW)
src/components/CreateForm.tsx   (MOD) restyle
src/components/CreateForm.module.css (NEW)
src/app/create/page.tsx         (MOD, if needed) wrapper styling
src/app/page.tsx                (unchanged behavior; redirect)
src/app/a/[id]/not-found.tsx    (MOD) restyle
```

---

## Task 1: Design tokens + global stylesheet

**Files:**
- Create: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: CSS custom properties on `:root` used by every later CSS Module — `--bg, --surface, --text, --text-muted, --border, --accent, --add-wash, --remove-wash, --font-prose, --font-code, --space-1..6, --radius, --shadow, --measure`.

- [ ] **Step 1: Create `src/app/globals.css`**

```css
:root {
  --bg: #f7f8fa;
  --surface: #ffffff;
  --text: #1c2024;
  --text-muted: #6b7280;
  --border: #e5e7eb;
  --accent: #3b82f6;

  /* soft, harmonized change washes */
  --add-wash: rgba(34, 197, 94, 0.14);
  --remove-wash: rgba(244, 63, 94, 0.12);

  --font-prose: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-code: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;

  --radius: 10px;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 4px 16px rgba(0, 0, 0, 0.06);
  --measure: 72ch;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-prose);
  -webkit-font-smoothing: antialiased;
}

a { color: var(--accent); }

button {
  font: inherit;
  cursor: pointer;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

- [ ] **Step 2: Import the stylesheet in `src/app/layout.tsx`**

Add `import "./globals.css";` as the first line of `src/app/layout.tsx` (above the `metadata` export). Leave the rest of the file unchanged.

- [ ] **Step 3: Verify build + tests**

Run: `npx tsc --noEmit && npm run build && npm run test`
Expected: tsc clean; build succeeds; full existing suite passes (the import is additive).

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: add light design tokens + global stylesheet"
```

---

## Task 2: Presentation mapping

**Files:**
- Create: `src/lib/presentation.ts`
- Test: `tests/lib/presentation.test.ts`

**Interfaces:**
- Produces: `interface Presentation { font: "prose" | "code"; showLineNumbers: boolean }` and `getPresentation(language: string): Presentation`.

- [ ] **Step 1: Write the failing test**

`tests/lib/presentation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getPresentation } from "@/lib/presentation";

describe("getPresentation", () => {
  it("treats markdown and plaintext as prose without line numbers", () => {
    expect(getPresentation("markdown")).toEqual({ font: "prose", showLineNumbers: false });
    expect(getPresentation("plaintext")).toEqual({ font: "prose", showLineNumbers: false });
  });
  it("treats code languages as monospace with line numbers", () => {
    expect(getPresentation("typescript")).toEqual({ font: "code", showLineNumbers: true });
    expect(getPresentation("python")).toEqual({ font: "code", showLineNumbers: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/presentation.test.ts`
Expected: FAIL — cannot find module `@/lib/presentation`.

- [ ] **Step 3: Implement**

`src/lib/presentation.ts`:
```ts
const PROSE_LANGUAGES = new Set(["markdown", "plaintext"]);

export interface Presentation {
  font: "prose" | "code";
  showLineNumbers: boolean;
}

export function getPresentation(language: string): Presentation {
  const isProse = PROSE_LANGUAGES.has(language);
  return { font: isProse ? "prose" : "code", showLineNumbers: !isProse };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/presentation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/presentation.ts tests/lib/presentation.test.ts
git commit -m "feat: add adaptive presentation mapping"
```

---

## Task 3: Transition builder (LCS line-merge)

**Files:**
- Modify: `src/lib/diff.ts`
- Test: `tests/lib/diff.test.ts` (add a new describe block; keep existing tests)

**Interfaces:**
- Consumes: nothing new.
- Produces: `interface TransitionLine { key: string; text: string; type: "context" | "add" | "remove" }` and `buildTransition(prev: string, next: string): TransitionLine[]`.
- Key scheme: context/add lines (the "next" side) are keyed `` `${text} ${occurrenceInNext}` ``; removed lines use a separate namespace `` `r ${text} ${occurrenceInRemoved}` `` so they never collide with next-side keys. This keeps context/add keys stable between the anticipate frame and the applied frame (which is the same list with removes filtered out), enabling FLIP.

- [ ] **Step 1: Write the failing test (append to `tests/lib/diff.test.ts`)**

```ts
import { buildTransition } from "@/lib/diff";

describe("buildTransition", () => {
  it("marks added, removed, and context lines in order", () => {
    const t = buildTransition("a\nb\nc", "a\nx\nc");
    expect(t.map((l) => [l.type, l.text])).toEqual([
      ["context", "a"],
      ["remove", "b"],
      ["add", "x"],
      ["context", "c"]
    ]);
  });

  it("returns all context for identical input", () => {
    const t = buildTransition("a\nb", "a\nb");
    expect(t.every((l) => l.type === "context")).toBe(true);
    expect(t.map((l) => l.text)).toEqual(["a", "b"]);
  });

  it("gives context/add lines keys matching their occurrence in next", () => {
    const t = buildTransition("a", "a\nb");
    const aLine = t.find((l) => l.text === "a")!;
    const bLine = t.find((l) => l.text === "b")!;
    expect(aLine).toMatchObject({ type: "context", key: "a 0" });
    expect(bLine).toMatchObject({ type: "add", key: "b 0" });
  });

  it("keeps removed-line keys in a separate namespace", () => {
    const t = buildTransition("gone", "kept");
    expect(t.find((l) => l.type === "remove")!.key.startsWith("r ")).toBe(true);
  });

  it("handles all-added and all-removed", () => {
    expect(buildTransition("", "x\ny").filter((l) => l.type === "add")).toHaveLength(2);
    expect(buildTransition("x\ny", "").filter((l) => l.type === "remove")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/diff.test.ts`
Expected: FAIL — `buildTransition` is not exported.

- [ ] **Step 3: Implement (append to `src/lib/diff.ts`, keep existing exports for now)**

```ts
export interface TransitionLine {
  key: string;
  text: string;
  type: "context" | "add" | "remove";
}

// Guard: skip the O(n*m) LCS for very large differing middles; fall back to
// "remove all, then add all" so we never blow up memory on huge files.
const LCS_CELL_LIMIT = 4_000_000;

export function buildTransition(prev: string, next: string): TransitionLine[] {
  const a = prev.split("\n");
  const b = next.split("\n");
  const out: TransitionLine[] = [];

  const seenNext = new Map<string, number>();
  const seenRemoved = new Map<string, number>();
  const emitNext = (text: string, type: "context" | "add") => {
    const n = seenNext.get(text) ?? 0;
    seenNext.set(text, n + 1);
    out.push({ key: `${text} ${n}`, text, type });
  };
  const emitRemove = (text: string) => {
    const n = seenRemoved.get(text) ?? 0;
    seenRemoved.set(text, n + 1);
    out.push({ key: `r ${text} ${n}`, text, type: "remove" });
  };

  // Trim common prefix (emitted as context, in next order).
  let lo = 0;
  while (lo < a.length && lo < b.length && a[lo] === b[lo]) {
    emitNext(a[lo], "context");
    lo++;
  }
  // Measure common suffix (emitted later, after the middle).
  let aHi = a.length;
  let bHi = b.length;
  let suffix = 0;
  while (aHi - 1 >= lo && bHi - 1 >= lo && a[aHi - 1] === b[bHi - 1]) {
    aHi--;
    bHi--;
    suffix++;
  }

  const aMid = a.slice(lo, aHi);
  const bMid = b.slice(lo, bHi);
  const m = aMid.length;
  const n = bMid.length;

  if (m * n > LCS_CELL_LIMIT) {
    for (const t of aMid) emitRemove(t);
    for (const t of bMid) emitNext(t, "add");
  } else {
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        dp[i][j] = aMid[i] === bMid[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < m && j < n) {
      if (aMid[i] === bMid[j]) {
        emitNext(aMid[i], "context");
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        emitRemove(aMid[i]);
        i++;
      } else {
        emitNext(bMid[j], "add");
        j++;
      }
    }
    while (i < m) emitRemove(aMid[i++]);
    while (j < n) emitNext(bMid[j++], "add");
  }

  for (let k = 0; k < suffix; k++) emitNext(b[bHi + k], "context");
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/diff.test.ts`
Expected: PASS (new block + existing `toKeys`/`toRenderLines` tests all green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/diff.ts tests/lib/diff.test.ts
git commit -m "feat: add LCS transition builder for the morph"
```

---

## Task 4: Morph phase controller hook

**Files:**
- Create: `src/components/useMorphPhase.ts`
- Test: `tests/components/useMorphPhase.test.ts`

**Interfaces:**
- Consumes: `buildTransition`, `TransitionLine` from `@/lib/diff`.
- Produces:
  - `type MorphPhase = "idle" | "anticipate" | "apply"`
  - `interface MorphState { phase: MorphPhase; lines: TransitionLine[]; firstChangeKey: string | null }`
  - `useMorphPhase(content: string, prevContent: string | null, opts: { dwellMs: number; reduced: boolean; scrubbing: boolean }): MorphState`
- Behavior: on first render, `phase: "idle"`, `lines` = all-context of `content`. When `content` changes: if `reduced || scrubbing || no changes`, snap to applied (idle, no scroll). Otherwise `anticipate` (union list + `firstChangeKey`), after `beat` ms → `apply` (removes filtered out, adds become context), after another `beat` ms → `idle`. `beat = clamp(150, round(dwellMs*0.4), 700)`. Timers cleared on change/unmount.

- [ ] **Step 1: Write the failing test**

`tests/components/useMorphPhase.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMorphPhase } from "@/components/useMorphPhase";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useMorphPhase", () => {
  it("starts idle with all-context lines", () => {
    const { result } = renderHook(() => useMorphPhase("a\nb", null, { dwellMs: 1500, reduced: false, scrubbing: false }));
    expect(result.current.phase).toBe("idle");
    expect(result.current.lines.every((l) => l.type === "context")).toBe(true);
  });

  it("runs anticipate -> apply -> idle on a real change", () => {
    const { result, rerender } = renderHook(
      ({ c, p }) => useMorphPhase(c, p, { dwellMs: 1500, reduced: false, scrubbing: false }),
      { initialProps: { c: "a\nb", p: null as string | null } }
    );
    act(() => rerender({ c: "a\nx", p: "a\nb" }));
    expect(result.current.phase).toBe("anticipate");
    expect(result.current.firstChangeKey).not.toBeNull();
    expect(result.current.lines.some((l) => l.type === "remove")).toBe(true);
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current.phase).toBe("apply");
    expect(result.current.lines.some((l) => l.type === "remove")).toBe(false);
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current.phase).toBe("idle");
  });

  it("snaps instantly when scrubbing (no anticipate phase)", () => {
    const { result, rerender } = renderHook(
      ({ c, p, s }) => useMorphPhase(c, p, { dwellMs: 1500, reduced: false, scrubbing: s }),
      { initialProps: { c: "a", p: null as string | null, s: false } }
    );
    act(() => rerender({ c: "a\nb", p: "a", s: true }));
    expect(result.current.phase).toBe("idle");
    expect(result.current.lines.some((l) => l.type === "remove")).toBe(false);
  });

  it("snaps instantly under reduced motion", () => {
    const { result, rerender } = renderHook(
      ({ c, p, r }) => useMorphPhase(c, p, { dwellMs: 1500, reduced: r, scrubbing: false }),
      { initialProps: { c: "a", p: null as string | null, r: false } }
    );
    act(() => rerender({ c: "z", p: "a", r: true }));
    expect(result.current.phase).toBe("idle");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/useMorphPhase.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

`src/components/useMorphPhase.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/useMorphPhase.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/useMorphPhase.ts tests/components/useMorphPhase.test.ts
git commit -m "feat: add morph phase controller hook"
```

---

## Task 5: Rewrite CodeViewport (wrap, adaptive, washes, scroll)

**Files:**
- Modify: `src/components/CodeViewport.tsx`
- Create: `src/components/CodeViewport.module.css`
- Modify: `src/lib/diff.ts` (remove now-unused `toRenderLines` + `RenderLine`)
- Modify: `tests/lib/diff.test.ts` (remove the `toRenderLines`/`toKeys`-via-toRenderLines tests that reference the removed export; keep `toKeys` and `buildTransition` tests)
- Modify: `tests/components/codeViewport.test.tsx`

**Interfaces:**
- Consumes: `useMorphPhase` (Task 4), `getPresentation` (Task 2).
- Produces: `CodeViewport({ content, prevContent, language, dwellMs, scrubbing }: { content: string; prevContent: string | null; language: string; dwellMs: number; scrubbing: boolean })`.
- Renders one `motion.div.row` per `MorphState.lines` entry, keyed by `line.key`, with `data-type={line.type}`; the container carries `data-phase`. Background washes are driven by CSS (Task's module), structural height/opacity/FLIP by Motion. Line numbers render only when `getPresentation(language).showLineNumbers`, numbering only non-removed lines. Scrolls the `firstChangeKey` row to top on `anticipate` (unless reduced).

- [ ] **Step 1: Update the component test**

Replace `tests/components/codeViewport.test.tsx` with:
```tsx
import { describe, it, expect, beforeAll, vi } from "vitest";
import { render } from "@testing-library/react";
import { CodeViewport } from "@/components/CodeViewport";

beforeAll(() => {
  // jsdom has no layout/scroll; stub so the scroll effect doesn't throw.
  Element.prototype.scrollIntoView = vi.fn();
});

describe("CodeViewport", () => {
  it("renders one row per line on first paint (all context)", () => {
    const { container } = render(
      <CodeViewport content={"a\nb\nc"} prevContent={null} language="plaintext" dwellMs={1500} scrubbing={false} />
    );
    expect(container.querySelectorAll("[data-line]")).toHaveLength(3);
  });

  it("omits the line-number gutter for prose and includes it for code", () => {
    const prose = render(
      <CodeViewport content={"hello world"} prevContent={null} language="markdown" dwellMs={1500} scrubbing={false} />
    );
    expect(prose.container.querySelector("[data-gutter]")).toBeNull();

    const code = render(
      <CodeViewport content={"const x = 1"} prevContent={null} language="typescript" dwellMs={1500} scrubbing={false} />
    );
    expect(code.container.querySelector("[data-gutter]")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/codeViewport.test.tsx`
Expected: FAIL — current `CodeViewport` doesn't accept the new props / has no `data-gutter`.

- [ ] **Step 3: Create the CSS module**

`src/components/CodeViewport.module.css`:
```css
.viewport {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--space-3) var(--space-4);
  line-height: 1.6;
  font-size: 14px;
}
.prose { font-family: var(--font-prose); max-width: var(--measure); }
.code  { font-family: var(--font-code); font-size: 13px; }

.row {
  display: flex;
  gap: var(--space-3);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  border-radius: 6px;
  transition: background-color 0.35s ease;
}

/* Soft anticipation washes (decoration only). */
.viewport[data-phase="anticipate"] .row[data-type="add"] { background-color: var(--add-wash); }
.row[data-type="remove"] { background-color: var(--remove-wash); }

.gutter {
  flex: 0 0 auto;
  min-width: 2.5ch;
  text-align: right;
  color: var(--text-muted);
  user-select: none;
}
.text { flex: 1 1 auto; min-width: 0; }
```

- [ ] **Step 4: Rewrite the component**

`src/components/CodeViewport.tsx`:
```tsx
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
              <span className={styles.text}>{line.text === "" ? " " : line.text}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 5: Remove the now-unused `toRenderLines`**

In `src/lib/diff.ts`, delete the `RenderLine` interface and the `toRenderLines` function (CodeViewport no longer uses them; `toKeys` and `buildTransition` remain). In `tests/lib/diff.test.ts`, delete the `describe("toRenderLines", …)` block and any import of `toRenderLines`; keep the `toKeys` and `buildTransition` blocks.

- [ ] **Step 6: Run tests + typecheck**

Run: `npx vitest run tests/components/codeViewport.test.tsx tests/lib/diff.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean (no dangling references to `toRenderLines`).

- [ ] **Step 7: Commit**

```bash
git add src/components/CodeViewport.tsx src/components/CodeViewport.module.css src/lib/diff.ts tests/lib/diff.test.ts tests/components/codeViewport.test.tsx
git commit -m "feat: morphing wrapped viewport with anticipation beat + scroll"
```

---

## Task 6: Player — wire new props + restyle

**Files:**
- Modify: `src/components/Player.tsx`
- Create: `src/components/Player.module.css`
- Modify: `tests/components/player.test.tsx` (stub `scrollIntoView`; keep existing assertions)

**Interfaces:**
- Consumes: `CodeViewport` (new props from Task 5), `BASE_DWELL_MS` from `@/lib/constants`, `usePlayer`, `CommitInfo`, `Controls`, `Timeline`.
- Produces: `Player({ payload })` unchanged signature; passes `language={payload.language}`, `dwellMs={BASE_DWELL_MS / player.speed}`, `scrubbing` to `CodeViewport`; wraps timeline seeks to mark scrubbing.

- [ ] **Step 1: Update the Player test**

Edit `tests/components/player.test.tsx`: add a `beforeAll` that stubs scroll (CodeViewport now scrolls), keep the existing render + assertions (`"first"`, `"1 / 2"`, timeline slider). Add at the top of the file:
```tsx
import { beforeAll, vi } from "vitest";
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
```
(Keep the rest of the existing test body as-is.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/player.test.tsx`
Expected: FAIL — `Player` passes no `language`/`dwellMs`/`scrubbing` yet, so `CodeViewport`'s new required props are missing (type error / runtime), or the import of `BASE_DWELL_MS` is absent.

- [ ] **Step 3: Create the CSS module**

`src/components/Player.module.css`:
```css
.shell {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  height: 100vh;
  max-width: 920px;
  margin: 0 auto;
  padding: var(--space-4);
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-muted);
}
.source { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pill {
  margin-left: var(--space-2);
  padding: 2px var(--space-2);
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 11px;
}
.createLink { color: var(--accent); text-decoration: none; }
.card {
  flex: 1;
  min-height: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.footer { display: flex; flex-direction: column; gap: var(--space-2); }
```

- [ ] **Step 4: Rewrite Player**

`src/components/Player.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { usePlayer } from "@/components/usePlayer";
import { CodeViewport } from "@/components/CodeViewport";
import { CommitInfo } from "@/components/CommitInfo";
import { Controls } from "@/components/Controls";
import { Timeline } from "@/components/Timeline";
import { BASE_DWELL_MS } from "@/lib/constants";
import type { AnimationPayload } from "@/lib/types";
import styles from "./Player.module.css";

export function Player({ payload }: { payload: AnimationPayload }) {
  const { commits } = payload;
  const player = usePlayer(commits.length);
  const current = commits[player.index];
  const prev = player.index > 0 ? commits[player.index - 1].content : null;

  const [scrubbing, setScrubbing] = useState(false);
  const dwellMs = BASE_DWELL_MS / player.speed;

  const handleSeek = (i: number) => {
    setScrubbing(true);
    player.seek(i);
  };
  // Clear the scrubbing flag shortly after the index settles, so play/next/prev animate.
  useEffect(() => {
    if (!scrubbing) return;
    const t = setTimeout(() => setScrubbing(false), 80);
    return () => clearTimeout(t);
  }, [player.index, scrubbing]);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.source}>
          {payload.repo.displayName} · {payload.filePath}
          {payload.truncated && <span className={styles.pill}>truncated</span>}
        </span>
        <a className={styles.createLink} href="/create">Create your own</a>
      </header>
      <CommitInfo commit={current} index={player.index} count={commits.length} />
      <div className={styles.card}>
        <CodeViewport
          content={current.content}
          prevContent={prev}
          language={payload.language}
          dwellMs={dwellMs}
          scrubbing={scrubbing}
        />
      </div>
      <div className={styles.footer}>
        <Timeline index={player.index} count={commits.length} onSeek={handleSeek} />
        <Controls player={player} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run tests/components/player.test.tsx && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/Player.tsx src/components/Player.module.css tests/components/player.test.tsx
git commit -m "feat: restyle Player and wire morph props (dwell, scrubbing, language)"
```

---

## Task 7: Restyle Controls, Timeline, CommitInfo

**Files:**
- Modify: `src/components/Controls.tsx`, `src/components/Timeline.tsx`, `src/components/CommitInfo.tsx`
- Create: `src/components/Controls.module.css`, `src/components/Timeline.module.css`, `src/components/CommitInfo.module.css`

**Interfaces:**
- No signature changes. Controls keeps button accessible names (`/previous/i`, `/play|pause/i`, `/next/i`) and the speed `<select>` labeled "Speed". Timeline keeps `aria-label="Timeline"` and `role="slider"` (native range). CommitInfo keeps showing the first line of the message, short SHA, author, time, and `index+1 / count`.

> These are presentational changes; the existing `tests/components/controls.test.tsx` must keep passing unchanged (it asserts the play button calls `toggle`, and CommitInfo shows the first message line / short SHA / position). Do not alter the rendered text or accessible names.

- [ ] **Step 1: Confirm the guard tests pass before editing**

Run: `npx vitest run tests/components/controls.test.tsx`
Expected: PASS (baseline).

- [ ] **Step 2: Create CSS modules**

`src/components/Controls.module.css`:
```css
.bar { display: flex; align-items: center; gap: var(--space-2); }
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  line-height: 1;
}
.btn:hover { border-color: var(--accent); }
.btn:active { transform: translateY(1px); }
.spacer { margin-left: auto; }
.speed {
  height: 36px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  padding: 0 var(--space-2);
}
.label { display: inline-flex; align-items: center; gap: var(--space-2); color: var(--text-muted); font-size: 13px; }
```

`src/components/Timeline.module.css`:
```css
.range {
  width: 100%;
  appearance: none;
  -webkit-appearance: none;
  height: 6px;
  border-radius: 999px;
  background: var(--border);
  outline: none;
}
.range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--surface);
  box-shadow: var(--shadow);
  cursor: pointer;
}
.range::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: 2px solid var(--surface);
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
}
```

`src/components/CommitInfo.module.css`:
```css
.bar { display: flex; align-items: center; gap: var(--space-3); font-size: 13px; color: var(--text); }
.sha {
  font-family: var(--font-code);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 1px var(--space-2);
}
.message { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.muted { color: var(--text-muted); }
```

- [ ] **Step 3: Apply the styles in the components**

In `src/components/Controls.tsx`: `import styles from "./Controls.module.css";`, wrap the row in `className={styles.bar}`, give the three buttons `className={styles.btn}` (keep their existing `aria-label`s and the icon text), put the speed control in `className={styles.label}` with the `<select className={styles.speed}>` (keep its `aria-label="Speed"` / accessible name and options), and add `className={styles.spacer}` to move the speed control to the right. Do not change handler wiring.

In `src/components/Timeline.tsx`: `import styles from "./Timeline.module.css";` and add `className={styles.range}` to the existing `<input type="range" aria-label="Timeline" …>`. No other change.

In `src/components/CommitInfo.tsx`: `import styles from "./CommitInfo.module.css";`, wrap in `className={styles.bar}`, put the short SHA in `<code className={styles.sha}>`, the first-line message in `<span className={styles.message}>`, and author/time in `className={styles.muted}`. Keep the exact text content and the `index+1 / count` output unchanged.

- [ ] **Step 4: Run the guard tests + typecheck**

Run: `npx vitest run tests/components/controls.test.tsx && npx tsc --noEmit`
Expected: PASS (accessible names + text unchanged); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/Controls.tsx src/components/Controls.module.css src/components/Timeline.tsx src/components/Timeline.module.css src/components/CommitInfo.tsx src/components/CommitInfo.module.css
git commit -m "feat: restyle controls, timeline, and commit info"
```

---

## Task 8: Restyle CreateForm, create page, landing, not-found

**Files:**
- Modify: `src/components/CreateForm.tsx`
- Create: `src/components/CreateForm.module.css`
- Modify: `src/app/a/[id]/not-found.tsx`
- (Verify: `src/app/create/page.tsx` and `src/app/page.tsx` need no behavior change.)

**Interfaces:**
- No signature/behavior change. CreateForm keeps: inputs labeled `/repository/i` and `/file path/i`, the submit button named `/animate/i`, the SSE handling, the error `<p role="alert">`, and `disabled={busy}`. The existing `tests/components/createForm.test.tsx` (happy-path navigation + fetch-failure re-enable) must keep passing unchanged.

- [ ] **Step 1: Confirm guard tests pass before editing**

Run: `npx vitest run tests/components/createForm.test.tsx`
Expected: PASS (baseline).

- [ ] **Step 2: Create the CSS module**

`src/components/CreateForm.module.css`:
```css
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}
.card {
  width: 100%;
  max-width: 480px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.title { margin: 0; font-size: 22px; }
.subtitle { margin: 0; color: var(--text-muted); font-size: 14px; }
.field { display: flex; flex-direction: column; gap: var(--space-1); font-size: 14px; }
.input {
  height: 40px;
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  color: var(--text);
}
.button {
  height: 42px;
  border: none;
  border-radius: var(--radius);
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}
.button:disabled { opacity: 0.6; cursor: default; }
.status { color: var(--text-muted); font-size: 13px; margin: 0; }
.error { color: #b00020; font-size: 13px; margin: 0; }
```

- [ ] **Step 3: Apply styles in CreateForm**

In `src/components/CreateForm.tsx`: `import styles from "./CreateForm.module.css";`. Wrap the outer element in `className={styles.page}`, the form/content in `className={styles.card}`. Add a `<h1 className={styles.title}>Commit Animation</h1>` and a `<p className={styles.subtitle}>Watch a file evolve across its history.</p>` above the inputs. Give each label `className={styles.field}` (keep the existing label text "Repository URL" / "File path" so `getByLabelText` still matches), each input `className={styles.input}` (keep `required`), the submit button `className={styles.button}` (keep its `/animate/i` text and `disabled={busy}`), the status `<p className={styles.status}>`, and the error `<p role="alert" className={styles.error}>`. Do not change any state/SSE logic.

- [ ] **Step 4: Restyle not-found**

`src/app/a/[id]/not-found.tsx`:
```tsx
export default function NotFound() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
      <h1 style={{ margin: 0 }}>Animation not found</h1>
      <p style={{ color: "var(--text-muted)" }}>This link may be incorrect or expired.</p>
      <a href="/create">Create a new animation</a>
    </main>
  );
}
```
(Small page; tokens-via-`var()` inline is fine here.)

- [ ] **Step 5: Run guard tests + build**

Run: `npx vitest run tests/components/createForm.test.tsx && npx tsc --noEmit && npm run build`
Expected: PASS; tsc clean; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/CreateForm.tsx src/components/CreateForm.module.css src/app/a/[id]/not-found.tsx
git commit -m "feat: restyle create form and not-found page"
```

---

## Task 9: Full-suite + build verification, reduced-motion sanity

**Files:**
- (No new source; this is the integration gate. Add one reduced-motion test for CodeViewport.)
- Modify: `tests/components/codeViewport.test.tsx`

**Interfaces:** none new.

- [ ] **Step 1: Add a reduced-motion render test**

Append to `tests/components/codeViewport.test.tsx`:
```tsx
import { MotionConfig } from "motion/react";

it("renders without a beat under reduced motion (still shows the content)", () => {
  const { container } = render(
    <MotionConfig reducedMotion="always">
      <CodeViewport content={"line one\nline two"} prevContent={"line one"} language="plaintext" dwellMs={1500} scrubbing={false} />
    </MotionConfig>
  );
  // Final content is present; no crash from the reduced-motion path.
  expect(container.querySelectorAll("[data-line]").length).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2: Run the focused test**

Run: `npx vitest run tests/components/codeViewport.test.tsx`
Expected: PASS.

- [ ] **Step 3: Full verification**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: entire suite passes; tsc clean; production build succeeds with standalone output.

- [ ] **Step 4: Commit**

```bash
git add tests/components/codeViewport.test.tsx
git commit -m "test: reduced-motion viewport render + integration verification"
```

---

## Self-Review

**Spec coverage:**
- Clean light minimal + tokens → Task 1.
- Adaptive typography (prose vs code) → Task 2 (`getPresentation`) + Task 5 (applied in viewport).
- No syntax highlighting → nothing added (plain text rows) ✓.
- Line numbers code-only → Task 2 + Task 5 (`data-gutter` conditional).
- Wrapping always on → Task 5 CSS (`pre-wrap` + `overflow-wrap: anywhere`).
- Scroll first change to top → Task 5 (`scrollIntoView({block:"start"})` on anticipate).
- Soft semantic washes → Task 1 tokens + Task 5 CSS (`data-phase`/`data-type`).
- Anticipation beat (appear-highlighted-then-settle; removed highlight-then-collapse) → Task 3 (`buildTransition`) + Task 4 (`useMorphPhase`) + Task 5 (render).
- Phase durations as dwell fractions, clamped → Task 4 (`clamp(150, dwell*0.4, 700)`); dwell from speed → Task 6.
- Skip beat on reduced motion / scrubbing / first render / no change → Task 4 + Task 5 (reduced) + Task 6 (scrubbing flag).
- App-wide restyle (Player, Controls, Timeline, CommitInfo, CreateForm, landing, not-found) → Tasks 6, 7, 8.
- Data layer unchanged → no task touches extraction/store/API/validation/usePlayer ✓.
- Testing per spec (pure builder, hook with fake timers, viewport component, regression green) → Tasks 2–9.

**Placeholder scan:** none — every code step has complete code; CSS is concrete; no TBD/TODO.

**Type consistency:** `TransitionLine` (Task 3) consumed by `useMorphPhase` (Task 4) and `CodeViewport` (Task 5). `MorphState`/`MorphPhase` (Task 4) consumed by Task 5. `Presentation`/`getPresentation` (Task 2) consumed by Task 5. `CodeViewport` props `{content, prevContent, language, dwellMs, scrubbing}` produced in Task 5 and supplied by Player in Task 6. `BASE_DWELL_MS` exists in `src/lib/constants.ts` (value 1500) from the prior build. `toRenderLines` removal (Task 5) is the only deletion and its sole consumer (CodeViewport) is rewritten in the same task.

**Note for executor:** `scrollIntoView` is not implemented in jsdom — Tasks 5 and 6 stub `Element.prototype.scrollIntoView` in their tests. Motion animating `height: "auto"` renders fine in jsdom (no real layout); tests assert DOM structure/attributes, not animation.
