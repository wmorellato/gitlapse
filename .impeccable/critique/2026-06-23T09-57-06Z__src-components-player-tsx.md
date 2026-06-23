---
target: the player (/a/[id])
total_score: 37
p0_count: 0
p1_count: 0
timestamp: 2026-06-23T09-57-06Z
slug: src-components-player-tsx
---
# Critique — Player (`/a/[id]`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Autoplay, play/pause/replay state, ember timeline fill, N/M, relative time — state is always legible. |
| 2 | Match System / Real World | 4 | Media-player metaphor; segmented speed + relative time read naturally. |
| 3 | User Control and Freedom | 4 | Play/pause/replay/prev/next/scrub/speed + full keyboard control. |
| 4 | Consistency and Standards | 4 | Consistent tokens; ember reserved for action + current selection. |
| 5 | Error Prevention | 3 | Read-only surface; little to get wrong (mostly n/a). |
| 6 | Recognition Rather Than Recall | 4 | Ticks show history length; everything visible; aria-keyshortcuts. |
| 7 | Flexibility and Efficiency | 4 | Space/k, ←→/j/l, Home/End, replay, segmented speed — many paths. |
| 8 | Aesthetic and Minimalist Design | 4 | Clean and on-brand; added affordances stay restrained. |
| 9 | Error Recovery | 3 | Not-found page exists; minimal error surface on the player itself. |
| 10 | Help and Documentation | 3 | Truncated tooltip + exact-on-hover added; shortcuts still not discoverable to sighted users. |
| **Total** | | **37/40** | **Excellent (lower band)** |

## Anti-Patterns Verdict
**LLM assessment:** Does not read as AI-generated. The diff-morph + anticipation beat remains the distinctive identity; ember stays the single action color (now also the timeline fill and active speed segment — both legitimate "current selection" uses), hierarchy is clean, legibility strong. Passes the product slop test.
**Deterministic scan:** `detect.mjs` over `src/components` + `src/app/a` returned 3 advisory `design-system-radius` findings only — the 999px pill badge, the 999px slider track, and the 1px tick rounding. All intentional micro-shapes, not token-governed card/button radii. No side-stripes, gradient text, eyebrows, or card-grid tells.
**Visual overlays:** Not available — sandbox lacks Chromium; browser overlay skipped.

## Overall Impression
The previous run's core weakness — the cold-open and the dead-end at playback's end — is resolved. A shared link now plays itself (motion-safe), ends with a clear Replay affordance, exposes the full transport to the keyboard, and shows the shape of the history on the timeline. The surface went from "good, with one important blind spot" to "polished and self-explanatory." Remaining items are genuine polish (P3).

## What's Working
- **Arrival-to-replay loop is closed.** Autoplay → morph → end-state Replay → re-watch, with a motion-safe degrade throughout. The peak-end payoff now fires on its own.
- **Power-viewer efficiency.** Document-level Space/arrows/Home-End (+ vim j/k/l), a segmented speed control, and a scale-bearing timeline turn a single-path player into a flexible one.
- **Restraint held under additions.** Every new element (replay pill, ticks, segmented speed) uses existing tokens and the one ember voice; nothing shouts.

## Priority Issues
- **[P3] Keyboard shortcuts aren't discoverable.** Space/arrows/Home-End work and are announced via `aria-keyshortcuts`, but a sighted viewer has no visible hint they exist. **Fix:** a subtle "?" legend or a one-line hint on first focus. **Command:** /impeccable onboard
- **[P3] A truly cold viewer still gets no "what is this."** Autoplay now demonstrates the behavior, which largely covers it, but there's no caption explaining the artifact. **Fix:** a short, dismissible one-liner near the header. **Command:** /impeccable clarify
- **[P3] Timeline density is uniform.** Ticks convey length but not where the big changes are, and they drop entirely above 40 commits. **Fix:** weight ticks by diff magnitude; for long histories show sparse milestone ticks instead of none. **Command:** /impeccable polish

## Persona Red Flags
- **Alex (Power viewer):** Now well served — Space toggles, arrows step, Home/End jump, speed is one tap. Only gap: he has to *guess* the shortcuts exist.
- **Jordan (First-timer, cold link):** Autoplay shows the morph immediately and the Replay button invites a second watch; the one missing reassurance is a caption naming what they're looking at.
- **Casey (Mobile):** Controls live in the thumb zone and now wrap instead of overflowing on narrow widths; autoplay removes the hunt-and-tap. Touch targets are 36px — just under the 44px guideline (worth a look).

## Minor Observations
- Control buttons are 36×36; the 44×44 touch-target guideline would bump comfort on mobile.
- The 3 advisory radius findings are intentional pill/track/tick shapes; consider documenting them in DESIGN.md (or a scoped ignore) so the detector stays quiet.
- Segmented speed has no visible label; the `×` suffix + group `aria-label` carry it, which is fine for the player idiom.

## Questions to Consider
- Would a small, persistent shortcut legend help power users without adding chrome for everyone?
- Should the timeline tell you *where the file changed most*, not just how many commits there were?
- Are 36px controls comfortable enough one-handed, or should the player bump to 44px on touch?
