---
target: player (/a/[id])
total_score: 32
p0_count: 0
p1_count: 1
timestamp: 2026-06-22T15-37-41Z
slug: src-components-player-tsx
---
# Critique — Player (`/a/[id]`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Position N/M + scrubber are clear, but nothing signals "ended" or invites a replay. |
| 2 | Match System / Real World | 4 | Standard media-player metaphor, plain language. |
| 3 | User Control and Freedom | 3 | Play/pause/prev/next/scrub/speed all present; no replay-at-end, no keyboard shortcuts. |
| 4 | Consistency and Standards | 4 | Consistent tokens/components throughout. |
| 5 | Error Prevention | 3 | Little to get wrong on this surface (server-rendered, read-only). |
| 6 | Recognition Rather Than Recall | 4 | Everything visible; nothing to memorize. |
| 7 | Flexibility and Efficiency | 2 | Single path; no spacebar play/pause, no arrow stepping, no loop. |
| 8 | Aesthetic and Minimalist Design | 4 | Clean, on-brand, every element earns its place. |
| 9 | Error Recovery | 3 | Not-found page exists; minimal error surface here. |
| 10 | Help and Documentation | 2 | A cold viewer gets no hint of what this is or how to start. |
| **Total** | | **32/40** | **Good (upper band)** |

## Anti-Patterns Verdict
**LLM assessment:** Does not read as AI-generated. The signature diff-morph + anticipation beat is genuinely distinctive; restrained ember accent, clean hierarchy, strong legibility. Passes the product slop test — the tool disappears into the task.
**Deterministic scan:** `detect.mjs` over Player/CodeViewport/Controls/Timeline/CommitInfo + `app/a/` returned `[]` (clean). No side-stripes, gradient text, eyebrows, or card-grid tells.
**Visual overlays:** Not available — sandbox lacks Chromium system libraries; browser overlay skipped.

## Overall Impression
A polished, on-brand player whose one weak spot is the moment that matters most: a recipient opening a shared link **cold**. The delightful morph — the entire reason to share — doesn't fire until they hunt down a small icon button. Biggest opportunity: make the payoff happen (or be one obvious tap away) on arrival.

## What's Working
- **The morph is the identity.** Anticipation wash → grow/collapse → FLIP is distinctive and matches "The Replay" north star.
- **Restraint.** Ember used only for interaction (≤10%); clean type; adaptive prose/code; reduced-motion + focus-visible done right.
- **Clear single focus.** Header → commit meta → viewport card → controls reads top-to-bottom with low cognitive load.

## Priority Issues
- **[P1] Cold viewers don't see the payoff.** The player loads paused at commit 0; the morph only happens after the viewer finds the play control. For a share-first product this buries the value. **Fix:** autoplay on load (respect `prefers-reduced-motion` → start paused), or a prominent center play affordance over the viewport. **Command:** /impeccable onboard
- **[P2] No replay at the end.** Playback stops on the last commit with no way to rewatch except scrubbing back + pressing play. **Fix:** show a "Replay" control (and/or auto-loop) when index hits the end. **Command:** /impeccable animate
- **[P2] Timeline conveys no scale or change-density.** The range has no commit ticks (DESIGN.md claims ticks that aren't implemented) and no count, so viewers can't tell how long the history is or where the big changes are. **Fix:** add subtle per-commit ticks or "commit N of M" emphasis; consider marking commits with large diffs. **Command:** /impeccable polish
- **[P2] No keyboard control.** Space to play/pause and ←/→ to step are absent (only the focused range responds to arrows). Repeat/power viewers expect them. **Fix:** add document-level key handlers with visible focus. **Command:** /impeccable polish
- **[P3] Metadata is date-only.** CommitInfo shows `toLocaleDateString()` (no relative time), though DESIGN.md describes "relative time (hover = exact)." **Fix:** show relative time ("3 days ago") with exact on hover. **Command:** /impeccable clarify

## Persona Red Flags
- **Jordan (First-Timer, opens a shared link):** Lands on a static frame; no cue that it animates or that play starts it. May read it as a plain code snippet and leave before the morph ever plays.
- **Casey (Mobile, tapped a shared link):** Controls sit at the bottom (good thumb zone), but no autoplay means an extra hunt-and-tap before anything happens; header `repo · filePath` + "Create your own" can crowd on narrow widths.
- **Alex (Repeat/Power viewer):** No spacebar toggle, no arrow stepping, no loop — rewatching is friction.
- **The Recipient (project persona):** Opened a link a friend sent saying "watch this." Sees frame 0 paused; the promised "watch" requires finding a button. Peak-end payoff is gated behind a click.

## Minor Observations
- Controls bar uses `margin-left:auto` to push speed right; verify it doesn't overflow on very narrow viewports.
- `truncated` pill is good; consider a tooltip explaining it ("showing the latest 100 commits").
- Speed `<select>` is fine but a segmented control would read more "player."

## Questions to Consider
- What if the morph started the instant the link opened (motion-safe), so the payoff is the arrival?
- Does the viewer ever know "this is the end — watch again"?
- What would make the timeline tell the story of the file at a glance, not just scrub it?
