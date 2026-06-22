# Modern UI + Two-Phase Morph — Design

**Date:** 2026-06-22
**Status:** Approved (design phase)
**Builds on:** the existing commit-animation app (player at `/a/[id]`, create flow at `/create`).

## Summary

A visual and interaction overhaul of the commit-animation player, optimized for reading **prose/markdown** (its primary content) while still handling code. It replaces the current bare inline-styled UI with a clean, light, minimal design system, and upgrades the line-diff animation with three behaviors the user asked for:

1. **Scroll-to-change** — when a commit advances, the first changed line smoothly rolls to the top of the viewport.
2. **Line wrapping** — long lines/paragraphs wrap so the full text is always visible (vertical scroll only).
3. **Anticipation highlight beat** — before lines are added/removed, the affected lines are highlighted in soft, harmonized washes (gentle green for additions, gentle rose for removals); after a brief beat the change applies.

This pass is presentational + animation only. The data layer (extraction, store, API, validation, `usePlayer`, `toRenderLines`) is unchanged.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Aesthetic | Clean, light, minimal (single light theme) | Primary use is reading text/markdown |
| Typography | Adaptive: proportional sans for prose/markdown, monospace for code | Best readability for prose; code still aligns |
| Syntax highlighting | Not now (plain, cleanly-styled text) | Fits text focus + minimal; `language` already stored for later |
| Line numbers | Code files only | Cleaner prose reading |
| Wrapping | Always on (`pre-wrap`), vertical scroll only | Directly satisfies "see the entire paragraph" |
| Scroll target | First changed line → top of viewport, smooth | User's literal request |
| Highlight color | Soft semantic pair (gentle green add / gentle rose remove) | Read add vs remove at a glance, calm on light bg |
| Added-line behavior | Appear highlighted, then settle | Reads as "here's the change → now applied" |
| Styling mechanism | Plain CSS tokens (`globals.css`) + CSS Modules | No new deps; one place to tune the look |
| Animation | `buildTransition` (LCS merge) + `useMorphPhase` state machine | Needed to render removed lines during the beat; testable |
| Scope | Whole app (player + create + landing) | "UI looks outdated" reads as general |

## Non-Goals

- Syntax highlighting (deferred again; additive later via the stored `language`).
- Rendered markdown — the raw text animates line-by-line; the morph diffs literal lines.
- Dark theme / theme toggle.
- Any change to extraction, storage, API, validation, or playback-state logic.

## Architecture & File Structure

All new visual work reads from CSS custom properties; component logic stays small and single-purpose.

**Design tokens — `src/app/globals.css`** (imported once in `layout.tsx`):
- *Color:* `--bg`, `--surface`, `--text`, `--text-muted`, `--border`, `--accent`; soft washes `--add-wash` / `--remove-wash` (low-saturation green / rose) plus slightly stronger settle edges.
- *Type:* `--font-prose` (system sans stack), `--font-code` (`ui-monospace, …`). No font dependencies; `next/font` swap-in is a later drop-in.
- *Scale:* spacing steps, `--radius`, elevation/shadow, prose content max-width.

**Component styling:** CSS Modules per component, all reading tokens, replacing inline styles.

**Files**
- *New:* `globals.css`; `*.module.css` for Player, CodeViewport, Controls, Timeline, CommitInfo, CreateForm, landing.
- *New logic:*
  - `src/lib/diff.ts` → add `buildTransition(prev, next)` (pure).
  - `src/components/useMorphPhase.ts` → phase-controller hook.
  - `src/lib/presentation.ts` → `language → { font: "prose" | "code"; showLineNumbers: boolean }` (pure).
- *Modified (restyle + wiring):* `layout.tsx`, `Player.tsx`, `CodeViewport.tsx`, `Controls.tsx`, `Timeline.tsx`, `CommitInfo.tsx`, `CreateForm.tsx`, `page.tsx`/landing, `not-found.tsx`.
- *Unchanged:* `usePlayer.ts`, `toRenderLines`/`toKeys`, extraction/store/API/validation.

## Content Rendering (CodeViewport)

- **Adaptive presentation:** `presentation.ts` maps the stored `language` to display settings. Prose languages (`markdown`, `plaintext`) → `--font-prose`, no line numbers, comfortable measure (max-width + generous line-height). Code → `--font-code`, line numbers on, full width. Read once per animation; no per-line branching.
- **Wrapping:** lines use `white-space: pre-wrap` + `overflow-wrap: anywhere`; the viewport scrolls vertically only. This makes line heights variable, which the morph must respect (animate `height: auto ↔ 0`).
- **Line layout:** each line is a row: optional gutter (line number — code only, `user-select:none`, muted, right-aligned) + text cell. Prose omits the gutter entirely. Empty lines render a non-breaking space to keep height.
- **Scroll-to-change:** the viewport is the scroll container. Each line carries a ref; on transition start the controller finds the first `add`/`remove` line and calls `el.scrollIntoView({ block: "start", behavior: "smooth" })` scoped to the viewport, so the first change rolls to the top as it highlights. No changed lines → skip. Suppressed under reduced-motion and on scrubbing (instant).

## Transition Model & Phase Controller

**`buildTransition(prev, next): TransitionLine[]` (pure, in `diff.ts`).** An LCS line-merge yields one ordered union list:
```ts
interface TransitionLine {
  key: string;                              // occurrence-indexed, stable for context lines
  text: string;
  type: "context" | "add" | "remove";
}
```
Removed lines stay in their original positions, added lines in their new positions, unchanged lines are `context`. Keys reuse the existing occurrence-indexing so `context` lines keep identity across frames (enables FLIP).

**`useMorphPhase(index, content, prevContent, { dwellMs, reduced, scrubbing })`.** One transition at a time:
- **idle** → on index change from play/next/prev: compute the transition, then **anticipate → apply → idle**.
- **anticipate:** render the union. `add` lines appear with `--add-wash`; `remove` lines stay in place with `--remove-wash`; context unchanged. Fire scroll-to-first-change. Hold a beat.
- **apply:** render the next frame only. Removed keys absent → `AnimatePresence` collapses them out (height→0, fade, rose). Added lines persist and animate wash → transparent (settle). Context lines FLIP to new positions.
- **Durations:** fractions of `dwellMs` (≈40% anticipate / 40% apply), clamped to a sane min/max, so they fit inside the playback dwell and honor the speed control.

**Shortcuts & safety:**
- First render / index 0: content renders directly as `context` (no load-time wash).
- Scrubbing → jump straight to applied (no beat, instant scroll); beats resume on play.
- Reduced motion → instant swap, no beat/auto-scroll.
- Rapid advances → clear pending phase timers and snap any in-flight transition to applied before starting the next (no overlap/jank).

`CodeViewport` renders whatever list the hook provides and reads the phase to choose each line's wash target; Motion animates between phases via variants.

## App-Wide Restyle

Visual only; reads tokens.
- **Player (`/a/[id]`):** centered shell with comfortable max-width. Header bar (`repo · filePath` muted, `truncated` pill, quiet "Create your own"). Commit-info bar as a tidy meta row (mono SHA chip, first-line message, author, relative time, `N / M`). Viewport card (surface, soft border, radius, subtle elevation) holding the scroll area. Footer groups timeline + controls.
- **Controls:** real icon buttons (prev / play-pause / next) with accessible labels and hover/active/`focus-visible` states; refined speed control; play/pause icon reflects state.
- **Timeline:** restyled range — slim track, `--accent` fill, clean thumb, subtle commit ticks, comfortable hit area.
- **CommitInfo:** tokenized presentational row; first-line message ellipsis; exact timestamp on hover.
- **CreateForm (`/create`) + landing (`/`):** centered card, title/subtitle, labeled inputs with focus states, primary action; SSE progress as a clean status line (phase text + subtle indeterminate indicator); errors in a calm inline alert (keeps `role="alert"`, re-enables submit on failure). Landing routes to `/create` as today, styled consistently.
- **Responsive/a11y:** fluid widths, small-screen stacking, `focus-visible` outlines throughout. No new component libraries.

## Edge Cases & Accessibility

- **No-op commit** (identical content): no add/remove → no beat, no scroll; commit-info/position still update.
- **All-removed / all-added:** union is one type; beat + collapse/expand still apply; empty result renders an empty viewport, not a crash.
- **Very large diffs:** clamped phase durations; wrapping + vertical scroll; scroll targets the first change.
- **Long unbroken tokens** (URLs/base64): `overflow-wrap: anywhere`.
- **Rapid next/prev / fast speed:** timer-clear + snap-to-applied.
- **Reduced motion:** instant swaps, no beat/auto-scroll.
- **Contrast/focus:** AA-contrast tokens; soft washes are decorative, never the sole add/remove signal (motion + position also convey it); `focus-visible` rings on all interactive elements.

## Error Handling

Unchanged from current behavior — input validation, SSE error events, not-found page, create-form `role="alert"` + submit re-enable. This pass is presentational + animation only.

## Testing

- **Unit (pure):** `buildTransition` — context/add/remove ordering, stable keys, duplicate lines, all-add, all-remove, identical input (no changes); `presentation.ts` — language → font/line-number mapping.
- **Hook:** `useMorphPhase` with fake timers — idle→anticipate→apply→idle sequence and durations; scrubbing and reduced-motion skip the beat; rapid index change cancels/snaps.
- **Component:** `CodeViewport` — wrapping styles applied; line-number gutter present for code / absent for prose; anticipate phase renders both add and remove tinted rows; `scrollIntoView` invoked for the first changed line (stubbed in jsdom).
- **Regression:** existing Vitest suite stays green; Playwright flow updated only if selectors move (keep stable where possible).
- **Deferred to CI/Docker:** Playwright browser run and `docker build` (sandbox lacks browser system libs / Docker).
