# File-overview minimap — design

**Date:** 2026-06-23
**Status:** Approved, ready for planning

## Problem

During playback, the main content box (`CodeViewport`) shows only the slice of
the file that fits and auto-scrolls to each change. Changes that land outside
the visible region are invisible to the viewer. We want a zoomed-out overview —
a minimap — on the right of the content box that shows the *whole* file and
mirrors the exact same morph (add/remove/context washes), so off-screen changes
are still visible.

## Decisions (from brainstorming)

- **Fidelity:** abstract bars per line (not scaled real text). One thin bar per
  line; width ∝ line length; color = change type. Calm and legible at minimap
  scale; matches the "calm · precise" brand.
- **Role:** passive. No viewport-indicator box, no click/drag-to-scroll. Pure
  animated overview of the file.
- **Long files:** fit the whole file to the card height — all bars always fit,
  the minimap never scrolls. True "see every change at once".
- **No off-the-shelf minimap library.** Monaco's minimap, `react-minimap`, and
  CodeMirror's are bound to their own editors/DOM and cannot mirror the custom
  Motion morph. We render a second view from the morph state we already compute.

## Approach

Lift the `useMorphPhase` call out of `CodeViewport` and up into `Player`. Feed
the resulting `{ phase, lines, firstChangeKey }` to **both** `CodeViewport`
(behavior unchanged) and a new `Minimap`. Single source of truth → the minimap
animates in guaranteed lockstep with the main view, with no duplicated timers.

Rejected alternatives:

- **Minimap calls `useMorphPhase` independently** — two separate `setTimeout`
  chains risk drift and double the work.
- **Off-the-shelf minimap component** — can't mirror the bespoke morph; foreign
  DOM; heavyweight.

## Data flow

```
Player
 ├─ useReducedMotion()
 ├─ usePlayer()
 ├─ useMorphPhase(current.content, prev, { dwellMs, holdMs, reduced, scrubbing })
 │     → { phase, lines, firstChangeKey }        ← lifted out of CodeViewport
 │
 ├─ .card  (flex row)
 │    ├─ CodeViewport  (lines, phase, firstChangeKey, reduced, language)
 │    └─ Minimap       (lines, phase, reduced, language)        ← NEW
 └─ footer (Timeline, Controls)
```

`CodeViewport` becomes a presentational consumer of the morph state. It keeps
its own auto-scroll effect (it still owns scrolling the main view); that effect
now reads `phase` / `firstChangeKey` from props instead of from a local hook
call.

## Components

### `Player` (modified)

- Calls `useMorphPhase` and `useReducedMotion` (already does the latter).
- Passes the shared morph state down to `CodeViewport` and `Minimap`.

### `CodeViewport` (modified)

- Props change from `{ content, prevContent, dwellMs, holdMs, scrubbing, language }`
  to `{ lines, phase, firstChangeKey, reduced, language }` (morph state now
  arrives as props).
- Keeps the `AnimatePresence` row rendering and the eased auto-scroll effect.

### `Minimap` (new) — `src/components/Minimap.tsx` + `Minimap.module.css`

- Fixed-width rail (~56px) inside `.card`, right of the viewport, with a subtle
  left divider (`--border`).
- Renders one `motion.div` **bar** per entry in `lines`, using the same
  `AnimatePresence` + `layout` pattern as `CodeViewport`.
- **Fit-to-height:** bars in a flex column, each `flex: 1 1 0` with a small
  `min-height`, so all lines always fill the card height and the rail never
  scrolls. Add/remove redistributes and animates via Motion `layout`.
- **Bar width** ∝ `line.text.length`, clamped to a max (so very long lines don't
  all peg at 100%), expressed as a percentage of the rail width.
- **Color** from `line.type`, reusing the existing tokens:
  - `context` → muted bar (e.g. `--text-muted` at low opacity / a neutral track)
  - `add` → `--add-wash`
  - `remove` → `--remove-wash`
  Because both views consume the same `lines`/`phase`, the
  anticipate → apply → settle washes appear in the minimap automatically.
- **Reduced motion:** `layout={!reduced}`, no enter/exit height animation — same
  degradation as the viewport. The shared hook already collapses the morph to an
  instant swap when `reduced`.
- **Responsive:** hidden below a narrow breakpoint (content legibility wins on
  small screens, per the design principles). `aria-hidden="true"` — it's
  decorative orientation; the timeline and commit info carry the real semantics.

## Error handling / edge cases

- Empty file / single line: renders 0–1 bars; flex still fills height.
- First commit (no `prev`): morph state is the applied/idle view; minimap shows
  all-context bars. No special-casing needed.
- Very long files: bars get thin (sub-pixel possible); `min-height` keeps them
  visible; this is acceptable and is the intended "everything at once" tradeoff.

## Testing

- **`tests/components/minimap.test.tsx`** (new), following `codeViewport.test.tsx`
  style:
  - N `lines` → N bars rendered.
  - Each bar's `data-type` matches the line type.
  - Bar width scales with `line.text.length` (and clamps at the max).
  - `reduced` disables the layout animation.
- **`tests/components/codeViewport.test.tsx`** (update): construct with the new
  `lines`/`phase`/`firstChangeKey` props instead of `content`/`prevContent`.
- **`tests/components/player.test.tsx`** (update if needed): assert the morph
  state is produced once and both children render.

## Out of scope (YAGNI)

- Viewport-indicator box and click/drag navigation.
- Scaled real-text rendering.
- Minimap scrolling / virtualization.
- Showing the minimap on mobile.
